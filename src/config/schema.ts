import convict from 'convict';

// Define custom format to handle comma-separated lists
convict.addFormat({
  name: 'comma-separated-list',
  validate: () => undefined,
  coerce: (val) => val.split(',').map((item: string) => item.trim()),
});

export default {
  env: {
    format: ['production', 'staging', 'development', 'test'],
    default: 'development',
    env: 'NODE_ENV',
  },
  port: {
    default: 80,
    env: 'PORT',
  },
  log: {
    level: {
      default: '',
      env: 'LOG_LEVEL',
    },
  },
  db: {
    default: 'mongodb://localhost:27017/letsflow',
    env: 'DB',
  },
  summeryFields: {
    scenario: {
      doc: 'Custom fields of a scenario that should be returned when listing',
      default: [] as string[],
      format: 'comma-separated-list',
      env: 'ADDITIONAL_SCENARIO_SUMMERY_FIELDS',
    },
    process: {
      doc: 'Custom fields of a process that should be returned when listing',
      default: [] as string[],
      format: 'comma-separated-list',
      env: 'ADDITIONAL_PROCESS_SUMMERY_FIELDS',
    },
  },
  jwt: {
    issuer: {
      default: '',
      env: 'JWT_ISSUER',
    },
    publicKey: {
      default: '',
      env: 'JWT_PUBLIC_KEY',
    },
    transform: {
      default: '',
      env: 'JWT_TRANSFORM',
    },
  },
  auth: {
    adminRole: {
      default: 'admin',
      env: 'AUTH_ADMIN_ROLE',
    },
  },
  dev: {
    demoAccounts: {
      default: false,
      env: 'DEMO_ACCOUNTS',
    },
    defaultAccount: {
      default: '',
      env: 'DEFAULT_ACCOUNT',
    },
  },
  services: {
    doc: 'Dictionary of services and workers',
    format: Object,
    default: {},
  },
};
