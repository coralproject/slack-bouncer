const fetch = require('node-fetch');
const config = require('../config');
const merge = require('lodash/merge');
const concat = require('lodash/concat');
const sortBy = require('lodash/sortBy');
const { URL } = require('url');
const querystring = require('querystring');

async function listChannels(token) {
  let res = await fetch('https://slack.com/api/channels.list', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: querystring.stringify({
      token,
      exclude_archived: true,
      exclude_members: true,
    }),
  });

  let body = await res.json();

  if (!body.ok) {
    throw new Error(body.error);
  }

  const { channels } = body;

  res = await fetch('https://slack.com/api/groups.list', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: querystring.stringify({
      token,
      exclude_archived: true,
      exclude_members: true,
    }),
  });

  body = await res.json();

  if (!body.ok) {
    throw new Error(body.error);
  }

  const { groups } = body;

  return sortBy(
    concat(channels, groups.filter(({ name }) => !name.startsWith('mpdm'))),
    'name'
  );
}

async function chat(token, channel_id, message, type) {
  if (message && message.attachments) {
    message.attachments = JSON.stringify(message.attachments);
  }

  const body = merge(message, {
    token,
    channel: channel_id,
  });

  const res = await fetch(`https://slack.com/api/chat.${type}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: querystring.stringify(body),
  });

  return res.json();
}

async function chatPostMessage(token, channel_id, message) {
  return chat(token, channel_id, message, 'postMessage');
}

async function chatUpdate(token, channel_id, message) {
  return chat(token, channel_id, message, 'update');
}

async function oauthAccess(code, redirect_uri) {
  // Construct the url to get the tokens.
  const uri = new URL('https://slack.com/api/oauth.access');
  uri.search = querystring.stringify({
    code,
    client_id: config.get('slack.client_id'),
    client_secret: config.get('slack.client_secret'),
    redirect_uri: config.get('root_url') + redirect_uri,
  });

  const res = await fetch(uri.toString());
  return res.json();
}

async function authRevoke(token) {
  // We need to revoke the token from Slack.
  const res = await fetch('https://slack.com/api/auth.revoke', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: querystring.stringify({
      token,
    }),
  });

  return res.json();
}

module.exports = {
  channels: {
    list: listChannels,
  },
  chat: {
    postMessage: chatPostMessage,
    update: chatUpdate,
  },
  oauth: {
    access: oauthAccess,
  },
  auth: {
    revoke: authRevoke,
  },
};
