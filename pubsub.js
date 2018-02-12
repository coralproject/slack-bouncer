const PubSub = require('@google-cloud/pubsub');
const Talk = require('./services/talk');
const { URL } = require('url');
const { Installation, Configuration, Team, User } = require('./models');
const logger = require('./logger');
const uniq = require('lodash/uniq');
const config = require('./config');
const slack = require('./services/slack');
const reporting = require('./reporting');

/**
 * onError receives errors emitted by the subscription.
 *
 * @param {Object} err The error that was encountered while processing the
 *                     stream.
 */
function onError(err) {
  reporting.report(err, () => {
    logger.error('error during PubSub processing', { err: err.message });
  });
}

/**
 * Sends the comment to Slack in the form of an interactive message.
 *
 * @param {Object} comment the comment that is being sent to slack
 * @param {Object} configuration the configuration that this message is referencing
 * @returns {String} the message id that was created on Slack.
 */
async function sendInteractiveMessage(
  comment,
  configuration,
  users,
  installation,
  handshakeToken
) {
  const user = users.find(({ id }) => id === configuration.added_by.id);
  if (!user) {
    throw new Error('cannot get referenced user');
  }

  // Create the timestamp field.
  const ts = new Date(comment.created_at).getTime() / 1000;

  // Build up the callback id from the source id's.
  const callback_id = JSON.stringify({
    c: comment.id,
    i: installation.id,
    h: handshakeToken,
  });

  // Compose the url.
  const assetURL = new URL(comment.asset.url);
  assetURL.searchParams.set('commentId', comment.id);
  const title_link = assetURL.toString();

  // Send the message off to Slack. Refer to the field guide here:
  //   https://api.slack.com/docs/message-attachments
  // For information on how to change this.
  const body = await slack.chat.postMessage(
    user.access_token,
    configuration.channel_id,
    {
      attachments: [
        {
          text: comment.body,
          title: comment.asset.title,
          title_link,
          footer: comment.user.username,
          ts,
          callback_id,
          actions: [
            {
              name: 'moderation',
              text: 'Approve',
              type: 'button',
              style: 'primary',
              value: 'approve',
            },
            {
              name: 'moderation',
              text: 'Reject',
              type: 'button',
              style: 'danger',
              value: 'reject',
            },
            {
              name: 'user_moderation',
              text: 'Ban User',
              type: 'button',
              style: 'danger',
              value: 'ban',
              confirm: {
                title: `Are you sure you would like to ban ${
                  comment.user.username
                }?`,
                text:
                  'Banning this user will also place this comment in the Rejected queue.',
                ok_text: 'Yes',
                dismiss_text: 'No',
              },
            },
          ],
        },
      ],
    }
  );

  // Error out if the slack error is sent back.
  if (!body.ok) {
    throw new Error(body.error);
  }

  // Send back the message id, or the "ts".
  return body.ts;
}

// /**
//  * Sends the message ID's back to the Talk instance to be saved. It will also
//  * persist the message id and comment id in the event that the comment's
//  * moderation status was changed in-between being sent to us and us recording
//  * the Slack message id's.
//  *
//  * @param {Object} installation the installation that sent the comments
//  * @param {String} commentID the comment id that was sent
//  * @param {Array<String>} messageIDs the messages that were created on Slack
//  */
// async function updateMessageIDs(installation, commentID, messageIDs) {
//   // TODO: persist the message id's for the comment in redis with an expiry.
//   // TODO: send the data back to the Talk installation.
// }

// /**
//  * Resolves the situation where a comment is sent to the bouncer, and before it
//  * can be handled, a moderation action occurs on the comment from the dashboard.
//  * In this situation, we need to update the moderation status on the messages on
//  * Slack.
//  *
//  * @param {Object} installation The installation that sent the comment
//  * @param {String} commentID The comment id that was sent
//  * @param {Array<String>} messageIDs the messages that were created on Slack
//  */
// async function handleRacePosts(installation, commentID, messageIDs) {
//   // TODO
// }

async function getConfigurations(installID, comment, source) {
  // Compose the configuration query.
  const query = Configuration.find({
    installation_id: installID,
    disabled: false,
  });

  switch (source) {
    // A new comment will be added to all new queues. If the comment has a
    // status of PREMOD, it will also go to the premod queues. If a comment has
    // a status of SYSTEM_WITHHELD, then it will go to the reported queue
    // directly.
    case 'comment': {
      const types = ['NEW'];

      if (comment.status === 'PREMOD') {
        types.push('PREMOD');
      } else if (comment.status === 'SYSTEM_WITHHELD') {
        types.push('REPORTED');
      }

      return query.merge({
        type: {
          $in: types,
        },
      });
    }
    case 'flag': {
      // Flag messages are only relevant for reported queues, this represents
      // a comment that was flagged for the first time. We'll also check that
      // the comment has a status that makes sense.
      if (comment.status === 'NONE') {
        return query.merge({
          type: 'REPORTED',
        });
      }

      // A flag came it, but the comment should have already entered a queue or
      // was moderated already, so return no valid configurations.
      return [];
    }
    default:
      // An unsupported source was passed, we don't know what to pull!
      throw new Error(`invalid source '${source}'`);
  }
}

