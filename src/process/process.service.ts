import { Injectable } from '@nestjs/common';
import { StartInstructions } from './process.dto';
import { ScenarioService } from '../scenario/scenario.service';
import { Collection, Db } from 'mongodb';
import { MUUID, from as bsonUUID } from 'uuid-mongodb';
import { instantiate, InstantiateEvent, Process } from '@letsflow/core/process';

type ProcessDocument = Omit<Process, 'id' | 'scenario'> & { _id: MUUID; scenario: MUUID };

@Injectable()
export class ProcessService {
  private collection: Collection<ProcessDocument>;

  constructor(private scenarios: ScenarioService, private db: Db) {}

  async onModuleInit() {
    this.collection = await this.db.collection<ProcessDocument>('processes');
  }

  async start(instructions: StartInstructions): Promise<Process> {
    const { _disabled: disabled, ...scenario } = await this.scenarios.get(instructions.scenario);
    if (disabled) throw new Error('Scenario is disabled');

    const process = instantiate(scenario, instructions);
    await this.save(process);

    return process;
  }

  async has(id: string): Promise<boolean> {
    return (await this.collection.countDocuments({ _id: bsonUUID(id) })) > 0;
  }

  async get(id: string): Promise<Process> {
    const processDocument = await this.collection.findOne({ _id: bsonUUID(id) }, { projection: { _id: 0 } });
    if (!processDocument) throw new Error('Process not found');

    const { _id, scenario: scenarioId, ...rest } = processDocument;
    const { _disabled: _ignore, ...scenario } = await this.scenarios.get(scenarioId.toString());

    return { id, scenario, ...rest };
  }

  async save(process: Process) {
    const { id, scenario: _ignore, ...rest } = process;
    const instantiateEvent = process.events[0] as InstantiateEvent;

    const doc: ProcessDocument = {
      _id: bsonUUID(id),
      scenario: bsonUUID(instantiateEvent.scenario),
      ...rest,
    };

    await this.collection.insertOne(doc);
  }

  isActor(process: Process, userId: string): boolean {
    return Object.entries(process.actors).some(([, { id }]) => id === userId);
  }

  determineActor(process: Process, action: string, userId?: string): string | undefined {
    const possibleActors = userId
      ? Object.entries(process.actors)
          .filter(([, { id }]) => id === userId)
          .map(([key]) => key)
      : Object.keys(process.actors);

    const actors = process.scenario.actions[action].actor.filter((actor) => possibleActors.includes(actor));

    return actors[0];
  }
}
