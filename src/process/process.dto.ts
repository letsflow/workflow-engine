import { ApiExtraModels, ApiProperty, ApiPropertyOptional, getSchemaPath } from '@nestjs/swagger';

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

  @ApiPropertyOptional()
  action?: StartAction | string;
}
