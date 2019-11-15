const express = require('express');
const uuid = require('uuid');
const Joi = require('@hapi/joi');
const slack = require('../services/slack');
const { Configuration, Installation } = require('../models');
const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const { installation_id } = req.query;
    const installations = await Installation.find({ team_id: req.team.id });

    // If the current user has an access token, then load the channels.
    let channels;
    if (req.user.access_token) {
      channels = await slack.channels.list(req.user.access_token);
    }

    return res.render('add_configuration', {
      channels,
      installations,
      installation_id,
      csrfToken: req.csrfToken(),
    });
  } catch (err) {
    return next(err);
  }
});

router.post('/', async (req, res, next) => {
  if (!req.user.access_token) {
    const err = new Error('user missing access token');
    err.status = 401;
    return next(err);
  }

  const { value: body, error: err } = Joi.validate(
    req.body,
    Joi.object().keys({
      installation_id: Joi.string().required(),
      channel_id: Joi.string().required(),
      type: Joi.string()
        .required()
        .valid(['NEW', 'REPORTED', 'PREMOD']),
    }),
    {
      stripUnknown: true,
      convert: false,
      presence: 'required',
    }
  );
  if (err) {
    return next(err);
  }

  try {
    const channels = await slack.channels.list(req.user.access_token);
    const channel = channels.find(({ id }) => id === body.channel_id);

    const configuration = new Configuration({
      id: uuid.v4(),
      team_id: req.team.id,
      added_by: req.user,
      installation_id: body.installation_id,
      type: body.type,
      channel: channel.name,
      channel_id: channel.id,
    });

    await configuration.save();

    req.flash('success', 'The configuration was created!');
    res.redirect('/configuration/' + configuration.id);
  } catch (err) {
    return next(err);
  }
});

router.param('id', async (req, res, next, id) => {
  try {
    const configuration = await Configuration.findOne({
      id,
      team_id: req.team.id,
    });
    if (!configuration) {
      return next(new Error('configuration not found'));
    }

    req.configuration = configuration;
    res.locals.configuration = configuration.toObject();

    const installation = await Installation.findOne({
      id: configuration.installation_id,
      team_id: req.team.id,
    });
    if (!installation) {
      return next(new Error('installation not found'));
    }

    req.installation = installation;
    res.locals.installation = installation.toObject();

    next();
  } catch (err) {
    return next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    return res.render('edit_configuration', {
      csrfToken: req.csrfToken(),
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
