'use strict';

const HTTP_BY_CODE = {
  INVALID_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  MODEL_ACCESS_DENIED: 503,
  RETRIEVAL_UNAVAILABLE: 503,
  TIMEOUT: 504,
  INTERNAL_ERROR: 500,
};

function makeError(code, message, retryable) {
  return { code, message, retryable: Boolean(retryable) };
}

function toHttpStatus(code) {
  return HTTP_BY_CODE[code] || 500;
}

module.exports = {
  makeError,
  toHttpStatus,
};
