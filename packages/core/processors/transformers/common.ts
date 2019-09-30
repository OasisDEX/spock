import { Dictionary, ValueOf } from 'ts-essentials';
import { zip } from 'lodash';
import { ethers, utils } from 'ethers';
import BigNumber from 'bignumber.js';
import Web3 = require('web3');

import { PersistedLog } from '../extractors/instances/rawEventDataExtractor';
import { LocalServices } from '../../types';

/**
 * Note make sure that for the same ABI you always provide same object (reference). Otherwise this can lead to memory leaks.
 */
export async function handleEvents<TServices>(
  services: TServices,
  abi: any,
  logs: PersistedLog[],
  handlers: EventHandlers<TServices>,
): Promise<void> {
  const iface = new ethers.utils.Interface(abi);

  // @todo sanity check for handlers is to check if event names exist in ABI

  const parsedEvents = logs.map(
    (l: any): ParsedEvent | undefined => {
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
          params[p] = normalizeValue(event.values[p]);
        }
      }

      const args: string[] = [];
      for (let i = 0; i < eventDefinition.length; i++) {
        args.push(normalizeValue(event.values[i]));
      }

      return {
        name: event.name,
        address: l.address.toLowerCase(),
        args,
        params,
      };
    },
  );

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

function normalizeValue(v: any): string {
  if (utils.BigNumber.isBigNumber(v)) {
    return v.toString();
  }

  if (Web3.utils.checkAddressChecksum(v)) {
    return v.toLowerCase();
  }

  return v.toString();
}

export async function handleDsNoteEvents(
  services: LocalServices,
  abi: any,
  logs: PersistedLog[],
  handlers: DsNoteHandlers,
): Promise<void> {
  // @todo sanity check for handlers is to check if event names exist in ABI

  const iface = new ethers.utils.Interface(abi);

  const parsedNotes = logs.map(
    (l: PersistedLog): NoteDecoded | undefined => {
      const explodedTopics = l.topics.slice(1, l.topics.length - 1).split(',');
      const [, guyRaw] = explodedTopics;

      // NOTE: we need to be careful not to ignore leading 0
      const guy = '0x' + guyRaw.slice(guyRaw.length - 40, guyRaw.length);
      const value = '0x' + l.data.slice(2, 64 + 2);
      const calldata = '0x' + l.data.slice(2 + 64 * 2);
      const decodedCallData = iface.parseTransaction({ data: calldata });

      // it might be a standard log so we won't decode it
      if (!decodedCallData) {
        return;
      }

      // we need to query abi and get args names b/c ethers won't return them
      // NOTE: there might be no named args and thus you will have to use positional args
      const names = iface.functions[decodedCallData.signature].inputs.map(i => i.name);
      const params: Dictionary<string> = {};
      for (const [i, param] of decodedCallData.args.entries()) {
        const name = names[i];
        if (name !== undefined) {
          params[name] = normalizeValue(param);
        }
      }

      const args = decodedCallData.args.map(a => normalizeValue(a));

      return {
        name: decodedCallData.signature,
        args,
        params,
        ethValue: new BigNumber(value).toString(10),
        caller: guy,
      };
    },
  );

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
  args: Array<string>; // positional args
  params: Dictionary<string>; // named args
  ethValue: string;
  caller: string;
}

export interface ParsedEvent {
  address: string;
  name: string;
  args: Array<string>;
  params: Dictionary<string>;
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
