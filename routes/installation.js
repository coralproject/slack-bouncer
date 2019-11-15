const express = require('express');
const crypto = require('crypto');
const Joi = require('@hapi/joi');
const CryptoJS = require('crypto-js');
const uuid = require('uuid');
const jwt = require('jsonwebtoken');
const { URL } = require('url');
const config = require('../config');
const Talk = require('../services/talk');
const { Configuration, Installation } = require('../models');
const logger = require('../logger');
const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const buffer = crypto.randomBytes(20);
    const handshake_token = buffer.toString('hex');

    return res.render('add_installation', {
      handshake_token,
      injestion_url: config.get('injestion_url'),
      client_semver: config.get('client_semver'),
      csrfToken: req.csrfToken(),
    });
  } catch (err) {
    return next(err);
  }
});

router.post('/', async (req, res, next) => {
  const { value: body, error: err } = Joi.validate(
    req.body,
    Joi.object().keys({
      name: Joi.string().required(),
      access_token: Joi.string().required(),
      handshake_token: Joi.string().required(),
      root_url: Joi.string().required(),
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

  const { name, access_token, handshake_token, root_url } = body;

  // Craft the graph endpoint for Talk.
  const uri = new URL(root_url);

  // Verify a trailing slash.
  if (
    uri.pathname.length === 0 ||
    uri.pathname[uri.pathname.length - 1] !== '/'
  ) {
    uri.pathname += '/';
  }

  try {
    // Determine the version of Talk by testing the application again.
    const { talk_version } = await Talk.plugin.test(
      root_url,
      handshake_token,
      access_token
    );

    // Encrypt the access token with the handshake token.
    const ciphertext = CryptoJS.AES.encrypt(access_token, handshake_token);

    const installation = new Installation({
      id: uuid.v4(),
      name,
      root_url: uri.toString(),
      added_by: req.user,
      team_id: req.team.id,
      access_token: ciphertext.toString(),
      talk_version,
    });

    // Save/create the new installation.
    await installation.save();

    // Create the new auth token.
    const token = jwt.sign(
      {
        iat: Math.floor(installation.created_at.getTime() / 1000),
      },
      config.get('client_signing_token'),
      {
        issuer: config.get('root_url'),
        jwtid: installation.id,
      }
    );

    // Save the token on the session, it'll be destroyed on the next page.
    req.session.installation_token = token;

    res.redirect(`/installation/${installation.id}`);
  } catch (err) {
    return next(err);
  }
});

router.param('id', async (req, res, next, id) => {
  try {
    const installation = await Installation.findOne({
      id,
      team_id: req.team.id,
    });
    if (!installation) {
      return next(new Error('installation not found'));
    }

    req.installation = installation;
    res.locals.installation = installation.toObject();

    const configurations = await Configuration.find({
      team_id: req.team.id,
      installation_id: installation.id,
    });

    req.configurations = configurations;
    res.locals.configurations = configurations.map(configuration =>
      configuration.toObject()
    );

    next();
  } catch (err) {
    return next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    let installation_token;
    if (req.session.installation_token) {
      installation_token = req.session.installation_token;
      delete req.session.installation_token;
    }

    return res.render('edit_installation', {
      installation_token,
      csrfToken: req.csrfToken(),
    });
  } catch (err) {
    return next(err);
  }
});

/**
 * This endpoint will update an existing installation.
 */
router.post('/:id', async (req, res, next) => {
  const { value: body, error: err } = Joi.validate(
    req.body,
    Joi.object()
      .keys({
        name: Joi.string().required(),
        access_token: Joi.string().default(null),
        handshake_token: Joi.string().required(),
        root_url: Joi.string().required(),
      })
      .optionalKeys(['access_token']),
    {
      stripUnknown: true,
      convert: false,
      presence: 'required',
    }
  );
  if (err) {
    logger.error('installation validation failed', {
      err: 'payload invalid',
    });
    return res.status(400).end();
  }

  const { name, handshake_token, root_url } = body;
  let { access_token } = body;

  // Craft the graph endpoint for Talk.
  const uri = new URL(root_url);

  // Verify a trailing slash.
  if (
    uri.pathname.length === 0 ||
    uri.pathname[uri.pathname.length - 1] !== '/'
  ) {
    uri.pathname += '/';
  }

  try {
    if (access_token === null) {
      // Decrypt the access token from the installation.
      access_token = CryptoJS.AES.decrypt(
        req.installation.access_token,
        handshake_token
      ).toString(CryptoJS.enc.Utf8);
    }

    // Determine the version of Talk by testing the application again.
    const { talk_version } = await Talk.plugin.test(
      root_url,
      handshake_token,
      access_token
    );

    // Encrypt the access token with the handshake token.
    const ciphertext = CryptoJS.AES.encrypt(access_token, handshake_token);

    // Update the installation.
    await req.installation.update({
      $set: {
        name,
        root_url: uri.toString(),
        access_token: ciphertext.toString(),
        talk_version,
      },
    });

    // Get the updated installation.
    req.installation = await Installation.findOne({ id: req.installation.id });
    res.locals.installation = req.installation.toObject();

    return res.render('edit_installation', {
      installation_token: null,
      csrfToken: req.csrfToken(),
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
