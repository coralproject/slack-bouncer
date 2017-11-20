const express = require('express');
const Joi = require('joi');
const router = express.Router();
const csurf = require('csurf');
const { Installation, Configuration } = require('../../models');

router.use(csurf());

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

    const linkedConfigurations = await Configuration.find({
      installation_id: id,
      team_id: req.team.id,
    });

    req.linkedConfigurations = linkedConfigurations;

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
    await req.installation.update({ $set: update }, { runValidators: true });
    res.status(204).end();
  } catch (err) {
    return next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    if (req.linkedConfigurations.length > 0) {
      const err = new Error('linked configurations exist');
      err.status = 409;
      return next(err);
    }

    // Delete the installation.
    await req.installation.remove();
    req.flash('warning', 'The installation has been deleted.');
    res.status(204).end();
  } catch (err) {
    return next(err);
  }
  res.status(204).end();
});

module.exports = router;
