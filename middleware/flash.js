const push = (req, res) => (type, msg) => {
  // Check to see if the flash is init or not.
  if (!Array.isArray(req.session.flash)) {
    res.locals.flash = req.session.flash = [];
  }

  // Push the message into that flash.
  res.locals.flash.push({
    message: msg,
    type: type,
  });
};

module.exports = (req, res, next) => {
  res.locals.flash = req.session.flash;
  req.flash = push(req, res);
  next();
};
