import { Action, etag, Process } from '@letsflow/core/process';

interface StandardMessage {
  process: string;
  action?: Action;
  etag: string;
}

export function createMessage(process: Process, action?: string | Action): StandardMessage {
  if (typeof action === 'string') {
    const key = action;
    action = process.current.actions.find((a) => a.key === action);

    if (!action) {
      throw new Error(`Action ${key} not found in state ${process.current.key} of process ${process.id}`);
    }
  }

  return {
    process: process.id,
    action,
    etag: etag(process),
  };
}
