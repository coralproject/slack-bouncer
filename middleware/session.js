const session = require('express-session');
const RedisStore = require('connect-redis')(session);
const config = require('../config');

module.exports = session({
  store: new RedisStore({
    url: config.get('redis_url'),
  }),
  secret: config.get('session_secret'),
  resave: false,
  saveUninitialized: false,
  unset: 'destroy',
  cookie: {
    secure: config.get('env') === 'production',
    maxAge: 60 * 60 * 1000,
  },
});
