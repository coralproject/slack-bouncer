const config = require('../config');
const auth = require('./auth');
const logging = require('./logging');
const session = require('./session');
const flash = require('./flash');
const pluralize = require('pluralize');
const accepts = require('accepts');

const error = (err, req, res, next) => {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = config.get('env') === 'development' ? err : {};

  // Send the correct status back.
  res.status(err.status || 500);

  const accept = accepts(req);

  // the order of this list is significant; should be server preferred order
  switch (accept.type(['json', 'html'])) {
    case 'json':
      res.json({
        error: err.message,
      });
      break;
    default:
      // render the error page
      res.render('error');
      break;
  }
};

const notFound = (req, res, next) => {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
};

const authz = (req, res, next) => {
  if (!req.is_authenticated) {
    return res.redirect('/');
  }

  next();
};

const locals = (req, res, next) => {
  res.locals.pluralize = pluralize;
  res.locals.slackAppID = config.get('slack.app_id');
  next();
};

module.exports = {
  auth,
  authz,
  error,
  flash,
  locals,
  logging,
  notFound,
  session,
};
