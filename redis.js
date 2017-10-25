const Redis = require('ioredis');
const config = require('./config');

// Setup the redis client.
const redis = new Redis(config.get('redis_url'));

module.exports = redis;
