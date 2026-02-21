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

function stripHtml(value) {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function scoreText(queryTokens, text) {
  const haystack = new Set(tokenize(text));
  let score = 0;
  for (const token of queryTokens) {
    if (haystack.has(token)) {
      score += 1;
    }
  }
  return score;
}

async function callMoodleWs(config, wsfunction, params) {
  if (!config.retrievalMoodleBaseUrl || !config.retrievalMoodleToken) {
    throw makeError(
      'RETRIEVAL_UNAVAILABLE',
      'RETRIEVAL_MOODLE_BASE_URL and RETRIEVAL_MOODLE_TOKEN must be configured for moodle_ws provider.',
      true
    );
  }

  const form = new URLSearchParams();
  form.set('wstoken', config.retrievalMoodleToken);
  form.set('wsfunction', wsfunction);
  form.set('moodlewsrestformat', 'json');

  for (const [k, v] of Object.entries(params || {})) {
    if (v !== undefined && v !== null && v !== '') {
      form.set(k, String(v));
    }
  }

  const endpoint = `${config.retrievalMoodleBaseUrl.replace(/\/$/, '')}/webservice/rest/server.php`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });

  if (!res.ok) {
    throw makeError('RETRIEVAL_UNAVAILABLE', `Moodle WS returned HTTP ${res.status}.`, true);
  }

  const parsed = await res.json();
  if (parsed && parsed.exception) {
    throw makeError('RETRIEVAL_UNAVAILABLE', `Moodle WS error: ${parsed.errorcode || parsed.exception}.`, true);
  }
  return parsed;
}

async function retrieveFromMoodleWs({ queryText, intent, context, topK = 3, config }) {
  const queryTokens = tokenize(queryText);
  const citations = [];

  // 1) Course recommendations / navigation: search courses first.
  if (intent === 'course_recommendation' || intent === 'site_navigation' || intent === 'other') {
    let search = null;
    try {
      search = await callMoodleWs(config, 'core_course_search_courses', {
        criterianame: 'search',
        criteriavalue: queryText,
      });
    } catch (_err) {
      search = null;
    }

    const courses = Array.isArray(search && search.courses)
      ? search.courses
      : await callMoodleWs(config, 'core_course_get_courses', {});

    const ranked = courses
      .filter((c) => c && c.id && Number(c.id) > 1 && c.visible !== 0)
      .map((c) => {
        const summary = stripHtml(c.summary || '');
        const title = stripHtml(c.fullname || c.displayname || c.shortname || 'Course');
        const text = `${title} ${summary}`;
        return {
          score: scoreText(queryTokens, text),
          item: {
            source_id: `course_${c.id}`,
            title,
            url: `/course/view.php?id=${c.id}`,
            snippet: summary || `Course: ${title}`,
          },
        };
      })
      .filter((x) => x.score > 0 || intent === 'course_recommendation')
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map((x) => x.item);

    citations.push(...ranked);
  }

  // 2) Section explainer: pull current course sections/modules.
  if (intent === 'section_explainer' || (intent === 'course_recommendation' && context && context.course_id)) {
    const courseId = context && context.course_id ? Number(context.course_id) : 0;
    if (courseId > 0) {
      const sections = await callMoodleWs(config, 'core_course_get_contents', { courseid: courseId });
      const sectionDocs = (Array.isArray(sections) ? sections : [])
        .flatMap((section) => {
          const modules = Array.isArray(section.modules) ? section.modules : [];
          return modules.map((m) => {
            const title = stripHtml(m.name || section.name || 'Section content');
            const desc = stripHtml(m.description || section.summary || '');
            const url = m.url || `/course/view.php?id=${courseId}&section=${section.section || 0}`;
            return {
              source_id: `course_${courseId}_section_${section.section || 0}_module_${m.id || 'x'}`,
              title,
              url,
              snippet: desc || `Module: ${title}`,
            };
          });
        })
        .map((doc) => ({ score: scoreText(queryTokens, `${doc.title} ${doc.snippet}`), item: doc }))
        .sort((a, b) => b.score - a.score)
        .slice(0, topK)
        .map((x) => x.item);

      citations.push(...sectionDocs);
    }
  }

  const dedup = [];
  const seen = new Set();
  for (const c of citations) {
    if (!seen.has(c.source_id)) {
      seen.add(c.source_id);
      dedup.push(c);
    }
  }
  return dedup.slice(0, topK);
}

async function retrieveContext({ queryText, intentHint, intent, context, config, topK = 3 }) {
  if (config.retrievalProvider === 'catalog_api') {
    return retrieveFromCatalogApi({ queryText, intent, topK, config });
  }

  if (config.retrievalProvider === 'moodle_ws') {
    return retrieveFromMoodleWs({ queryText, intent, context, topK, config });
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
