const session = require('express-session');
const RedisStore = require('connect-redis')(session);
const config = require('../config');
const redis = require('../redis');

module.exports = session({
  store: new RedisStore({
    client: redis,
  }),
  secret: config.get('session_secret'),
  resave: false,
  saveUninitialized: false,
  unset: 'destroy',
  cookie: {
    secure: config.get('env') === 'production',
    maxAge: 24 * 60 * 60 * 1000,
  },
});
