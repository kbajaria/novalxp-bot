'use strict';

const fs = require('node:fs');
const { makeError } = require('./errors');

function tokenize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function loadCorpus(corpusPath) {
  const raw = fs.readFileSync(corpusPath, 'utf8');
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : [];
}

function scoreDoc(queryTokens, doc, intentHint) {
  const haystack = tokenize(`${doc.title || ''} ${doc.snippet || ''} ${(doc.tags || []).join(' ')}`);
  const set = new Set(haystack);
  let score = 0;
  for (const token of queryTokens) {
    if (set.has(token)) {
      score += 1;
    }
  }
  if (intentHint && Array.isArray(doc.tags) && doc.tags.includes(intentHint)) {
    score += 2;
  }
  return score;
}

function retrieveLocal({ queryText, intentHint, corpusPath, topK = 3 }) {
  const corpus = loadCorpus(corpusPath);
  const queryTokens = tokenize(queryText);

  return corpus
    .map((doc) => ({ doc, score: scoreDoc(queryTokens, doc, intentHint) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((item) => ({
      source_id: item.doc.source_id,
      title: item.doc.title,
      url: item.doc.url,
      snippet: item.doc.snippet,
    }));
}

async function retrieveFromCatalogApi({ queryText, intent, topK = 3, config }) {
  if (!config.retrievalCatalogApiUrl) {
    throw makeError('RETRIEVAL_UNAVAILABLE', 'RETRIEVAL_CATALOG_API_URL is not configured.', true);
  }

  const body = {
    query: queryText,
    intent,
    top_k: topK,
  };

  const headers = { 'content-type': 'application/json' };
  if (config.retrievalCatalogApiToken) {
    headers.authorization = `Bearer ${config.retrievalCatalogApiToken}`;
  }

  const res = await fetch(config.retrievalCatalogApiUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw makeError('RETRIEVAL_UNAVAILABLE', `Catalog API returned ${res.status}.`, true);
  }

  const parsed = await res.json();
  const items = Array.isArray(parsed.citations) ? parsed.citations : [];

  return items.slice(0, topK).map((c, idx) => ({
    source_id: c.source_id || `catalog_${idx + 1}`,
    title: c.title || 'Catalog Source',
    url: c.url || '',
    snippet: c.snippet || '',
  }));
}

async function retrieveContext({ queryText, intentHint, intent, config, topK = 3 }) {
  if (config.retrievalProvider === 'catalog_api') {
    return retrieveFromCatalogApi({ queryText, intent, topK, config });
  }

  if (config.retrievalProvider === 'opensearch') {
    throw makeError('RETRIEVAL_UNAVAILABLE', 'OpenSearch provider is not wired yet.', true);
  }

  return retrieveLocal({
    queryText,
    intentHint,
    corpusPath: config.retrievalCorpusPath,
    topK,
  });
}

module.exports = {
  retrieveContext,
};