/**
 * onMessage will receive the PubSub messages as they are retrieved from the
 * subscription.
 *
 * @param {Object} message The PubSub message from Google Cloud.
 */
async function onMessage(message) {
  try {
    // Pass the message on to get handled.
    await handlePubSubMessage(message);

    // Report that we got the message.
    message.ack();
  } catch (err) {
    logger.error('could not process the PubSub message', {
      message_id: message.id,
      err: err.message,
    });

    // Report that the message was not received/handled and should be
    // redelivered.
    message.nack();
  }
}

/**
 * handlePubSubMessage will receive the PubSub messages as they are retrieved
 * from the subscription. Acking the message will be done higher than this.
 *
 * @param {Object} message The PubSub message from Google Cloud.
 */
async function handlePubSubMessage(message) {
  logger.debug('got PubSub message', { message_id: message.id });

  // Use and process the message.
  let data, installID, handshakeToken;
  try {
    // Try and parse the message data.
    const payload = JSON.parse(message.data.toString());

    logger.debug('parsed PubSub message', { message_id: message.id });

    // Associate the message data with what we know is inside.
    data = payload.data;
    installID = payload.install_id;
    handshakeToken = payload.handshake_token;
  } catch (err) {
    logger.error('could not process the pubsub message', {
      message_id: message.id,
      err: err.message,
    });
    return;
  }

  logger.info('extracted payload', {
    message_id: message.id,
    comment_id: data.id,
    installation_id: installID,
    handshake_token: handshakeToken ? true : false,
  });

  let installation, configurations, users;
  try {
    installation = await Installation.findOne({ id: installID });
    if (!installation) {
      logger.error('could not process the pubsub message', {
        message_id: message.id,
        installation_id: installID,
        err: 'could not find installation',
      });
      message.ack();
      return;
    }

    logger.debug('found installation', {
      message_id: message.id,
      installation_id: installation.id,
    });

    if (installation.disabled) {
      logger.info('installation disabled', {
        message_id: message.id,
        installation_id: installation.id,
      });
      message.ack();
      return;
    }

    // Get the team.
    const team = await Team.findOne({ id: installation.team_id });
    if (!team) {
      logger.error('could not process the pubsub message', {
        message_id: message.id,
        installation_id: installID,
        team_id: installation.team_id,
        err: 'could not find team',
      });
      message.ack();
      return;
    }

    if (team.disabled) {
      logger.debug('team is disabled', {
        message_id: message.id,
        installation_id: installation.id,
        team_id: installation.team_id,
      });
      message.ack();
      return;
    }
  } catch (err) {
    logger.error('an error occurred trying to load from the database', {
      message_id: message.id,
      err: err.message,
    });
    return;
  }

  let comment;
  try {
    comment = await Talk.comment.get(installation, handshakeToken, data.id);
    logger.debug('got the comment from the graph', {
      message_id: message.id,
    });
  } catch (err) {
    logger.error(
      'an error occurred trying to query for the comment on the installation graph',
      {
        message_id: message.id,
        comment_id: data.id,
        installation_id: installID,
        err: err.message,
      }
    );
    return;
  }

  try {
    configurations = await getConfigurations(installID, comment, data.source);
    if (!configurations || configurations.length === 0) {
      logger.debug('no configurations to send the message to', {
        message_id: message.id,
        installation_id: installation.id,
      });
      message.ack();
      return;
    }

    users = await User.find({
      id: {
        $in: uniq(configurations.map(({ added_by: { id } }) => id)),
      },
    });
    if (!users || users.length === 0) {
      logger.debug('users linked to configurations are not available', {
        message_id: message.id,
        installation_id: installation.id,
      });
      message.ack();
      return;
    }
  } catch (err) {
    logger.error('an error occurred trying to load from the database', {
      message_id: message.id,
      err: err.message,
    });
    return;
  }

  try {
    // Send interactive messages to each slack configuration.
    await Promise.all(
      configurations.map(config =>
        sendInteractiveMessage(
          comment,
          config,
          users,
          installation,
          handshakeToken
        )
      )
    );
  } catch (err) {
    logger.error('an error occurred trying to push the messages to slack', {
      message_id: message.id,
      err: err.message,
    });
    return;
  }

  // try {
  //   // Push the message id's back to the talk installation.
  //   await updateMessageIDs(installation, comment.id, messageIDs);
  // } catch (err) {
  //   logger.error('an error occurred trying to push the messages ids back', {
  //     message_id: message.id,
  //     err: err.message,
  //   });
  //   return;
  // }

  // try {
  //   await handleRacePosts(installation, comment.id, messageIDs);
  // } catch (err) {
  //   logger.error('an error occurred trying to handle race posts', {
  //     message_id: message.id,
  //     err: err.message,
  //   });
  //   return;
  // }

  logger.debug('successfully processed the message', {
    message_id: message.id,
  });
}

/**
 * subscribe will create the pubsub provider, and connect all the handlers.
 */
async function subscribe() {
  // Setup the pubsub publisher.
  const pubsub = new PubSub();
  const topic = pubsub.topic(config.get('pubsub_topic'));
  const subscription = topic.subscription(
    config.get('pubsub_topic_subscription')
  );

  subscription.on('error', onError);
  subscription.on('message', onMessage);
}

module.exports = { subscribe };
