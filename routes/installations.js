const express = require('express');
const { Installation } = require('../models');
const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const installations = await Installation.find({ team_id: req.team.id });
    res.render('installations', {
      installations: installations.map(installation => installation.toObject()),
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
