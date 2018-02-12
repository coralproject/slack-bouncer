const config = require('./config');
const express = require('express');
const logger = require('./logger');
const middleware = require('./middleware');
const bodyParser = require('body-parser');
const path = require('path');
const routes = require('./routes');
const helmet = require('helmet');
const reporting = require('./reporting');

const app = express();

// View engine setup.
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.set('trust proxy', 1);

// Application wide middleware.
app.use(middleware.logging.log);
app.use(helmet());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use('/static', express.static(path.join(__dirname, 'public')));
app.use(middleware.session);
app.use(middleware.flash);
app.use(middleware.auth);
app.use(middleware.locals);
app.use(routes);
app.use(middleware.notFound);
app.use(middleware.logging.error);
app.use(reporting.express);
app.use(middleware.error);

/**
 * listen starts the server on the designated ports.
 */
function listen(port = config.get('port'), host = config.get('host')) {
  app.listen(port, host, () => {
    logger.info('Server Listening', {
      host,
      port,
    });
  });
}

module.exports = { listen };
