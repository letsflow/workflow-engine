import { ApiProperty } from '@nestjs/swagger';

export class ScenarioSummary {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  description: string;

  @ApiProperty()
  disabled: boolean;
}
