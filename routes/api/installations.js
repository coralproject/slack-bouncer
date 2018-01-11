const express = require('express');
const middleware = require('../../middleware');
const logger = require('../../logger');
const config = require('../../config');
const Talk = require('../../services/talk');
const Joi = require('joi');
const router = express.Router();

router.post('/test', middleware.authz, async (req, res, next) => {
  logger.debug('validating installation');
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
    logger.error('installation validation failed', {
      err: 'payload invalid',
    });
    return res.status(400).end();
  }

  const { access_token, handshake_token, root_url } = body;

  try {
    const { client_version } = await Talk.plugin.test(
      root_url,
      handshake_token,
      access_token
    );
    logger.debug('installation validation semver passed', {
      client_version: client_version,
      client_semver: config.get('client_semver'),
    });
    return res.status(204).end();
  } catch (err) {
    logger.error('installation validation failed', { err: err.message });
    return res.status(500).end();
  }
});

module.exports = router;
