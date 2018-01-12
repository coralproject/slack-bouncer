const express = require('express');
const Talk = require('../../services/talk');
const slack = require('../../services/slack');
const logger = require('../../logger');
const config = require('../../config');
const { Installation, Team, Configuration, User } = require('../../models');
const router = express.Router();

router.post('/interactive', async (req, res, next) => {
  const {
    actions,
    callback_id,
    original_message,
    token,
    channel,
    user: slack_user,
  } = JSON.parse(req.body.payload);

  // Verify the slack verification token.
  if (token !== config.get('slack.verification_token')) {
    const err = new Error('could not verify slack token');
    err.status = 401;
    return next(err);
  }

  // Respond to Slack with the correct status.
  res.status(200).end();

  // Unpack the callback ID.
  const { c: commentID, i: installationID, h: handshakeToken } = JSON.parse(
    callback_id
  );

  try {
    logger.debug('got an interactive message from slack', {
      comment_id: commentID,
      installation_id: installationID,
      message_id: original_message.ts,
    });

    // Get the referenced installation.
    const installation = await Installation.findOne({ id: installationID });
    if (!installation) {
      logger.error("couldn't find the installation referenced", {
        comment_id: commentID,
        installation_id: installationID,
        message_id: original_message.ts,
      });
      return;
    }

    if (installation.disabled) {
      logger.info(
        'installation was disabled, refusing to process the slack interactive callback',
        {
          comment_id: commentID,
          installation_id: installationID,
          message_id: original_message.ts,
        }
      );
      return;
    }

    // Get the referenced team.
    const team = await Team.findOne({ id: installation.team_id });
    if (!team) {
      logger.error("couldn't find the team referenced", {
        comment_id: commentID,
        installation_id: installationID,
        team_id: installation.team_id,
        message_id: original_message.ts,
      });
      return;
    }

    if (team.disabled) {
      logger.info(
        'team was disabled, refusing to process the slack interactive callback',
        {
          comment_id: commentID,
          installation_id: installationID,
          team_id: installation.team_id,
          message_id: original_message.ts,
        }
      );
      return;
    }

    // Get the source configuration.
    const configuration = await Configuration.findOne({
      team_id: team.id,
      channel_id: channel.id,
    });
    if (!configuration) {
      logger.error("couldn't find the configuration referenced", {
        comment_id: commentID,
        installation_id: installationID,
        team_id: installation.team_id,
        message_id: original_message.ts,
      });
      return;
    }

    if (configuration.disabled) {
      logger.info(
        'configuration was disabled, refusing to process the slack interactive callback',
        {
          comment_id: commentID,
          installation_id: installationID,
          team_id: installation.team_id,
          message_id: original_message.ts,
        }
      );
      return;
    }

    const user = await User.findOne({ id: configuration.added_by.id });
    if (!user) {
      logger.error("couldn't find the user referenced", {
        comment_id: commentID,
        installation_id: installationID,
        team_id: installation.team_id,
        message_id: original_message.ts,
      });
      return;
    }

    try {
      // Parse the action.
      for (const action of actions) {
        switch (action.name) {
          case 'moderation': {
            // Remove any old moderation actions.
            original_message.attachments[0].actions = original_message.attachments[0].actions.filter(
              ({ name }) => name !== 'moderation'
            );

            // Act on the value.
            switch (action.value) {
              case 'approve': {
                // Remove any old user moderation actions.
                original_message.attachments[0].actions = original_message.attachments[0].actions.filter(
                  ({ name }) => name !== 'user_moderation'
                );

                // Approve the comment.
                await Talk.comment.approve(
                  installation,
                  handshakeToken,
                  commentID
                );

                // Update the slack messaging.
                original_message.attachments.push({
                  mrkdwn_in: ['text'],
                  text: `*:white_check_mark: <@${
                    slack_user.id
                  }> approved this comment*`,
                });
                break;
              }
              case 'reject': {
                // Reject the comment.
                await Talk.comment.reject(
                  installation,
                  handshakeToken,
                  commentID
                );

                // Update the slack messaging.
                original_message.attachments.push({
                  mrkdwn_in: ['text'],
                  text: `*:no_entry_sign: <@${
                    slack_user.id
                  }> rejected this comment*`,
                });
                break;
              }
              default: {
                logger.error('invalid action value received', {
                  comment_id: commentID,
                  installation_id: installationID,
                  action,
                });
                return;
              }
            }
            break;
          }
          case 'user_moderation': {
            // Remove any old user moderation actions.
            original_message.attachments[0].actions = original_message.attachments[0].actions.filter(
              ({ name }) => name !== 'user_moderation' && name !== 'moderation'
            );

            // Act on the value.
            switch (action.value) {
              case 'ban': {
                // Ban the author.
                await Talk.user.ban(installation, handshakeToken, commentID);

                // Reject the comment.
                await Talk.comment.reject(
                  installation,
                  handshakeToken,
                  commentID
                );

                // Update the slack messaging.
                original_message.attachments.push({
                  mrkdwn_in: ['text'],
                  text: `*:no_entry_sign: <@${
                    slack_user.id
                  }> banned this user*`,
                });
                original_message.attachments.push({
                  mrkdwn_in: ['text'],
                  text: `*:no_entry_sign: <@${
                    slack_user.id
                  }> rejected this comment*`,
                });
                break;
              }
              default: {
                logger.error('invalid action value received', {
                  comment_id: commentID,
                  installation_id: installationID,
                  action,
                });
                return;
              }
            }
            break;
          }
          default: {
            logger.error('invalid action name received', {
              comment_id: commentID,
              installation_id: installationID,
              action,
            });
            return;
          }
        }
      }
    } catch (err) {
      logger.error('could not perform the remote action', {
        comment_id: commentID,
        installation_id: installationID,
        err: err.message,
      });
      return;
    }

    try {
      const { ts: messageID } = await slack.chat.update(
        user.access_token,
        channel.id,
        original_message
      );

      logger.info('slack message updated', {
        comment_id: commentID,
        installation_id: installationID,
        message_id: messageID,
      });
    } catch (err) {
      logger.error('could not update slack', {
        comment_id: commentID,
        installation_id: installationID,
        error: err.message,
      });
    }
  } catch (err) {
    logger.error('could not process the slack message', {
      comment_id: commentID,
      installation_id: installationID,
      error: err.message,
    });
  }
});

// router.post('/events', (req, res, next) => {
//   if (!req.body || req.body.token !== config.get('slack.verification_token')) {
//     const err = new Error('could not verify slack token');
//     err.status = 401;
//     return next(err);
//   }

//   switch (req.body.type) {
//     case 'url_verification':
//       return res.json({ challenge: req.body.challenge });
//     case 'event_callback':
//       // TODO: handle events
//       return res.json({ status: 'ok' });
//     default:
//       const err = new Error('invalid event type');
//       err.status = 400;
//       return next(err);
//   }
// });

module.exports = router;
