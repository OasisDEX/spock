import { PersistedLog } from '../extractors/instances/rawEventDataExtractor';
import { Dictionary, ValueOf } from 'ts-essentials';
import { zip } from 'lodash';
import BigNumber from 'bignumber.js';
import { TransactionalServices, LocalServices } from '../types';

const abiDecoder = require('abi-decoder');

export async function handleEvents(
  services: LocalServices,
  abi: any,
  logs: PersistedLog[],
  handlers: EventHandlers,
): Promise<void> {
  abiDecoder.addABI(abi);
  // @todo sanity check for handlers is to check if event names exist in ABI

  const rawEvents: RawEvent[] = abiDecoder.decodeLogs(
    logs.map((l: any) => {
      const topics = l.topics;
      const newTopics = topics.slice(1, topics.length - 1).split(',');

      return {
        ...l,
        topics: newTopics,
      };
    }),
  );
  const parsedEvents = rawEvents.map(e => parseEvent(e));

  if (parsedEvents.length !== logs.length) {
    throw new Error('Length mismatch');
  }
  const fullEventInfo: FullEventInfoUnfiltered[] = zip(parsedEvents, logs).map(
    ([event, log]) => ({ event, log } as any),
  );

  for (const handlerName of Object.keys(handlers)) {
    const handler: ValueOf<typeof handlers> = (handlers as any)[handlerName];

    // @todo we could group all events once
    const filteredEvents = fullEventInfo.filter(e => e.event && e.event.name === handlerName);
    await Promise.all(filteredEvents.map(e => handler(services, e as any)));
  }
}

export async function handleDsNoteEvents(
  services: LocalServices,
  abi: any,
  logs: PersistedLog[],
  handlers: DsNoteHandlers,
): Promise<void> {
  abiDecoder.addABI(abi);
  // @todo sanity check for handlers is to check if event names exist in ABI

  const parsedNotes = logs.map(
    (l: PersistedLog): NoteDecoded | undefined => {
      const explodedTopics = l.topics.slice(1, l.topics.length - 1).split(',');
      const [, guyRaw] = explodedTopics;
      // NOTE: we need to be careful not to ignore leading 0
      const guy = '0x' + guyRaw.slice(guyRaw.length - 40, guyRaw.length);
      const value = '0x' + l.data.slice(2, 64 + 2);
      const calldata = '0x' + l.data.slice(2 + 64 * 3);
      const decodedCallData = abiDecoder.decodeMethod(calldata);

      // it might be a standard log so we won't decode it
      if (!decodedCallData) {
        return;
      }

      const paramsDecoded: any = {};
      for (const param of decodedCallData.params) {
        paramsDecoded[param.name] = param.value.toString();
      }

      return {
        name:
          decodedCallData.name + `(${decodedCallData.params.map((p: any) => p.type).join(',')})`,
        params: paramsDecoded,
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
  params: Dictionary<string>;
  ethValue: string;
  caller: string;
}

interface RawEvent {
  address: string;
  name: string;
  events: { name: string; type: string; value: string }[];
}

function parseEvent(event: RawEvent | undefined): ParsedEvent | undefined {
  if (!event) {
    return undefined;
  }

  const args: Dictionary<string> = {};
  for (const e of event.events) {
    args[e.name] = e.value.toString();
  }

  return {
    address: event.address,
    name: event.name,
    args,
  };
}

export interface ParsedEvent {
  address: string;
  name: string;
  args: Dictionary<string>;
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

type Handler = (services: LocalServices, info: FullEventInfo) => Promise<void>;
export type EventHandlers = Dictionary<Handler>;

type DsNoteHandler = (services: LocalServices, info: FullNoteEventInfo) => Promise<void>;
export type DsNoteHandlers = Dictionary<DsNoteHandler>;
