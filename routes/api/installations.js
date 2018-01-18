const express = require('express');
const middleware = require('../../middleware');
const logger = require('../../logger');
const config = require('../../config');
const Talk = require('../../services/talk');
const { Installation } = require('../../models');
const Joi = require('joi');
const CryptoJS = require('crypto-js');
const router = express.Router();

router.post('/test', middleware.authz, async (req, res, next) => {
  logger.debug('validating installation');
  const { value: body, error: err } = Joi.validate(
    req.body,
    Joi.object()
      .keys({
        id: Joi.string().default(null),
        name: Joi.string().required(),
        access_token: Joi.string().default(null),
        handshake_token: Joi.string().required(),
        root_url: Joi.string().required(),
      })
      .optionalKeys(['id', 'access_token']),
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

  const { id, handshake_token, root_url } = body;
  let { access_token } = body;

  try {
    if (id !== null) {
      const installation = await Installation.findOne({ id });
      if (!installation) {
        return res.status(404).end();
      }

      if (access_token === null) {
        // Decrypt the access token from the installation.
        access_token = CryptoJS.AES.decrypt(
          installation.access_token,
          handshake_token
        ).toString(CryptoJS.enc.Utf8);
      }
    }
    const { client_version, talk_version } = await Talk.plugin.test(
      root_url,
      handshake_token,
      access_token
    );
    logger.debug('installation validation semver passed', {
      client_version: client_version,
      talk_version,
      client_semver: config.get('client_semver'),
    });
    return res.status(204).end();
  } catch (err) {
    logger.error('installation validation failed', { err: err.message });
    return res.status(500).end();
  }
});

module.exports = router;
