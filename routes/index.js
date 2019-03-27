const express = require('express');
const csurf = require('csurf');
const config = require('../config');
const middleware = require('../middleware');
const { Configuration, Installation } = require('../models');
const auth = require('./auth');
const user = require('./user');
const api = require('./api');
const account = require('./account');
const configuration = require('./configuration');
const configurations = require('./configurations');
const installation = require('./installation');
const installations = require('./installations');
const invite = require('./invite');
const metrics = require('./metrics');

const router = express.Router();

// Setup the index route.
router.get('/', async (req, res) => {
  let counts = {};
  if (req.is_authenticated) {
    counts.installs = await Installation.find({ team_id: req.team.id }).count();
    counts.configs = await Configuration.find({ team_id: req.team.id }).count();
  }

  res.render('index', { counts });
});

// Setup the api routes.
router.use('/api', api);

// Setup the auth routes.
router.use('/auth', auth);

// Setup the invite route.
router.use('/invite', invite);

if (config.get('enable_metrics')) {
  // Setup the metrics route.
  router.use('/metrics', metrics);
}

// Attach middleware that'll apply to all following routes.
router.use(middleware.authz);
router.use(csurf());

// Setup the ui routes.
router.use('/account', account);
router.use('/configuration', configuration);
router.use('/configurations', configurations);
router.use('/installation', installation);
router.use('/installations', installations);
router.use('/user', user);

module.exports = router;
