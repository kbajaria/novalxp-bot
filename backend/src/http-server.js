'use strict';

const http = require('node:http');
const { randomUUID } = require('node:crypto');
const { handler } = require('./handler');

const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 3100);
const MAX_BODY_BYTES = Number(process.env.MAX_BODY_BYTES || 1024 * 1024);

function readBody(req) {
  return new Promise((resolve, reject) => {
    let total = 0;
    const chunks = [];

    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > MAX_BODY_BYTES) {
        reject(new Error('Payload too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function send(res, statusCode, body, headers) {
  const payload = typeof body === 'string' ? body : JSON.stringify(body);
  const finalHeaders = Object.assign(
    { 'content-type': 'application/json' },
    headers || {},
  );
  res.writeHead(statusCode, finalHeaders);
  res.end(payload);
}

async function route(req, res) {
  if (req.method === 'GET' && req.url === '/healthz') {
    send(res, 200, { ok: true });
    return;
  }

  if (req.method !== 'POST' || req.url !== '/v1/chat') {
    send(res, 404, { error: { code: 'NOT_FOUND', message: 'Not found' } });
    return;
  }

  try {
    const bodyText = await readBody(req);
    const requestId = randomUUID();

    const event = {
      body: bodyText,
      headers: req.headers || {},
      requestContext: {
        requestId,
      },
    };

    const result = await handler(event);
    const statusCode = Number(result && result.statusCode) || 500;
    const headers = (result && result.headers) || {};
    const body = (result && result.body) || JSON.stringify({
      request_id: requestId,
      error: { code: 'INTERNAL_ERROR', message: 'Empty response body from handler', retryable: false },
    });

    send(res, statusCode, body, headers);
  } catch (error) {
    send(res, 500, {
      request_id: 'unknown',
      error: {
        code: 'INTERNAL_ERROR',
        message: error && error.message ? error.message : 'Unhandled server error',
        retryable: false,
      },
    });
  }
}

const server = http.createServer((req, res) => {
  route(req, res);
});

server.listen(PORT, HOST, () => {
  console.log(`novalxp backend listening on http://${HOST}:${PORT}`);
});

