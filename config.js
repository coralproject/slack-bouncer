// Load any .env file from the filesystem into the environment.
require('dotenv').config();

const convict = require('convict');

// Load the configuration.
const config = convict({
  host: {
    format: 'ipaddress',
    default: '127.0.0.1',
    env: 'HOST',
  },
  env: {
    format: ['production', 'development'],
    default: 'development',
    env: 'NODE_ENV',
  },
  verbose_logs: {
    format: 'Boolean',
    env: 'VERBOSE_LOGS',
    default: true,
  },
  port: {
    format: 'port_or_windows_named_pipe',
    default: 5000,
    env: 'PORT',
  },
  session_secret: {
    format: '*',
    env: 'SESSION_SECRET',
    default: null,
  },
  mongo_url: {
    format: '*',
    env: 'MONGO_URL',
    default: 'mongodb://localhost:27017/coralproject_slack',
  },
  redis_url: {
    format: '*',
    env: 'REDIS_URL',
    default: 'redis://localhost:6379',
  },
  root_url: {
    format: 'url',
    env: 'ROOT_URL',
    default: 'http://127.0.0.1:5000/',
  },
  slack: {
    client_id: {
      format: '*',
      env: 'SLACK_CLIENT_ID',
      default: null,
    },
    client_secret: {
      sensitive: true,
      format: '*',
      env: 'SLACK_CLIENT_SECRET',
      default: null,
    },
    verification_token: {
      sensitive: true,
      format: '*',
      env: 'SLACK_VERIFICATION_TOKEN',
      default: null,
    },
  },
  pubsub_topic: {
    format: '*',
    env: 'PUBSUB_TOPIC',
    default: null,
  },
  pubsub_topic_subscription: {
    format: '*',
    env: 'PUBSUB_TOPIC_SUBSCRIPTION',
    default: null,
  },
  injestion_url: {
    format: 'url',
    env: 'INJESTION_URL',
    default: null,
  },
  client_semver: {
    format: '*',
    env: 'CLIENT_SEMVER',
    default: null,
  },
  client_signing_token: {
    format: '*',
    env: 'CLIENT_SIGNING_TOKEN',
    default: null,
  },
});

config.validate({ allowed: 'strict' });

module.exports = config;
