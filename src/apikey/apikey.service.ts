import * as crypto from 'crypto';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { encode } from '@/common/utils/base62';
import { ApiKey } from './apikey.dto';
import { Collection, Db, ObjectId, WithId } from 'mongodb';
import crc32 from 'buffer-crc32';

type ApiKeyDocument = Omit<ApiKey, 'id' | 'expirationDays' | 'isActive'>;

@Injectable()
export class ApiKeyService implements OnModuleInit {
  private collection: Collection<ApiKeyDocument>;

  constructor(private db: Db) {}

  onModuleInit() {
    this.collection = this.db.collection<ApiKeyDocument>('apikeys');
  }

  async list(): Promise<ApiKey[]> {
    const projection = { token: 0 };

    const docs = this.collection.find<WithId<ApiKeyDocument>>({}, { projection });
    return await docs.map(({ _id, ...rest }) => new ApiKey({ id: _id.toHexString(), ...rest })).toArray();
  }

  async issue(input: Partial<ApiKey>): Promise<ApiKey> {
    if (!input.name) throw new Error('Name is required');

    const issued = new Date();

    const apiKey: ApiKeyDocument = {
      token: this.generate(),
      name: input.name,
      description: input.description,
      issued,
      expiration: input.expiration
        ? new Date(input.expiration)
        : this.determineExpiration(issued, input.expirationDays),
      privileges: input.privileges ?? [],
      service: input.service,
    };

    const result = await this.collection.insertOne(apiKey);

    return new ApiKey({ id: result.insertedId.toHexString(), ...apiKey });
  }

  private determineExpiration(issued: Date, days: number = 30): Date {
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

  private generate(): string {
    const random = encode(crypto.randomBytes(24)).slice(-30);
    const checksum = ('000000' + encode(crc32(random))).slice(-6);

    return 'lfl_' + random + checksum;
  }
}
