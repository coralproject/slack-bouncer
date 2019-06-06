const { GraphQLClient } = require('graphql-request');
const CryptoJS = require('crypto-js');
const crypto = require('crypto');
const config = require('../config');
const fetch = require('node-fetch');
const semver = require('semver');
const { URL } = require('url');

/**
 * getAccessToken will retrieve the access token for the given installation.
 *
 * @param {Object} installation the installation that this client is paired to
 * @param {String} handshakeToken the handshake token sent on the request
 */
function getAccessToken(installation, handshakeToken) {
  return CryptoJS.AES.decrypt(
    installation.access_token,
    handshakeToken
  ).toString(CryptoJS.enc.Utf8);
}

/**
 * getGraphQLClient will retrieve the GraphQL Client for the given installation.
 *
 * @param {Object} installation the installation that this client is paired to
 * @param {String} handshakeToken the handshake token sent on the request
 */
function getGraphQLClient(installation, handshakeToken) {
  // Decrypt the access token.
  const accessToken = getAccessToken(installation, handshakeToken);

  // Create the GraphQL client.
  return new GraphQLClient(installation.root_url + 'api/v1/graph/ql', {
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  });
}

/**
 * getComment will perform the graph request to the installation and hydrate the
 * comment.
 *
 * @param {Object} installation the installation where the graph request is going to
 * @param {String} handshakeToken the token used to decrypt the access token for the graph
 * @param {String} commentID the comment id that is being retrieved
 * @returns {Promise} resolves to the comment being retrieved
 */
async function getComment(installation, handshakeToken, commentID) {
  const graphQLClient = getGraphQLClient(installation, handshakeToken);
  const variables = { comment_id: commentID };
  const query = `query getComment($comment_id: ID!) {
    comment(id: $comment_id) {
      id
      asset {
        id
        title
        url
      }
      body
      user {
        username
      }
      status
      status_history {
        type
      }
      action_summaries {
        __typename
        count
      }
      created_at
    }
  }`;

  // Get the comment from the graph.
  const { comment } = await graphQLClient.request(query, variables);

  // If no comment was returned by the graph, then reject this now.
  if (comment === null) {
    throw new Error('comment from graph was null');
  }

  return comment;
}

/**
 *
 * @param {Object} installation installation where we are using as the translation
 * @param {String} handshakeToken the installation's handshake token used to get the access token
 * @param {String} key the translation key
 * @param {Array<String>} replacements the replacements to use for the translation
 */
async function translate(installation, handshakeToken, key, ...replacements) {
  // Decrypt the access token.
  const accessToken = getAccessToken(installation, handshakeToken);

  // Test the url by sending a challenge to it for which we expect to see the
  // same response back indicating an active installation.
  const res = await fetch(
    installation.root_url + 'api/slack-bouncer/translate',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        key,
        replacements,
      }),
    }
  );

  if (!res.ok || res.status !== 200) {
    throw new Error('non 200 response from foreign api');
  }

  return res.text();
}

async function setCommentStatus(
  installation,
  handshakeToken,
  commentID,
  status
) {
  const graphQLClient = getGraphQLClient(installation, handshakeToken);
  const variables = { comment_id: commentID, status };
  const query = `mutation setCommentStatus($comment_id: ID!, $status: COMMENT_STATUS!) {
    setCommentStatus(id: $comment_id, status: $status) {
      errors {
        translation_key
      }
    }
  }`;

  // Get the comment from the graph.
  const { setCommentStatus } = await graphQLClient.request(query, variables);

  // If no comment was returned by the graph, then reject this now.
  if (setCommentStatus !== null) {
    throw new Error(
      `comment mutation failed, ${JSON.stringify(setCommentStatus)}`
    );
  }
}

/**
 * approveComment approves the comment.
 *
 * @param {Object} installation the installation where the graph request is going to
 * @param {String} handshakeToken the token used to decrypt the access token for the graph
 * @param {String} commentID the comment id that is being approved
 * @returns {Promise} resolves when the mutation is complete
 */
