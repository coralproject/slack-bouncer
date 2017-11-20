const express = require('express');
const config = require('../config');
const uuid = require('uuid');
const slack = require('../services/slack');
const { User } = require('../models');
const querystring = require('querystring');
const { URL } = require('url');
const router = express.Router();

// Path to start the OAuth flow
router.get('/authorize', (req, res, next) => {
  // Generate a unique state token.
  const state = uuid.v4();

  // Save the state in the session.
  req.session.state = state;

  // Construct the redirect uri.
  const uri = new URL('https://slack.com/oauth/authorize');
  uri.search = querystring.stringify({
    client_id: config.get('slack.client_id'),
    redirect_uri: config.get('root_url') + 'user/authorize/callback',
    scope: 'groups:read,channels:read,chat:write:bot',
    state,
  });

  // Redirect the user.
  res.redirect(uri.toString());
});

// OAuth callback url
router.get('/authorize/callback', async (req, res, next) => {
  // Pull the state out of the session.
  const { state } = req.session;

  // Match the state to the one in the request.
  if (state !== req.query.state) {
    return next(new Error('state mismatch'));
  }

  // The state matched, unset the state from the session to prevent a replay.
  delete req.session.state;

  let body;
  try {
    body = await slack.oauth.access(req.query.code, 'user/authorize/callback');

    if (!body.ok) {
      return next(new Error(body.error));
    }
  } catch (err) {
    return next(err);
  }

  // Now we have authenticated with slack! Save some details.
  try {
    await User.update(
      { id: req.user.id },
      { access_token: body.access_token },
      { runValidators: true }
    );

    // Save the access token to this session.
    req.session.access_token = body.access_token;
    req.session.scope = body.scope;

    req.flash(
      'success',
      'Slack has been authorized to post on your Slack team!'
    );
    res.redirect('/configuration');
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
