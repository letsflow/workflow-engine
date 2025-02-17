import { Injectable, Logger } from '@nestjs/common';
import { LTO } from '@ltonetwork/lto';
import { Account as LtoAccount } from '@ltonetwork/lto/accounts';
import { ConfigService } from '@/common/config/config.service';
import { Message } from '@ltonetwork/lto/messages';
import { EventChain } from '@ltonetwork/lto/events';
import { ProcessService } from '@/process/process.service';
import { genProcessId, toLtoEventChain } from '@/decentralized/convert';
import { ScenarioService } from '@/scenario/scenario.service';
import { Event as ProcessEvent, InstantiateEvent, replay } from '@letsflow/core/process';

@Injectable()
export class DecentralizedService {
  private logger = new Logger(DecentralizedService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly lto: LTO,
    private readonly account: LtoAccount,
    private readonly scenarios: ScenarioService,
    private readonly processes: ProcessService,
  ) {}

  get enabled() {
    return this.config.get('decentralized.enabled');
  }

  async handle(receivedMessage: Message): Promise<boolean> {
    if (!this.enabled) {
      throw new Error('Decentralized service is disabled');
    }

    const message = await this.verify(receivedMessage);

    if (!message) {
      return false;
    }

    const receivedEvents = JSON.parse(message.data.toString()) as EventChain;

    if (await this.processes.has(genProcessId(receivedEvents.id))) {
      return await this.handleExistingProcess(receivedEvents);
    } else {
      return await this.handleNewProcess(receivedEvents);
    }
  }

  private async handleNewProcess(chain: EventChain) {
    const processId = genProcessId(chain.id);

    if (chain.isPartial()) {
      this.logger.warn(`Received partial event chain for unknown process ${genProcessId(chain.id)}`);
      return false;
    }

    try {
      chain.validate();
    } catch (error) {
      this.logger.warn(`Invalid event chain for new process ${processId}: ${error}`);
      return false;
    }

    const events: ProcessEvent[] = chain.events.map((event) => event.parsedData);
    const scenario = await this.scenarios.get((events[0] as InstantiateEvent).scenario);

    try {
      const process = replay(scenario, events);
      await this.processes.save(process);
    } catch (error) {
      this.logger.warn(`Failed to replay process ${processId}. ${error}`);
      return false;
    }

    return true;
  }

  private async handleExistingProcess(receivedEvents: EventChain) {
    const processId = genProcessId(receivedEvents.id);
    const process = await this.processes.get(processId);

    const chain = toLtoEventChain(process.events);
    const lastKnown = chain.latestHash;
    chain.add(receivedEvents);

    try {
      chain.validate();
    } catch (error) {
      this.logger.warn(`Invalid event chain for process ${processId}: ${error}`);
      return false;
    }

    const newEvents = chain.startingAfter(lastKnown);
    if (newEvents.events.length === 0) {
      this.logger.debug(`Received event chain for process ${processId} is up to date`);
      return true;
    }

    this.logger.debug(`Received ${newEvents.events.length} new events for process ${processId}`);

    const events: ProcessEvent[] = newEvents.events.map((event) => event.parsedData);

    try {
      const updatedProcess = replay(process, events);
      await this.processes.save(updatedProcess);
    } catch (error) {
      this.logger.warn(`Failed to replay process ${processId}. ${error}`);
      return false;
    }

    return true;
  }

  async verify(message: Message): Promise<Message | null> {
    if (!message.verifyHash()) {
      this.logger.warn(`Failed to verify hash of message ${message.hash}`);
      return null;
    }

    if (!message.verifySignature()) {
      this.logger.warn(`Failed to verify signature of message ${message.hash}`);
      return null;
    }

    if (message.mediaType !== 'application/json') {
      this.logger.warn(`Unsupported media type of message ${message.hash}: ${message.mediaType}`);
      return null;
    }

    if (!message.isEncrypted()) {
      return message;
    }

    try {
      return message.decryptWith(this.account);
    } catch (error) {
      this.logger.warn(`Failed to decrypt message ${message.hash} from relay: ${error}`);
      return null;
    }
  }
}
