export const privileges = [
  '*',
  'scenario:read',
  'scenario:write',
  'apikey:issue',
  'apikey:revoke',
  'process:super',
  'process:create',
  'process:start',
  'process:step',
] as const;

export type Privilege = (typeof privileges)[number];
