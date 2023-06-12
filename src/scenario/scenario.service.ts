import { Injectable, OnModuleInit } from '@nestjs/common';
import { normalize, uuid, Scenario, NormalizedScenario } from '@letsflow/api';
import { ScenarioSummary } from './scenario.dto';
import { Collection, Db } from 'mongodb';
import { MUUID, from as bsonUUID } from 'uuid-mongodb';
import { validate as validateUUID } from 'uuid';

export type ScenarioDocument = NormalizedScenario & { _id: MUUID; _disabled: boolean };

@Injectable()
export class ScenarioService implements OnModuleInit {
  private scenarios: Collection<ScenarioDocument>;

  constructor(private db: Db) {}

  async onModuleInit() {
    this.scenarios = await this.db.collection<ScenarioDocument>('scenarios');
  }

  async list(): Promise<ScenarioSummary[]> {
    const documents = await this.scenarios
      .find({ _disabled: false }, { sort: { title: 1 }, projection: { _id: 1, title: 1, description: 1 } })
      .toArray();

    return documents.map(({ _id, title, description }) => ({ id: _id.toString(), title, description }));
  }

  async has(id: string): Promise<boolean> {
    if (!validateUUID(id)) return false;

    return (await this.db.collection('scenarios').countDocuments({ _id: bsonUUID(id) })) > 0;
  }

  async get(id: string): Promise<NormalizedScenario & { _disabled: boolean }> {
    if (!validateUUID(id)) throw new Error('Invalid scenario ID');

    const scenario = await this.scenarios.findOne({ _id: bsonUUID(id) }, { projection: { _id: 0 } });
    if (!scenario) throw new Error('Scenario not found');

    return scenario;
  }

  async store(scenario: Scenario): Promise<string> {
    const normalized = normalize(scenario);
    const id = uuid(normalized);

    // The scenario has fields that are prefixed with a `$`, so `replaceOne` cannot be used.
    if (await this.has(id)) {
      await this.scenarios.updateOne({ _id: bsonUUID(id) }, { $set: { _disabled: false } });
    } else {
      await this.scenarios.insertOne({ ...normalized, _id: bsonUUID(id), _disabled: false });
    }

    return id;
  }

  async disable(id: string): Promise<void> {
    if (!validateUUID(id)) throw new Error('Invalid scenario ID');

    const updated = await this.scenarios.updateOne({ _id: bsonUUID(id) }, { $set: { _disabled: true } });
    if (updated.matchedCount === 0) throw new Error('Scenario not found');
  }
}
