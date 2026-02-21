'use strict';

const { performance } = require('node:perf_hooks');
const { validateRequest } = require('./validation');
const { classifyIntent } = require('./intent');
const { routeModel } = require('./routing');
const { makeError, toHttpStatus } = require('./errors');

const REGION = 'eu-west-2';

function response(statusCode, body) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}

async function retrieveContext() {
  // TODO: replace with OpenSearch Serverless retrieval.
  return [
    {
      source_id: 'placeholder_source',
      title: 'Placeholder Source',
      url: '/course/view.php?id=1',
      snippet: 'Replace with real retrieval result.',
    },
  ];
}

async function generateAnswer(payload, intent, modelId, citations) {
  // TODO: replace with Bedrock Runtime call.
  return {
    text: `Stub answer for intent=${intent}. Query: ${payload.query.text}`,
    confidence: 0.7,
    citations,
    modelId,
  };
}

async function handler(event) {
  const started = performance.now();

  try {
    const payload = typeof event.body === 'string' ? JSON.parse(event.body) : (event.body || event);
    const validationError = validateRequest(payload);

    if (validationError) {
      return response(toHttpStatus(validationError.code), {
        request_id: payload && payload.request_id ? payload.request_id : 'unknown',
        error: validationError,
      });
    }

    const intent = classifyIntent(payload.query.text);
    const modelId = routeModel(intent);
    const citations = await retrieveContext(payload, intent);

    if ((intent === 'course_recommendation' || intent === 'section_explainer') && citations.length < 1) {
      const err = makeError('RETRIEVAL_UNAVAILABLE', 'No retrieval context available for grounded response.', true);
      return response(toHttpStatus(err.code), { request_id: payload.request_id, error: err });
    }

    const result = await generateAnswer(payload, intent, modelId, citations);
    const elapsed = Math.round(performance.now() - started);

    return response(200, {
      request_id: payload.request_id,
      intent,
      answer: {
        text: result.text,
        confidence: result.confidence,
        citations: result.citations,
      },
      actions: [],
      meta: {
        region: REGION,
        model_id: result.modelId,
        fallback_used: false,
        latency_ms: elapsed,
      },
    });
  } catch (e) {
    const err = makeError('INTERNAL_ERROR', e && e.message ? e.message : 'Unhandled error', false);
    return response(toHttpStatus(err.code), {
      request_id: 'unknown',
      error: err,
    });
  }
}

module.exports = {
  handler,
};
