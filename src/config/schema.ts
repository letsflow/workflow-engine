import convict from 'convict';
import { JwtSignOptions, JwtVerifyOptions } from '@nestjs/jwt';
import { Privilege } from '@/auth/privileges';

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
  apiDocs: {
    enabled: {
      default: false,
      env: 'API_DOCS_ENABLED',
    },
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
  scenario: {
    storage: {
      default: 'fs' as 'fs' | 'db',
      env: 'SCENARIO_STORAGE',
    },
    path: {
      default: './scenarios',
      env: 'SCENARIO_PATH',
    },
    readOnly: {
      default: true,
      env: 'SCENARIO_READONLY',
    },
    summeryFields: {
      doc: 'Custom fields of a scenario that should be returned when listing',
      default: [] as string[],
      format: 'comma-separated-list',
      env: 'SCENARIO_ADDITIONAL_SUMMERY_FIELDS',
    },
  },
  process: {
    summeryFields: {
      doc: 'Custom fields of a process that should be returned when listing',
      default: [] as string[],
      format: 'comma-separated-list',
      env: 'PROCESS_ADDITIONAL_SUMMERY_FIELDS',
    },
  },
  schema: {
    path: {
      default: './schemas',
      env: 'SCHEMA_PATH',
    },
    fetch: {
      enabled: {
        default: true,
        env: 'SCHEMA_FETCH_ENABLED',
      },
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
    secret: {
      default: '',
    },
    signOptions: {
      default: {} as JwtSignOptions,
    },
    verifyOptions: {
      default: {} as JwtVerifyOptions,
    },
  },
  auth: {
    roles: {
      docs: 'Privileges per role',
      format: Object,
      default: {
        admin: ['*'],
        '*': ['process:start', 'process:step'],
      } as Record<string, Privilege[]>,
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
  decentralized: {
    enabled: {
      default: false,
      env: 'DECENTRALIZED_ENABLED',
    },
  },
  lto: {
    relay: {
      default: '',
      env: 'LTO_RELAY',
    },
    node: {
      url: {
        default: '',
        env: 'LTO_NODE',
      },
      apiKey: {
        default: '',
        env: 'LTO_NODE_API_KEY',
      },
    },
    networkId: {
      default: 'T',
      env: 'LTO_NETWORK',
    },
    account: {
      seed: {
        default: '',
        env: 'LTO_ACCOUNT_SEED',
      },
      keyType: {
        default: 'ed25519' as 'ed255119' | 'secp256k1',
        env: 'LTO_ACCOUNT_KEY_TYPE',
      },
      nonce: {
        default: 0,
        env: 'LTO_ACCOUNT_NONCE',
      },
    },
  },
};
