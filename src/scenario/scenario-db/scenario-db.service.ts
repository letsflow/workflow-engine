import { Injectable, OnModuleInit } from '@nestjs/common';
import { uuid } from '@letsflow/core';
import { normalize, NormalizedScenario, Scenario } from '@letsflow/core/scenario';
import { ScenarioSummary } from '../scenario.dto';
import { Collection, Db } from 'mongodb';
import { from as bsonUUID, MUUID } from 'uuid-mongodb';
import { validate as validateUUID } from 'uuid';
import { ConfigService } from '@/common/config/config.service';
import { ScenarioService } from '../scenario.service';

export type ScenarioDocument = NormalizedScenario & { _id: MUUID; _disabled: boolean };

@Injectable()
export class ScenarioDbService extends ScenarioService implements OnModuleInit {
  private collection: Collection<ScenarioDocument>;
  private summeryProjection: Record<string, number> = { _id: 1, title: 1, description: 1, tags: 1 };

  constructor(
    private readonly db: Db,
    private readonly config: ConfigService,
  ) {
    super();
  }

  onModuleInit() {
    this.isReadOnly = this.config.get('scenario.readOnly');

    this.summeryProjection = {
      ...this.summeryProjection,
      ...Object.fromEntries(this.config.get('scenario.summeryFields').map((key: string) => [key, 1])),
    };

    this.collection = this.db.collection<ScenarioDocument>('scenarios');
  }

  async list(): Promise<ScenarioSummary[]> {
    return await this.collection
      .find({ _disabled: false }, { sort: { title: 1 }, projection: this.summeryProjection })
      .map(({ _id, ...rest }) => ({ id: _id.toString(), ...rest }) as ScenarioSummary)
      .toArray();
  }

  async getIds(references: string[]): Promise<string[]> {
    const ids = references.filter(validateUUID).map(bsonUUID);
    const names = references.filter((reference) => !validateUUID(reference));

    return await this.collection
      .find({ $or: [{ _id: { $in: ids } }, { name: { $in: names } }] }, { projection: { _id: 1 } })
      .map(({ _id }) => _id.toString())
      .toArray();
  }

  async has(id: string): Promise<boolean> {
    if (!validateUUID(id)) return false;

    return (await this.db.collection('scenarios').countDocuments({ _id: bsonUUID(id) })) > 0;
  }

  async getStatus(id: string): Promise<'not-found' | 'disabled' | 'available'> {
    if (!validateUUID(id)) return 'not-found';

    const scenario = await this.collection.findOne({ _id: bsonUUID(id) }, { projection: { _disabled: 1 } });
    if (!scenario) return 'not-found';

    return scenario._disabled ? 'disabled' : 'available';
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
