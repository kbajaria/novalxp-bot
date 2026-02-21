'use strict';

const fs = require('node:fs');

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

  const ranked = corpus
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

  return ranked;
}

module.exports = {
  retrieveLocal,
};
