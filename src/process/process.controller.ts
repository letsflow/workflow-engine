import { Body, Controller, Param, Post, Res, Headers, UseGuards } from '@nestjs/common';
import { ProcessService } from './process.service';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { StartInstructions } from './process.dto';
import { Response } from 'express';
import { ValidationService } from './validation/validation.service';
import { AuthGuard, AuthUser } from '../common/auth';

@ApiBearerAuth()
@UseGuards(AuthGuard)
@ApiTags('process')
@Controller('processes')
export class ProcessController {
  public constructor(private service: ProcessService, private validation: ValidationService) {}

  @ApiOperation({ summary: 'Start a process' })
  @ApiConsumes('application/json')
  @ApiBody({ required: true, type: StartInstructions })
  @ApiResponse({ status: 201, description: 'Created' })
  @Post()
  public async start(@Body() instructions: StartInstructions, @Res() res: Response): Promise<void> {
    const errors = await this.validation.instantiate(instructions);
    if (errors.length > 0) {
      res.status(400).json(errors);
      return;
    }

    const process = await this.service.start(instructions);

    res.status(201).header('Location', `/processes/${process.id}`).json(process);
  }

  @ApiOperation({ summary: 'Step through a process' })
  @ApiParam({ name: 'id', description: 'Process ID', format: 'uuid' })
  @ApiParam({ name: 'action', description: 'Process action' })
  @ApiHeader({ name: 'X-Actor', description: 'Actor key', required: false })
  @ApiResponse({ status: 200, description: 'Ok' })
  @Post(':id/:action')
  public async step(
    @Param('id') id: string,
    @Param('action') action: string,
    @Headers('X-Actor') actor: string | undefined,
    @AuthUser() user: { id: string },
    @Body() body: any,
    @Res() res: Response,
  ): Promise<void> {
    if (!(await this.service.has(id))) {
      res.status(404).send('Process not found');
      return;
    }

    const process = await this.service.get(id);

    if (!(action in process.scenario.actions)) {
      res.status(404).send('Unknown action for this process');
      return;
    }

    actor ||= this.service.determineActor(process, action, user.id);

    if (!this.validation.isAuthorized(process, action, actor)) {
      res.status(401).send('Unauthorized');
      return;
    }

    const errors = await this.validation.step(process, action, actor);
    if (errors.length > 0) {
      res.status(400).json(errors);
      return;
    }

    res.status(201).header('Location', `/processes/${id}`).send();
  }
}
