const config = require('./config');
const winston = require('winston');
const transport = new winston.transports.Console({ handleExceptions: true });
const logger = winston.createLogger({
  transports: [transport],
});

if (config.get('env') !== 'production') {
  logger.format = winston.format.simple();
}

if (config.get('verbose_logs')) {
  transport.level = 'debug';
}

module.exports = logger;
