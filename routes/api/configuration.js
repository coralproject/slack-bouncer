const express = require('express');
const Joi = require('joi');
const router = express.Router();
const csurf = require('csurf');
const { Configuration } = require('../../models');

router.use(csurf());

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
    next();
  } catch (err) {
    return next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  const { value: update, error: err } = Joi.validate(
    req.body,
    Joi.object().keys({
      disabled: Joi.boolean().required(),
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
    await req.configuration.update({ $set: update });
    res.status(204).end();
  } catch (err) {
    return next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    // Delete the configuration.
    await req.configuration.remove();
    req.flash('warning', 'The configuration has been deleted.');
    res.status(204).end();
  } catch (err) {
    return next(err);
  }
  res.status(204).end();
});

module.exports = router;
