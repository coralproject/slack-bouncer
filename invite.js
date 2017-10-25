const redis = require('./redis');
const crypto = require('crypto');

async function createInvitation(domain) {
  // Create the token.
  const buffer = crypto.randomBytes(10);
  const token = buffer.toString('hex');

  // Create the invite, expire it after a day.
  await redis.set(`invite:${token}`, domain, 'EX', 86400);

  return token;
}

async function checkInvitation(token) {
  const domain = await redis.get(`invite:${token}`);
  if (!domain || domain.length === 0) {
    throw new Error('Invalid invite token');
  }

  return domain;
}

async function useInvitation(token) {
  const removed = await redis.del(`invite:${token}`);
  if (removed !== 1) {
    throw new Error('Invalid invite token');
  }
}

module.exports = {
  create: createInvitation,
  check: checkInvitation,
  use: useInvitation,
};
