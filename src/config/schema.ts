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
  jwt: {
    issuer: {
      default: '',
      env: 'JWT_ISSUER',
    },
    publicKey: {
      default: '',
      env: 'JWT_PUBLIC_KEY',
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
  notificationMethods: {
    doc: 'Dictionary of notification methods',
    format: Object,
    default: {},
  },
};
