const express = require('express');
const invite = require('../invite');
const router = express.Router();

router.get('/:token', async (req, res, next) => {
  const { token = null } = req.params;
  if (token === null || token.length === 0) {
    const err = new Error('Invite token invalid');
    err.code = 400;
    return next(err);
  }

  try {
    // Check the token.
    const domain = await invite.check(token);

    // The token was valid! Save it to the session.
    req.session.invite = { token, domain };
    res.redirect('/');
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
