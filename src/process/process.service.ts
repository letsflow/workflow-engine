import { Injectable } from '@nestjs/common';
import { ProcessSummary, StartInstructions } from './process.dto';
import { ScenarioService } from '../scenario/scenario.service';
import { Collection, Db } from 'mongodb';
import { from as bsonUUID, MUUID } from 'uuid-mongodb';
import { instantiate, Process, step } from '@letsflow/core/process';
import { NotifyService } from '../notify/notify.service';
import { ConfigService } from '../common/config/config.service';

type ProcessDocument = Omit<Process, 'id' | 'scenario'> & { _id: MUUID; scenario: MUUID };

interface ListOptions {
  sort?: string[];
  page?: number;
  limit?: number;
}

@Injectable()
export class ProcessService {
  private collection: Collection<ProcessDocument>;
  private summeryProjection: Record<string, number> = {
    _id: 1,
    title: 1,
    tags: 1,
    scenario: 1,
    actors: 1,
    created: 1,
    lastUpdated: 1,
  };
  private scenarioSummeryProjection: Record<string, number> = { _id: 1, title: 1, description: 1 };

  constructor(
    private scenarios: ScenarioService,
    private db: Db,
    private notify: NotifyService,
    private config: ConfigService,
  ) {}

  onModuleInit() {
    this.summeryProjection = {
      ...this.summeryProjection,
      ...Object.fromEntries(this.config.get('process.summeryFields').map((key: string) => [key, 1])),
    };
    this.scenarioSummeryProjection = {
      ...this.scenarioSummeryProjection,
      ...Object.fromEntries(this.config.get('scenario.summeryFields').map((key: string) => [key, 1])),
    };

    this.collection = this.db.collection<ProcessDocument>('processes');
  }

  async list({ sort, page, limit }: ListOptions = {}): Promise<ProcessSummary[]> {
    return await this.collection
      .aggregate([
        {
          $lookup: {
            from: 'scenarios',
            localField: 'scenario',
            foreignField: '_id',
            as: 'scenario',
            pipeline: [{ $project: this.scenarioSummeryProjection }],
          },
        },
        {
          $unwind: '$scenario',
        },
        {
          $addFields: {
            created: { $arrayElemAt: ['$events.timestamp', 0] },
            lastUpdated: { $arrayElemAt: ['$events.timestamp', -1] },
            isFinished: { $eq: [{ $type: '$current.transactions' }, 'missing'] },
          },
        },
        { $project: { ...this.summeryProjection } },
        { $sort: Object.fromEntries((sort ?? ['title']).map((key) => [key, 1])) },
        { $skip: (page ?? 0) * (limit ?? 0) },
        { $limit: limit ?? 0 },
      ])
      .map(({ _id, scenario, ...processProps }) => {
        if (scenario /* Just in case the data is corrupt and the scenario is not found */) {
          const { _id: scenarioId, ...scenarioProps } = scenario;
          scenario = { id: scenarioId.toString(), ...scenarioProps };
        }

        return {
          id: _id.toString(),
          scenario,
          ...processProps,
        } as ProcessSummary;
      })
      .toArray();
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

    return { id, scenario: { id: scenarioId?.toString(), ...scenario }, ...rest };
  }

  private async save(process: Process) {
    const {
      id,
      scenario: { id: scenarioId, ..._ },
      ...rest
    } = process;

    const doc: ProcessDocument = {
      _id: bsonUUID(id),
      scenario: bsonUUID(scenarioId),
      ...rest,
    };

    await this.collection.replaceOne({ _id: doc._id }, doc, { upsert: true });
  }

  isActor(process: Process, userId: string): boolean {
    return Object.entries(process.actors).some(([, { id }]) => id === userId);
  }

  determineActor(process: Process, action: string, userId?: string): string | undefined {
    if (!(action in process.current.actions)) {
      throw new Error(`Unable to determine actor: Action '${action}' is not available in the current state`);
    }

    const possibleActors = userId
      ? Object.entries(process.actors)
          .filter(([, { id }]) => id === userId)
          .map(([key]) => key)
      : Object.keys(process.actors);

    const actors = process.current.actions[action].actor.filter((actor: string) => possibleActors.includes(actor));

    return actors[0];
  }

  async step(process: Process, action: string, actor: string, response?: any): Promise<void> {
    if (!(action in process.current.actions)) {
      throw new Error('Unknown action for this process');
    }

    const updatedProcess = step(process, action, actor, response);
    await this.save(updatedProcess);

    await this.notify.invoke(updatedProcess);
  }
}
