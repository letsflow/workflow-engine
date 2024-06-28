import { Injectable } from '@nestjs/common';
import { Process, Action, etag } from '@letsflow/core/process';

@Injectable()
export class NotifyMessageService {
  create(process: Process, action?: string | Action): string {
    if (typeof action === 'string') {
      const key = action;
      action = process.current.actions.find((a) => a.key === action);

      if (!action) {
        throw new Error(`Action ${key} not found in state ${process.current.key} of process ${process.id}`);
      }
    }

    const message = {
      process: process.id,
      action,
      timestamp: new Date(),
      etag: etag(process),
    };

    return JSON.stringify(message);
  }
}
