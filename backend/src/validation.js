'use strict';

const { makeError } = require('./errors');

function validateRequest(body) {
  if (!body || typeof body !== 'object') {
    return makeError('INVALID_REQUEST', 'Request body must be a JSON object.', false);
  }

  if (!body.request_id || typeof body.request_id !== 'string') {
    return makeError('INVALID_REQUEST', 'request_id is required and must be a string.', false);
  }
  if (!body.tenant_id || typeof body.tenant_id !== 'string') {
    return makeError('INVALID_REQUEST', 'tenant_id is required and must be a string.', false);
  }

  const userId = body.user && body.user.id;
  if (!userId || typeof userId !== 'string') {
    return makeError('INVALID_REQUEST', 'user.id is required and must be a string.', false);
  }

  const text = body.query && body.query.text;
  if (!text || typeof text !== 'string' || !text.trim()) {
    return makeError('INVALID_REQUEST', 'query.text is required and must be non-empty.', false);
  }

  const history = body.query && body.query.history;
  if (history && (!Array.isArray(history) || history.length > 20)) {
    return makeError('INVALID_REQUEST', 'query.history must be an array with at most 20 turns.', false);
  }

  const maxTokens = body.options && body.options.max_output_tokens;
  if (maxTokens !== undefined && (!Number.isInteger(maxTokens) || maxTokens < 100 || maxTokens > 2000)) {
    return makeError('INVALID_REQUEST', 'options.max_output_tokens must be an integer between 100 and 2000.', false);
  }

  return null;
}

module.exports = {
  validateRequest,
};
