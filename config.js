// Load any .env file from the filesystem into the environment.
require('dotenv').config();

const convict = require('convict');

// Load the configuration.
const config = convict({
  host: {
    doc: 'The interface to bind the application to',
    format: 'ipaddress',
    default: '127.0.0.1',
    env: 'HOST',
  },
  env: {
    doc: 'The NODE_ENV environment',
    format: ['production', 'development'],
    default: 'development',
    env: 'NODE_ENV',
  },
  verbose_logs: {
    doc: 'Enables verbose logging',
    format: 'Boolean',
    env: 'VERBOSE_LOGS',
    default: true,
  },
  port: {
    doc: 'The port to bind the application to',
    format: 'port_or_windows_named_pipe',
    default: 5000,
    env: 'PORT',
  },
  session_secret: {
    doc: 'The secret used to sign cookies and tokens',
    format: '*',
    env: 'SESSION_SECRET',
    default: null,
  },
  mongo_url: {
    doc: 'URL to the MongoDB instance',
    format: '*',
    env: 'MONGO_URL',
    default: 'mongodb://localhost:27017/coralproject_slack',
  },
  redis_url: {
    doc: 'URL to the Redis instance',
    format: '*',
    env: 'REDIS_URL',
    default: 'redis://localhost:6379',
  },
  root_url: {
    doc:
      'Public facing url where the application is hosted, with scheme and trailing slash',
    format: 'url',
    env: 'ROOT_URL',
    default: 'http://127.0.0.1:5000/',
  },
  slack: {
    app_id: {
      format: '*',
      env: 'SLACK_APP_ID',
      default: null,
    },
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
  enable_metrics: {
    format: Boolean,
    env: 'ENABLE_METRICS',
    default: true,
  },
});

config.validate({ allowed: 'strict' });

module.exports = config;
