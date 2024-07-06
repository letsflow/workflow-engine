import { Injectable, OnModuleInit } from '@nestjs/common';
import { uuid } from '@letsflow/core';
import { normalize, Scenario, NormalizedScenario } from '@letsflow/core/scenario';
import { ScenarioSummary } from './scenario.dto';
import { Collection, Db } from 'mongodb';
import { MUUID, from as bsonUUID } from 'uuid-mongodb';
import { validate as validateUUID } from 'uuid';
import { ConfigService } from '../common/config/config.service';

export type ScenarioDocument = NormalizedScenario & { _id: MUUID; _disabled: boolean };

@Injectable()
export class ScenarioService implements OnModuleInit {
  private collection: Collection<ScenarioDocument>;
  private summeryProjection: Record<string, number> = { _id: 1, title: 1, description: 1, tags: 1 };

  constructor(
    private db: Db,
    private config: ConfigService,
  ) {}

  onModuleInit() {
    this.summeryProjection = {
      ...this.summeryProjection,
      ...Object.fromEntries(this.config.get('summeryFields.scenario').map((key: string) => [key, 1])),
    };

    this.collection = this.db.collection<ScenarioDocument>('scenarios');
  }

  async list(): Promise<ScenarioSummary[]> {
    return await this.collection
      .find({ _disabled: false }, { sort: { title: 1 }, projection: this.summeryProjection })
      .map(({ _id, ...rest }) => ({ id: _id.toString(), ...rest }) as ScenarioSummary)
      .toArray();
  }

  async has(id: string): Promise<boolean> {
    if (!validateUUID(id)) return false;

    return (await this.db.collection('scenarios').countDocuments({ _id: bsonUUID(id) })) > 0;
  }

  async get(id: string): Promise<NormalizedScenario & { _disabled: boolean }> {
    if (!validateUUID(id)) throw new Error('Invalid scenario ID');

    const scenario = await this.collection.findOne({ _id: bsonUUID(id) }, { projection: { _id: 0 } });
    if (!scenario) throw new Error('Scenario not found');

    return scenario;
  }

  async store(scenario: Scenario): Promise<string> {
    const normalized = normalize(scenario);
    const id = uuid(normalized);

    // The scenario has fields that are prefixed with a `$`, so `replaceOne` cannot be used.
    if (await this.has(id)) {
      await this.collection.updateOne({ _id: bsonUUID(id) }, { $set: { _disabled: false } });
    } else {
      await this.collection.insertOne({ ...normalized, _id: bsonUUID(id), _disabled: false });
    }

    return id;
  }

  async disable(id: string): Promise<void> {
    if (!validateUUID(id)) throw new Error('Invalid scenario ID');

    const updated = await this.collection.updateOne({ _id: bsonUUID(id) }, { $set: { _disabled: true } });
    if (updated.matchedCount === 0) throw new Error('Scenario not found');
  }
}
