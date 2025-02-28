import { Privilege, privileges } from '@/auth/privileges';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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
    type: 'array',
    items: { type: 'string', enum: privileges as any },
  })
  privileges: Array<Privilege>;

  @ApiProperty()
  service?: string;

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

  @ApiProperty()
  service?: string;
}
