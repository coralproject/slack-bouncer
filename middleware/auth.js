const { User, Team } = require('../models');

module.exports = async (req, res, next) => {
  res.locals.path = req.path;
  req.is_authenticated = false;
  res.locals.is_authenticated = false;

  if (req.session) {
    try {
      if (req.session.user_id && req.session.team_id) {
        req.user = await User.findOne({ id: req.session.user_id });
        if (!req.user) {
          return next(new Error('user not found'));
        }

        res.locals.user = req.user;

        req.team = await Team.findOne({ id: req.session.team_id });
        if (!req.team) {
          return next(new Error('team not found'));
        }

        res.locals.team = req.team;

        // If the account was disabled, always log them out now.
        if (req.team.disabled || req.user.disabled) {
          return req.session.regenerate(err => {
            if (err) {
              return next(err);
            }

            req.flash(
              'danger',
              'Your account has been disabled. Contact The Coral Project for information.'
            );
            res.redirect('/');
          });
        }

        res.locals.is_authenticated = req.is_authenticated = true;
        res.locals.scope = req.session.scope;
      }
    } catch (err) {
      return next(err);
    }
  }

  next();
};
