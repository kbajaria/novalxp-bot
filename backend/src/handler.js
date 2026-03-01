'use strict';

const { performance } = require('node:perf_hooks');
const { createHash } = require('node:crypto');
const { validateRequest } = require('./validation');
const { classifyIntent } = require('./intent');
const { routeModel } = require('./routing');
const { makeError, toHttpStatus } = require('./errors');
const { config } = require('./config');
const { retrieveContext } = require('./retrieval');
const { converseWithBedrock } = require('./bedrock');
const { authorizeRequest } = require('./auth');

function response(statusCode, body) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}

function shouldRequireGrounding(intent) {
  return intent === 'course_recommendation'
    || intent === 'section_explainer'
    || intent === 'progress_completion'
    || intent === 'glossary_policy';
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
  if (intent === 'progress_completion') {
    return 'progress_completion';
  }
  if (intent === 'glossary_policy') {
    return 'glossary_policy';
  }
  return '';
}

async function retrieveForIntent(payload, intent) {
  return retrieveContext({
    queryText: payload.query.text,
    intentHint: intentToRetrievalHint(intent),
    intent,
    context: payload.context,
    user: payload.user,
    config,
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
      intent,
      userRole: payload.user && payload.user.role,
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
      intent,
      userRole: payload.user && payload.user.role,
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

function anonymizeText(input) {
  return String(input || '')
    .toLowerCase()
    .replace(/\b[\w.%+-]+@[\w.-]+\.[a-z]{2,}\b/g, '[email]')
    .replace(/\bhttps?:\/\/\S+\b/g, '[url]')
    .replace(/\b\d{6,}\b/g, '[number]')
    .replace(/\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/gi, '[id]')
    .replace(/\s+/g, ' ')
    .trim();
}

function canonicalizeQuestion(input) {
  return anonymizeText(input)
    .replace(/[^a-z0-9\[\]\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hashQuestion(value) {
  if (!value) {
    return '';
  }
  return createHash('sha1').update(value).digest('hex').slice(0, 16);
}

function buildActions(intent, citations) {
  if (intent !== 'course_recommendation') {
    return [];
  }
  return (citations || []).slice(0, 3).map((c) => ({
    type: 'open_url',
    label: `Open: ${c.title}`,
    url: c.url,
  }));
}

function ensureRecommendationCoverage(answerText, citations) {
  const top = (citations || []).slice(0, 3);
  if (!top.length) {
    return answerText;
  }

  const lower = String(answerText || '').toLowerCase();
  const missing = top.filter((c) => !lower.includes(String(c.title || '').toLowerCase()));
  if (!missing.length) {
    return answerText;
  }

  const lines = missing.map((c) => `- ${c.title}: ${c.url}`);
  return `${answerText}\n\nAdditional recommended courses from your catalog:\n${lines.join('\n')}`;
}

async function handler(event) {
  const started = performance.now();

  try {
    const authError = authorizeRequest(event && event.headers, config);
    if (authError) {
      return response(toHttpStatus(authError.code), {
        request_id: 'unknown',
        error: authError,
      });
    }

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
    const citations = await retrieveForIntent(payload, intent);

    if (shouldRequireGrounding(intent) && citations.length < config.retrievalMinCitations) {
      const err = makeError('RETRIEVAL_UNAVAILABLE', 'No retrieval context available for grounded response.', true);
      return response(toHttpStatus(err.code), { request_id: payload.request_id, error: err });
    }

    const result = await generateAnswer(payload, intent, modelId, citations);
    const elapsed = Math.round(performance.now() - started);
    const rawQuestion = payload && payload.query ? payload.query.text : '';
    const queryCanonical = canonicalizeQuestion(rawQuestion);
    const queryAnon = anonymizeText(rawQuestion);
    const topCitation = (result.citations || [])[0] || null;
    const answerPreview = anonymizeText(result.text || '').slice(0, 300);

    logRequest({
      request_id: payload.request_id,
      user_id: payload.user.id,
      intent,
      model_id: result.modelId,
      fallback_used: result.fallbackUsed,
      retrieved_chunk_count: citations.length,
      latency_ms: elapsed,
      query_text_anon: queryAnon,
      query_canonical: queryCanonical,
      query_hash: hashQuestion(queryCanonical),
      answer_preview_anon: answerPreview,
      top_citation_title: topCitation ? topCitation.title : '',
      top_citation_url: topCitation ? topCitation.url : '',
    });

    const answerText = intent === 'course_recommendation'
      ? ensureRecommendationCoverage(result.text, result.citations)
      : result.text;
    const actions = buildActions(intent, result.citations);

    return response(200, {
      request_id: payload.request_id,
      intent,
      answer: {
        text: answerText,
        confidence: result.confidence,
        citations: result.citations,
      },
      actions,
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
