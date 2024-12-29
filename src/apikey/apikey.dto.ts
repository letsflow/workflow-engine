import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const privileges = [
  'scenario:list',
  'scenario:get',
  'scenario:store',
  'scenario:disable',
  'apikey:issue',
  'apikey:revoke',
  'process:list',
  'process:get',
  'process:start',
  'process:step',
] as const;

type Privilege = (typeof privileges)[number];

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

  @ApiProperty({
    enum: privileges,
    type: 'array',
    items: { type: 'string' },
  })
  privileges: Array<Privilege>;

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

export class IssueApiKeyDto {
  @ApiProperty({ required: true })
  name: string;

  @ApiProperty()
  description: string = '';

  @ApiProperty({
    type: 'array',
    items: { type: 'string', enum: privileges as any },
    required: true,
  })
  privileges: Array<Privilege>;

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
}
