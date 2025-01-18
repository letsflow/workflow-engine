import { ApiKey as FullApiKey } from '@/apikey';

export type ApiKey = Pick<FullApiKey, 'privileges' | 'processes'>;

export interface Account {
  id: string;
  roles: Array<string>;
  token: string;
  info: Record<string, any>;
}
