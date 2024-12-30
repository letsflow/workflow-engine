import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ScenarioSummary {
  @ApiProperty()
  id: string;

  @ApiPropertyOptional()
  name?: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  description: string;

  [key: string]: any;
}
