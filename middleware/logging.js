const logger = require('../logger');
const {
  metrics: { httpRequestsTotal, httpRequestDurationMilliseconds },
} = require('../metrics');

const log = (req, res, next) => {
  const startTime = Date.now();
  const end = res.end;
  res.end = function(chunk, encoding) {
    // Compute the end time.
    const responseTime = Date.now() - startTime;

    // Increment the request counter.
    httpRequestsTotal.labels(res.statusCode, req.method).inc();

    // Add the request duration.
    httpRequestDurationMilliseconds
      .labels(req.method, req.baseUrl + req.path)
      .observe(responseTime);

    // Reattach the old end, and finish.
    res.end = end;
    res.end(chunk, encoding);

    // Log this out to winston.
    logger.info('http request', {
      url: req.originalUrl || req.url,
      method: req.method,
      statusCode: res.statusCode,
      responseTime,
    });
  };

  next();
};

const error = (err, req, res, next) => {
  logger.error('http error', { err: err.message });
  next(err);
};

module.exports = {
  log,
  error,
};
