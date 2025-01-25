import { ApiExtraModels, ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ScenarioSummary } from '@/scenario/scenario.dto';

export class ProcessSummary {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  scenario: ScenarioSummary;

  @ApiProperty()
  actors: Array<ProcessActor>;

  @ApiProperty()
  created: Date;

  @ApiProperty()
  lastUpdated: Date;
}

export class ProcessActor {
  @ApiProperty()
  id?: string;

  @ApiProperty()
  title: string;

  [key: string]: any;
}

export class StartAction {
  @ApiProperty()
  key: string;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
  })
  response?: any;
}

@ApiExtraModels(ProcessActor)
export class StartInstructions {
  @ApiProperty()
  scenario: string;

  @ApiProperty()
  action: StartAction | string;
}
