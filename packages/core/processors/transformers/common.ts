import { Dictionary, ValueOf } from 'ts-essentials';
import { zip } from 'lodash';
import { ethers } from 'ethers';
import { tryParseDsNote, tryParseDsNoteVer2 } from './tryParseDsNote';

import { PersistedLog } from '../extractors/instances/rawEventDataExtractor';
import { LocalServices } from '../../types';

/**
 * Decode events from raw logs using provided ABI.
 *
 * @param handlers - Keys are event names.
 *
 * NOTE: make sure that for the same ABI you always provide same object (reference). Otherwise this can lead to memory leaks.
 * NOTE: For support for DSNote generated events use "handleDsNoteEvents"
 */
export async function handleEvents<TServices>(
  services: TServices,
  abi: any,
  logs: PersistedLog[],
  handlers: EventHandlers<TServices>,
): Promise<void> {
  const iface = new ethers.utils.Interface(abi);

  // @todo sanity check for handlers is to check if event names exist in ABI

  const parsedEvents = logs.map((l: any): ParsedEvent | undefined => {
    const topics = l.topics;
    const newTopics = topics.slice(1, topics.length - 1).split(',');
    const event = iface.parseLog({ data: l.data, topics: newTopics });

    if (!event) {
      return;
    }

    // we want to split positional arguments from named arguments,
    // this turns out to be a PITA because they are merged together inside parsedEvent.values object/array thing

    const eventDefinition = iface.events[event.signature].inputs;
    const paramsNames = eventDefinition.map(p => p.name);

    const params: Dictionary<string> = {};
    for (const p of paramsNames) {
      if (p) {
        params[p] = event.values[p];
      }
    }

    const args: string[] = [];
    for (let i = 0; i < eventDefinition.length; i++) {
      args.push(event.values[i]);
    }

    return {
      name: event.name,
      address: l.address.toLowerCase(),
      args,
      params,
    };
  });

  if (parsedEvents.length !== logs.length) {
    throw new Error('Length mismatch');
  }
  const fullEventInfo: FullEventInfoUnfiltered[] = zip(parsedEvents, logs).map(([event, log]) => ({
    event,
    log: log!,
  }));

  for (const handlerName of Object.keys(handlers)) {
    const handler: ValueOf<typeof handlers> = (handlers as any)[handlerName];

    // @todo we could group all events once
    const filteredEvents = fullEventInfo.filter(e => e.event && e.event.name === handlerName);
    await Promise.all(filteredEvents.map(e => handler(services, e as any)));
  }
}

/**
 * Decode dsnote generated anonymous events.
 *
 * @param handlers - Keys are method signatures.
 * @param version - There are two different DSNotes versions in the wild. DsNote Ver 2 doesnt encode call value, it's used in MCD.
 */
export async function handleDsNoteEvents(
  services: LocalServices,
  abi: any,
  logs: PersistedLog[],
  handlers: DsNoteHandlers,
  version: 1 | 2 = 1,
): Promise<void> {
  const iface = new ethers.utils.Interface(abi);

  const parsedNotes = logs.map((l: PersistedLog): NoteDecoded | undefined => {
    const explodedTopics = l.topics.slice(1, l.topics.length - 1).split(',');
    const parsedNote =
      version === 2
        ? tryParseDsNoteVer2(explodedTopics, l.data)
        : tryParseDsNote(explodedTopics, l.data);

    if (!parsedNote) {
      return;
    }

    const decodedCallData = iface.parseTransaction({ data: parsedNote.values.fax });

    // // it might be a standard log so we won't decode it
    if (!decodedCallData) {
      return;
    }

    // // we need to query abi and get args names b/c ethers won't return them
    // // NOTE: there might be no named args and thus you will have to use positional args
    const names = iface.functions[decodedCallData.signature].inputs.map(i => i.name);
    const params: Dictionary<string> = {};
    for (const [i, param] of decodedCallData.args.entries()) {
      const name = names[i];
      if (name !== undefined) {
        params[name] = param;
      }
    }

    return {
      name: decodedCallData.signature,
      args: decodedCallData.args,
      params,
      ethValue: parsedNote.values.wad && parsedNote.values.wad.toString(10),
      caller: parsedNote.values.guy.toLowerCase(),
    };
  });

  if (parsedNotes.length !== logs.length) {
    throw new Error('Length mismatch');
  }
  const fullEventInfo: FullNoteEventInfoUnfiltered[] = zip(parsedNotes, logs).map(
    ([note, log]) => ({ note, log } as any),
  );

  const promises = fullEventInfo.map(async info => {
    if (!info.note) {
      return;
    }

    const handler = handlers[info.note.name];
    if (!handler) {
      return;
    }

    await handler(services, info as any);
  });

  await Promise.all(promises);
}

interface NoteDecoded {
  name: string;
  args: Array<any>; // positional args
  params: Dictionary<any>; // named args
  ethValue?: string; // its undefined for DsNoteVer2 used in MCD
  caller: string;
}

export interface ParsedEvent {
  address: string;
  name: string;
  args: Array<any>;
  params: Dictionary<any>;
}

export interface FullEventInfo {
  event: ParsedEvent;
  log: PersistedLog;
}
export interface FullEventInfoUnfiltered {
  event?: ParsedEvent;
  log: PersistedLog;
}

export interface FullNoteEventInfo {
  note: NoteDecoded;
  log: PersistedLog;
}
export interface FullNoteEventInfoUnfiltered {
  note?: NoteDecoded;
  log: PersistedLog;
}

type Handler<TServices> = (services: TServices, info: FullEventInfo) => Promise<void>;
export type EventHandlers<TServices> = Dictionary<Handler<TServices>>;

type DsNoteHandler = (services: LocalServices, info: FullNoteEventInfo) => Promise<void>;
export type DsNoteHandlers = Dictionary<DsNoteHandler>;
