import { Injectable, OnModuleInit } from '@nestjs/common';
import { normalize, uuid, Scenario, NormalizedScenario } from '@letsflow/api';
import { ScenarioSummary } from './scenario.dto';
import { Collection, Db } from 'mongodb';
import { MUUID, from as bsonUUID } from 'uuid-mongodb';

export type ScenarioDocument = NormalizedScenario & { _id: MUUID; disabled: boolean };

@Injectable()
export class ScenarioService implements OnModuleInit {
  private scenarios: Collection<ScenarioDocument>;

  constructor(private db: Db) {}

  async onModuleInit() {
    this.scenarios = await this.db.collection<ScenarioDocument>('scenarios');
  }

  async list(): Promise<ScenarioSummary[]> {
    const documents = await this.scenarios
      .find({ disabled: false }, { sort: { title: 1 }, projection: { _id: 1, title: 1, description: 1 } })
      .toArray();

    return documents.map(({ _id, title, description }) => ({ id: _id.toString(), title, description }));
  }

  async has(id: string): Promise<boolean> {
    return (await this.db.collection('scenarios').countDocuments({ _id: bsonUUID(id) })) > 0;
  }

  async get(id: string): Promise<ScenarioDocument> {
    const scenario = await this.scenarios.findOne({ _id: bsonUUID(id) });
    if (!scenario) throw new Error('Scenario not found');

    return scenario;
  }

  async store(scenario: Scenario): Promise<string> {
    const normalized = normalize(scenario);
    const id = uuid(normalized);

    await this.scenarios.replaceOne({ _id: bsonUUID(id) }, { ...normalized, disabled: false });

    return id;
  }

  async disable(id: string): Promise<void> {
    const updated = await this.scenarios.updateOne({ _id: bsonUUID(id) }, { $set: { disabled: true } });

    if (updated.matchedCount === 0) throw new Error('Scenario not found');
  }
}
