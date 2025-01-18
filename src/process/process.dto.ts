import { ApiExtraModels, ApiProperty, ApiPropertyOptional, getSchemaPath } from '@nestjs/swagger';
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

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
  })
  response?: Record<string, any>;
}

@ApiExtraModels(ProcessActor)
export class StartInstructions {
  @ApiProperty()
  scenario: string;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: {
      allOf: [
        { $ref: getSchemaPath(ProcessActor) },
        {
          type: 'object',
          additionalProperties: true,
        },
      ],
    },
  })
  actors?: Record<string, Omit<ProcessActor, 'title'>>;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
  })
  vars?: Record<string, any>;

  @ApiPropertyOptional()
  action?: StartAction | string;
}
