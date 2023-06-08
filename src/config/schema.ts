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
  paths: {
    scenarios: {
      default: 'storage/scenarios',
      env: 'SCENARIO_PATH',
    },
  },
};
