const express = require('express');
const config = require('../config');
const middleware = require('../middleware');
const uuid = require('uuid');
const { User, Team } = require('../models');
const invite = require('../invite');
const querystring = require('querystring');
const { URL } = require('url');
const slack = require('../services/slack');
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
    redirect_uri: config.get('root_url') + 'auth/callback',
    scope: 'identity.basic,identity.team',
    state,
  });

  // Redirect the user.
  res.redirect(uri.toString());
});

router.get('/destroy', middleware.authz, async (req, res, next) => {
  req.session.destroy(err => {
    if (err) {
      return next(err);
    }

    res.redirect('/');
  });
});

// OAuth callback url
router.get('/callback', async (req, res, next) => {
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
    body = await slack.oauth.access(req.query.code, 'auth/callback');

    if (!body.ok) {
      return next(new Error(body.error));
    }
  } catch (err) {
    return next(err);
  }

  // Now we have authenticated with slack! Save some details.

  try {
    // Check to see if this is a new team.
    let team = await Team.findOne({ id: body.team.id });
    if (!team) {
      const { invite: teamInvite } = req.session;
      // This is a new team, check to see if this session has an invite on it.
      if (!teamInvite) {
        return next(new Error('Invalid invite'));
      }

      try {
        // Check to see if the invite is for this team.
        if (teamInvite.domain !== body.team.domain) {
          throw new Error('Invite token for another domain');
        }

        // Consume this invite.
        await invite.use(teamInvite.token);
      } catch (err) {
        // We need to revoke the token from Slack.
        await slack.auth.revoke(body.access_token);

        // And remove the invite from the session, as it's invalid.
        delete req.session.invite;
        return next(err);
      }

      // Create the team.
      team = new Team({
        id: body.team.id,
        name: body.team.name,
        domain: body.team.domain,
      });

      // Save it to the database.
      await team.save();
    }

    const user = await User.findOneAndUpdate(
      {
        id: body.user.id,
      },
      {
        id: body.user.id,
        name: body.user.name,
        team_id: body.team.id,
      },
      {
        upsert: true,
        new: true,
      }
    );

    // Save the access token to this session.
    req.session.access_token = body.access_token;
    req.session.scope = body.scope;
    req.session.user_id = user.id;
    req.session.team_id = team.id;

    req.flash('success', "You've signed in!");

    if (req.session.redirect_after_login) {
      const { redirect_after_login } = req.session;
      delete req.session.redirect_after_login;

      res.redirect(redirect_after_login);
    } else {
      res.redirect('/');
    }
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
