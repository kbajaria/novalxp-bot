'use strict';

const { performance } = require('node:perf_hooks');
const { validateRequest } = require('./validation');
const { classifyIntent } = require('./intent');
const { routeModel } = require('./routing');
const { makeError, toHttpStatus } = require('./errors');
const { config } = require('./config');
const { retrieveLocal } = require('./retrieval');
const { converseWithBedrock } = require('./bedrock');

function response(statusCode, body) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}

function shouldRequireGrounding(intent) {
  return intent === 'course_recommendation' || intent === 'section_explainer';
}

function intentToRetrievalHint(intent) {
  if (intent === 'course_recommendation') {
    return 'recommendation';
  }
  if (intent === 'section_explainer') {
    return 'section_explainer';
  }
  if (intent === 'site_navigation') {
    return 'site_navigation';
  }
  return '';
}

async function retrieveContext(payload, intent) {
  return retrieveLocal({
    queryText: payload.query.text,
    intentHint: intentToRetrievalHint(intent),
    corpusPath: config.retrievalCorpusPath,
    topK: 3,
  });
}

async function generateAnswer(payload, intent, modelId, citations) {
  if (!config.useBedrock) {
    return {
      text: `Stub answer for intent=${intent}. Query: ${payload.query.text}`,
      confidence: 0.7,
      citations,
      modelId,
      fallbackUsed: false,
    };
  }

  const maxTokens = payload.options && payload.options.max_output_tokens
    ? payload.options.max_output_tokens
    : config.maxTokensDefault;

  try {
    const primary = await converseWithBedrock({
      region: config.region,
      modelId,
      userText: payload.query.text,
      citations,
      maxTokens,
      temperature: 0,
    });

    return {
      text: primary.text,
      confidence: 0.8,
      citations,
      modelId,
      fallbackUsed: false,
    };
  } catch (err) {
    if (!(payload.options && payload.options.allow_model_fallback)) {
      throw err;
    }

    const fallback = await converseWithBedrock({
      region: config.region,
      modelId: config.fallbackModelId,
      userText: payload.query.text,
      citations,
      maxTokens,
      temperature: 0,
    });

    return {
      text: fallback.text,
      confidence: 0.75,
      citations,
      modelId: config.fallbackModelId,
      fallbackUsed: true,
    };
  }
}

function logRequest(details) {
  // Structured log fields from API contract observability section.
  console.log(JSON.stringify(details));
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

    if (shouldRequireGrounding(intent) && citations.length < config.retrievalMinCitations) {
      const err = makeError('RETRIEVAL_UNAVAILABLE', 'No retrieval context available for grounded response.', true);
      return response(toHttpStatus(err.code), { request_id: payload.request_id, error: err });
    }

    const result = await generateAnswer(payload, intent, modelId, citations);
    const elapsed = Math.round(performance.now() - started);

    logRequest({
      request_id: payload.request_id,
      user_id: payload.user.id,
      intent,
      model_id: result.modelId,
      fallback_used: result.fallbackUsed,
      retrieved_chunk_count: citations.length,
      latency_ms: elapsed,
    });

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
        region: config.region,
        model_id: result.modelId,
        fallback_used: result.fallbackUsed,
        latency_ms: elapsed,
      },
    });
  } catch (e) {
    const err = e && e.code ? e : makeError('INTERNAL_ERROR', e && e.message ? e.message : 'Unhandled error', false);
    return response(toHttpStatus(err.code), {
      request_id: 'unknown',
      error: err,
    });
  }
}

module.exports = {
  handler,
};
