const client = require('prom-client');

const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests made.',
  labelNames: ['code', 'method'],
});

const httpRequestDurationMilliseconds = new client.Histogram({
  name: 'http_request_duration_milliseconds',
  help: 'Histogram of latencies for HTTP requests.',
  buckets: [0.1, 5, 15, 50, 100, 500],
  labelNames: ['method', 'handler'],
});

const processedCommentsTotal = new client.Counter({
  name: 'processed_comments_total',
  help: 'Total number of processed comments submitted.',
  labelNames: ['domain'],
});

// Configure the prom client to send default metrics.
client.collectDefaultMetrics({ prefix: 'slack_' });

// Export the configuration.
module.exports = {
  client,
  metrics: {
    httpRequestsTotal,
    httpRequestDurationMilliseconds,
    processedCommentsTotal,
  },
};
