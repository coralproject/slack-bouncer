const { client } = require('../metrics');

module.exports = (req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(client.register.metrics());
};
