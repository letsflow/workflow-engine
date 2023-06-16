import * as crypto from 'crypto';
import { Injectable } from '@nestjs/common';
import { encode } from '../util/base62';
import { ApiKey, ApiKeySummary } from './apikey.dto';
import { Collection, Db, ObjectId, WithId } from 'mongodb';
import crc32 from 'buffer-crc32';

type ApiKeySummaryDocument = WithId<Omit<ApiKeySummary, 'id'>>;

@Injectable()
export class ApikeyService {
  private collection: Collection<ApiKey>;

  constructor(private db: Db) {}

  async onModuleInit() {
    this.collection = await this.db.collection<ApiKey>('apikeys');
  }

  async list(): Promise<ApiKeySummary[]> {
    const projection = {
      _id: 1,
      name: 1,
      description: 1,
      issued: 1,
      expiration: 1,
      lastUsed: 1,
      revoked: 1,
    };

    const docs = await this.collection.find<ApiKeySummaryDocument>({}, { projection });
    return docs.map(({ _id, ...rest }) => ({ id: _id.toHexString(), ...rest })).toArray();
  }

  async issue(input: Partial<ApiKey>): Promise<ApiKey> {
    if (!input.name) throw new Error('Name is required');

    const issued = new Date();

    const apiKey = new ApiKey({
      token: this.generate(),
      name: input.name,
      description: input.description,
      issued,
      expiration: input.expiration ?? this.determineExpiration(issued, input.expirationDays),
      privileges: input.privileges ?? [],
      processes: input.processes,
    });

    await this.collection.insertOne(apiKey);

    return apiKey;
  }

  private determineExpiration(issued: Date, days?: number): Date {
    if (days === undefined) return undefined;

    const expiration = new Date(issued);
    expiration.setDate(issued.getDate() + days);

    return expiration;
  }

  async get(id: string): Promise<ApiKey> {
    const doc = await this.collection.findOne({ _id: new ObjectId(id) }, { projection: { token: 0 } });
    if (!doc) throw new Error("API Key doesn't exist");

    const { _id, ...rest } = doc;

    return new ApiKey({ id: _id.toHexString(), ...rest });
  }

  async revoke(id: string) {
    const result = await this.collection.updateOne({ _id: new ObjectId(id) }, { $set: { revoked: new Date() } });

    if (result.matchedCount === 0) {
      throw new Error("API Key doesn't exist");
    }
  }

  async used(token: string) {
    await this.collection.updateOne({ token }, { $set: { lastUsed: new Date() } });
  }

  private generate(): string {
    const random = encode(crypto.randomBytes(24)).slice(-30);
    const checksum = ('000000' + encode(crc32(random))).slice(-6);

    return 'lfl_' + random + checksum;
  }
}