async function approveComment(installation, handshakeToken, commentID) {
  return setCommentStatus(installation, handshakeToken, commentID, 'ACCEPTED');
}

/**
 * rejectComment rejects the comment.
 *
 * @param {Object} installation the installation where the graph request is going to
 * @param {String} handshakeToken the token used to decrypt the access token for the graph
 * @param {String} commentID the comment id that is being rejected
 * @returns {Promise} resolves when the mutation is complete
 */
async function rejectComment(installation, handshakeToken, commentID) {
  return setCommentStatus(installation, handshakeToken, commentID, 'REJECTED');
}

/**
 * banUser bans the author of the comment.
 *
 * @param {Object} installation the installation where the graph request is going to
 * @param {String} handshakeToken the token used to decrypt the access token for the graph
 * @param {String} commentID the id of the comment authored by the user who is being banned
 * @returns {Promise} resolves when the mutation is complete
 */
async function banUser(installation, handshakeToken, commentID) {
  const graphQLClient = getGraphQLClient(installation, handshakeToken);
  let variables = { comment_id: commentID };
  let query = `query getComment($comment_id: ID!) {
    comment(id: $comment_id) {
      user {
        userID: id
        username
      }
    }
  }`;

  // Get the comment from the graph.
  const { comment } = await graphQLClient.request(query, variables);
  if (comment === null) {
    throw new Error('comment was null');
  }

  // Pull the user out of the response.
  const { userID, username } = comment.user;

  // Ban that user.
  variables = { user_id: userID };

  if (semver.satisfies(installation.talk_version, '3.x')) {
    // We rename this field to `banUser` to keep consistent with the new api's.
    query = `mutation banUser($user_id: ID!) {
      banUser: setUserStatus(id: $user_id, status: BANNED) {
        errors {
          translation_key
        }
      }
    }`;
  } else if (semver.satisfies(installation.talk_version, '4.x')) {
    // Get the translated message used for the new graph edge.
    variables.message = await translate(
      installation,
      handshakeToken,
      'bandialog.email_message_ban',
      username
    );
    query = `mutation banUser($user_id: ID!, $message: String!) {
      banUser(input: {id: $user_id, message: $message}) {
        errors {
          translation_key
        }
      }
    }`;
  }

  const { banUser } = await graphQLClient.request(query, variables);

  // If no comment was returned by the graph, then reject this now.
  if (banUser !== null) {
    throw new Error(`user mutation failed, ${JSON.stringify(banUser)}`);
  }
}

async function testPlugin(rootURL, handshakeToken, accessToken) {
  // Craft the graph endpoint for Talk.
  const uri = new URL(rootURL);

  // Verify a trailing slash.
  if (
    uri.pathname.length === 0 ||
    uri.pathname[uri.pathname.length - 1] !== '/'
  ) {
    uri.pathname += '/';
  }

  // Append the test path.
  uri.pathname += 'api/slack-bouncer/test';

  // Perform the test.

  const buffer = crypto.randomBytes(24);
  const challenge = buffer.toString('hex');

  // Test the url by sending a challenge to it for which we expect to see the
  // same response back indicating an active installation.
  const res = await fetch(uri.toString(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      challenge,
      injestion_url: config.get('injestion_url'),
      handshake_token: handshakeToken,
    }),
  });

  if (!res.ok || res.status !== 202) {
    throw new Error('non 202 response from foreign api');
  }

  const body = await res.json();

  if (body.challenge !== challenge) {
    throw new Error('invalid challenge response');
  }

  if (!semver.satisfies(body.client_version, config.get('client_semver'))) {
    throw new Error('client semver does not match requirements');
  }

  return body;
}

module.exports = {
  comment: {
    get: getComment,
    approve: approveComment,
    reject: rejectComment,
  },
  user: {
    ban: banUser,
  },
  plugin: {
    test: testPlugin,
  },
};
