import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

type privileges =
  | 'scenario:list'
  | 'scenario:get'
  | 'scenario:add'
  | 'scenario:disable'
  | 'schema:list'
  | 'schema:get'
  | 'schema:add'
  | 'trigger:list'
  | 'trigger:get'
  | 'trigger:add'
  | 'trigger:delete'
  | 'apikey:issue'
  | 'apikey:revoke'
  | 'process:list'
  | 'process:get'
  | 'process:start'
  | 'process:step'
  | 'process:delete';

export class ApiKeySummary {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  description: string;

  @ApiProperty()
  issued: Date;

  @ApiProperty()
  expiration: Date;

  @ApiProperty()
  lastUsed: Date;

  @ApiProperty()
  revoked: Date;
}

export class ApiKey {
  constructor(data: Partial<ApiKey>) {
    Object.assign(this, data);
  }

  @ApiProperty({ readOnly: true })
  id: string;

  @ApiProperty({ readOnly: true })
  token: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  description = '';

  @ApiProperty({ readOnly: true })
  issued: Date;

  @ApiProperty()
  expirationDays?: number;

  @ApiProperty()
  expiration?: Date;

  @ApiProperty({ readOnly: true })
  lastUsed?: Date;

  @ApiProperty({ readOnly: true })
  revoked?: Date;

  @ApiProperty()
  privileges: Array<privileges>;

  @ApiProperty({
    type: 'array',
    items: {
      type: 'object',
      properties: {
        scenario: { type: 'string', format: 'uuid' },
        actors: {
          type: 'array',
          items: { type: 'string' },
        },
        actions: {
          type: 'array',
          items: { type: 'string' },
        },
      },
    },
  })
  processes?: Array<{
    scenario: string;
    actors?: string[];
    actions?: string[];
  }>;

  isActive(): boolean {
    return !this.revoked && (!this.expiration || this.expiration > new Date());
  }
}
