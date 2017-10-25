const express = require('express');
const { Configuration, Installation } = require('../models');
const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const configurations = await Configuration.find({ team_id: req.team.id });
    const installations = await Installation.find({
      id: {
        $in: configurations.map(({ installation_id }) => installation_id),
      },
    });

    res.render('configurations', {
      configurations: configurations.map(configuration => {
        const installation = installations.find(
          ({ id }) => id === configuration.installation_id
        );

        const obj = configuration.toObject();
        obj.installation = installation.toObject();

        return obj;
      }),
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
