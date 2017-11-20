const fetch = require('node-fetch');
const config = require('../config');
const merge = require('lodash/merge');
const concat = require('lodash/concat');
const sortBy = require('lodash/sortBy');
const { URL } = require('url');
const querystring = require('querystring');

async function request(method, requestBody) {
  const res = await fetch(`https://slack.com/api/${method}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: querystring.stringify(requestBody),
  });

  const responseBody = res.json();

  // All Slack responses come with an `ok` param, check to see if the request
  // was ok!
  if (!responseBody.ok) {
    throw new Error(responseBody.error);
  }

  return responseBody;
}

async function listChannels(token) {
  const [{ channels }, { groups }] = await Promise.all([
    request('channels.list', {
      token,
      exclude_archived: true,
      exclude_members: true,
    }),
    request('groups.list', {
      token,
      exclude_archived: true,
      exclude_members: true,
    }),
  ]);

  // Sort the channels alphabetically.
  return sortBy(
    // Join the lists, but remove the person to person channels.
    concat(channels, groups.filter(({ name }) => !name.startsWith('mpdm'))),
    'name'
  );
}

async function chat(token, channel_id, message, type) {
  if (message && message.attachments) {
    message.attachments = JSON.stringify(message.attachments);
  }

  const requestBody = merge(message, {
    token,
    channel: channel_id,
  });

  return request(`chat.${type}`, requestBody);
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
