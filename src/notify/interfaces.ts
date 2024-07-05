import { Process } from '@letsflow/core/process';

export interface NotifyProvider {
  notify: (process: Process, args: Record<string, any>) => Promise<void>;
}
