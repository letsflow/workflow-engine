import { Event as ProcessEvent, instantiate, InstantiateEvent } from '@letsflow/core/process';
import { Binary } from '@ltonetwork/lto';
import { Event, EventChain } from '@ltonetwork/lto/events';
import { Account } from '@ltonetwork/lto/accounts';
import { NormalizedScenario } from '@letsflow/core/scenario';
import Ajv from 'ajv';
import { v5 as uuidv5 } from 'uuid';
import { processSchema } from '@letsflow/core/schemas/v1.0';

const UUID_NS = uuidv5(processSchema.$id, uuidv5.URL);

type SignedProcessEvent = ProcessEvent & {
  signature?: string;
  signedBy?: { address: string; publicKey: string; keyType: string };
};

function isInstantiateEvent(event: Partial<ProcessEvent>): event is InstantiateEvent {
  return 'scenario' in event;
}

export function genProcessId(chainId: string): string {
  return uuidv5(chainId, UUID_NS);
}

export function toLtoEventChain(events: SignedProcessEvent[]): EventChain {
  if (!isInstantiateEvent(events[0])) throw new Error('First event must be an instantiate event');
  if (!('chain' in events[0])) throw new Error("Instantiate event doesn't have a chain id");

  const chain = new EventChain(events[0].chain);

  for (const event of events) {
    if (!('signedBy' in event)) throw new Error(`Event ${event.hash} is not signed`);

    const ltoEvent = toLtoEvent(event, chain);
    ltoEvent.signKey = { publicKey: event.signedBy.publicKey, keyType: event.signedBy.keyType };
    ltoEvent.signature = Binary.fromHex(event.signature as string);

    if (ltoEvent.hash.hex !== event.hash) {
      throw new Error(`Event hash '${event.hash}' does not match LTO event hash '${ltoEvent.hash.hex}'`);
    }

    chain.add(ltoEvent);
  }

  return chain;
}

function toLtoEvent(data: Omit<ProcessEvent, 'hash'>, chain?: EventChain): Event {
  const previous = 'previous' in data ? Binary.fromHex(data.previous as string) : chain?.latestHash;
  if (!previous) {
    throw new Error('Event chain is required for instantiate event');
  }

  const event = new Event(data);
  event.previous = previous;
  event.timestamp = data.timestamp.getTime();

  return event;
}

export function getHashFn(account: Account, chain?: EventChain) {
  return <T extends ProcessEvent>(
    data: Omit<T, 'hash'>,
  ): T & {
    signature: string;
    signedBy: { address: string; publicKey: string; keyType: string };
  } => {
    const event = toLtoEvent(data, chain).signWith(account);

    if (isInstantiateEvent(data) && chain) {
      (data as any).chain = chain.id;
    }

    return {
      ...data,
      hash: event.hash.hex,
      signature: event.signature!.hex as string,
      signedBy: {
        address: account.address,
        publicKey: account.publicKey,
        keyType: account.keyType,
      },
    } as any;
  };
}

export function getInstantiateFn(account: Account) {
  return (scenario: NormalizedScenario, options: { ajv?: Ajv } = {}) => {
    const chain = new EventChain(account);

    const hashFn = getHashFn(account, chain);
    const idFn = () => genProcessId(chain.id);

    return instantiate(scenario, { ...options, hashFn, idFn });
  };
}
