'use strict';

const { makeError } = require('./errors');

function normalizeHeaders(headers) {
  const out = {};
  for (const [k, v] of Object.entries(headers || {})) {
    out[String(k).toLowerCase()] = v;
  }
  return out;
}

function parseBearerToken(headers) {
  const normalized = normalizeHeaders(headers);
  const authHeader = normalized.authorization;
  if (!authHeader || typeof authHeader !== 'string') {
    return null;
  }
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return null;
  }
  return match[1].trim();
}

function authorizeRequest(headers, config) {
  if (!config.apiAuthEnabled) {
    return null;
  }

  const token = parseBearerToken(headers);
  if (!token) {
    return makeError('UNAUTHORIZED', 'Missing or invalid Bearer token.', false);
  }

  if (!config.apiKeys.length) {
    return makeError('UNAUTHORIZED', 'API auth is enabled but no API keys are configured.', false);
  }

  if (!config.apiKeys.includes(token)) {
    return makeError('UNAUTHORIZED', 'Invalid API token.', false);
  }

  return null;
}

module.exports = {
  authorizeRequest,
};
