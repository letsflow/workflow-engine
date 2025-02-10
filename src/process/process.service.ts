import { Injectable, Logger } from '@nestjs/common';
import { ProcessSummary } from './process.dto';
import { ScenarioService } from '@/scenario/scenario.service';
import { Collection, Db } from 'mongodb';
import { from as bsonUUID, MUUID } from 'uuid-mongodb';
import { Actor, instantiate, predict, PredictedState, Process, step } from '@letsflow/core/process';
import { ConfigService } from '@/common/config/config.service';
import { ScenarioDbService } from '@/scenario/scenario-db/scenario-db.service';
import { ScenarioFsService } from '@/scenario/scenario-fs/scenario-fs.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Account } from '@/auth';
import { NormalizedScenario } from '@letsflow/core/scenario';

type ProcessDocument = Omit<Process, 'id' | 'scenario' | 'actors'> & {
  _id: MUUID;
  scenario: MUUID;
  actors: Array<Actor & { _key: string }>;
};

export interface ListOptions {
  scenarios?: string[];
  actors?: Array<{ id: string } | { role: string }>;
  sort?: string[];
  page?: number;
  limit?: number;
}

export interface StepActor {
  key: string;
  id?: string;
  roles?: string[];

  [_: string]: any;
}

@Injectable()
export class ProcessService {
  private logger = new Logger(ProcessService.name);
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
    private eventEmitter: EventEmitter2,
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

  async list({ scenarios, actors, sort, page, limit }: ListOptions = {}): Promise<ProcessSummary[]> {
    const stages = [];

    if (scenarios) {
      const scenarioIds = await this.scenarios.getIds(scenarios);
      stages.push({ $match: { scenario: { $in: scenarioIds.map(bsonUUID) } } });
    }

    if (actors) {
      stages.push({
        $match: {
          actors: {
            $elemMatch: {
              $or: actors.map((actor) => ('id' in actor ? { id: actor.id } : { role: actor.role })),
            },
          },
        },
      });
    }

    if (this.scenarios instanceof ScenarioDbService) {
      stages.push(
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
      );
    }

    const processes = this.collection
      .aggregate([
        ...stages,
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
        if (typeof scenario === 'string') {
          scenario = { id: scenario };
        } else if (scenario) {
          const { _id: scenarioId, ...scenarioProps } = scenario;
          scenario = { id: scenarioId.toString(), ...scenarioProps };
        }

        return {
          id: _id.toString(),
          scenario,
          ...processProps,
        } as ProcessSummary;
      });

    if (this.scenarios instanceof ScenarioFsService) {
      processes.map(({ scenario, ...processProps }) => {
        const summary = (this.scenarios as ScenarioFsService).summary(scenario.id) ?? {};
        return {
          scenario: { id: scenario.id, ...summary },
          ...processProps,
        };
      });
    }

    return await processes.toArray();
  }

  instantiate(scenario: NormalizedScenario): Process {
    return instantiate(scenario);
  }

  predict(process: Process): Process & { next?: PredictedState[] } {
    try {
      return { ...process, next: predict(process) };
    } catch (error) {
      this.logger.warn(
        `Failed to predict next states of process ${process.id} with scenario ${process.scenario.id}: ${error}`,
      );
      return process;
    }
  }

  async has(id: string): Promise<boolean> {
    return (await this.collection.countDocuments({ _id: bsonUUID(id) })) > 0;
  }

  async get(id: string): Promise<Process> {
    const processDocument = await this.collection.findOne({ _id: bsonUUID(id) }, { projection: { _id: 0 } });
    if (!processDocument) throw new Error('Process not found');

    const { _id, scenario: scenarioId, actors, ...rest } = processDocument;
    const { _disabled: _ignore, ...scenario } = await this.scenarios.get(scenarioId.toString());

    return {
      id,
      scenario: { id: scenarioId?.toString(), ...scenario },
      actors: Object.fromEntries(actors.map(({ _key, ...actor }) => [_key, actor])),
      ...rest,
    };
  }

  async save(process: Process) {
    const {
      id,
      scenario: { id: scenarioId },
      actors,
      ...rest
    } = process;

    const doc: ProcessDocument = {
      _id: bsonUUID(id),
      scenario: bsonUUID(scenarioId),
      actors: Object.entries(actors).map(([key, actor]) => ({ _key: key, ...actor })),
      ...rest,
    };

    await this.collection.replaceOne({ _id: doc._id }, doc, { upsert: true });
  }

  async step(process: Process, action: string, actor: StepActor, response?: any): Promise<Process> {
    const updatedProcess = step(process, action, actor, response);
    await this.save(updatedProcess);

    if (process.current.timestamp.getTime() !== updatedProcess.current.timestamp.getTime()) {
      this.eventEmitter.emit('process.stepped', updatedProcess);
    }

    return updatedProcess;
  }

  async retry(process: Process, services?: string[]) {
    this.eventEmitter.emit('process.retry', { process, services });
  }

  private matchUser(actor: Pick<Actor, 'id' | 'role'>, user: Pick<Account, 'id' | 'roles'>): boolean {
    if (!actor.id && (!actor.role || actor.role.length === 0)) {
      return false;
    }

    return (
      actor.id === undefined ||
      actor.id === user.id ||
      (actor.role &&
        (typeof actor.role === 'string'
          ? user.roles.includes(actor.role)
          : user.roles.some((r) => actor.role.includes(r))))
    );
  }

  isActor(process: Process, user: Pick<Account, 'id' | 'roles'>): boolean {
    return Object.values(process.actors).some((actor) => this.matchUser(actor, user));
  }

  determineActor(process: Process, action: string, actor?: string, user?: Account): StepActor | null {
    if (actor) {
      // TODO; check if actor is allowed to perform action
      return { ...(user?.info ?? {}), id: user?.id, roles: user?.roles, key: actor };
    }

    const processAction = process.current.actions.find((a) => a.key === action);

    if (!processAction) {
      return null;
    }

    const possibleActors = user
      ? Object.entries(process.actors)
          .filter(([, actor]) => this.matchUser(actor, user))
          .map(([key]) => key)
      : Object.keys(process.actors);

    const foundActor: string = processAction.actor.find((actor: string) => possibleActors.includes(actor));

    return foundActor ? { ...(user?.info ?? {}), id: user?.id, roles: user?.roles, key: foundActor } : null;
  }
}
