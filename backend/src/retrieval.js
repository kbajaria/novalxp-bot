'use strict';

const fs = require('node:fs');
const http = require('node:http');
const https = require('node:https');
const { makeError } = require('./errors');

const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'is', 'are', 'was', 'were', 'be', 'been',
  'to', 'of', 'for', 'in', 'on', 'at', 'by', 'with', 'from', 'as',
  'i', 'me', 'my', 'you', 'your', 'we', 'our', 'it', 'this', 'that',
  'what', 'where', 'when', 'how', 'which', 'who', 'there',
  'do', 'does', 'did', 'can', 'could', 'should', 'would',
  'course', 'courses'
]);

function tokenize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token && token.length > 1 && !STOPWORDS.has(token));
}

function loadCorpus(corpusPath) {
  const raw = fs.readFileSync(corpusPath, 'utf8');
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : [];
}

function scoreDoc(queryTokens, doc, intentHint, queryText = '') {
  const haystack = tokenize(`${doc.title || ''} ${doc.snippet || ''} ${(doc.tags || []).join(' ')}`);
  const set = new Set(haystack);
  const tags = Array.isArray(doc.tags) ? doc.tags.map((t) => String(t).toLowerCase()) : [];
  const rawText = `${doc.title || ''} ${doc.snippet || ''}`.toLowerCase();
  const onboardingQuery = /onboard|induction|new starter/.test(String(queryText || '').toLowerCase());
  let score = 0;

  for (const token of queryTokens) {
    if (set.has(token)) {
      score += token.startsWith('onboard') ? 4 : 1;
    }
  }

  if (intentHint && Array.isArray(doc.tags) && doc.tags.includes(intentHint)) {
    score += 2;
  }

  if (onboardingQuery) {
    if (tags.includes('onboarding') || /onboard|induction|new starter/.test(rawText)) {
      score += 10;
    } else {
      score -= 2;
    }
  }

  return score;
}

function retrieveLocal({ queryText, intentHint, corpusPath, topK = 3 }) {
  const corpus = loadCorpus(corpusPath);
  const queryTokens = tokenize(queryText);

  return corpus
    .map((doc) => ({ doc, score: scoreDoc(queryTokens, doc, intentHint, queryText) }))
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

function retrieveLocalSafe({ queryText, intentHint, corpusPath, topK = 3 }) {
  try {
    if (!corpusPath || !fs.existsSync(corpusPath)) {
      return [];
    }
    return retrieveLocal({ queryText, intentHint, corpusPath, topK });
  } catch (_err) {
    return [];
  }
}

function retrieveFaqForIntent({ queryText, intent, corpusPath, topK = 2 }) {
  try {
    if (!corpusPath || !fs.existsSync(corpusPath)) {
      return [];
    }
    const corpus = loadCorpus(corpusPath);
    const queryTokens = tokenize(queryText);
    const scoreItems = (docs) => docs
      .map((doc) => ({ doc, score: scoreDoc(queryTokens, doc, intent, queryText) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map((item) => ({
        source_id: item.doc.source_id,
        title: item.doc.title,
        url: item.doc.url,
        snippet: item.doc.snippet,
      }));

    const intentMatched = corpus.filter((doc) => Array.isArray(doc.tags) && doc.tags.includes(intent));
    const rankedIntent = scoreItems(intentMatched);
    return rankedIntent;
  } catch (_err) {
    return [];
  }
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
  const headers = {
    'content-type': 'application/x-www-form-urlencoded',
    // Local loopback calls need to be treated as HTTPS in Moodle context to avoid redirects.
    'x-forwarded-proto': 'https',
  };
  if (config.retrievalMoodleForwardedHost) {
    headers.host = config.retrievalMoodleForwardedHost;
    headers['x-forwarded-host'] = config.retrievalMoodleForwardedHost;
  }

  const response = await postFormUrlEncoded({
    endpoint,
    body: form.toString(),
    headers,
    timeoutMs: Math.max(1000, Number(config.retrievalMoodleTimeoutMs || 15000)),
  });

  if (response.statusCode < 200 || response.statusCode >= 300) {
    if (response.statusCode >= 300 && response.statusCode < 400) {
      throw makeError(
        'RETRIEVAL_UNAVAILABLE',
        `Moodle WS redirected (${response.statusCode}) to ${response.headers.location || 'unknown location'}.`,
        true
      );
    }
    throw makeError('RETRIEVAL_UNAVAILABLE', `Moodle WS returned HTTP ${response.statusCode}.`, true);
  }

  let parsed;
  try {
    parsed = JSON.parse(response.body || '{}');
  } catch (_err) {
    throw makeError(
      'RETRIEVAL_UNAVAILABLE',
      `Moodle WS returned non-JSON response (HTTP ${response.statusCode}).`,
      true
    );
  }
  if (parsed && parsed.exception) {
    throw makeError('RETRIEVAL_UNAVAILABLE', `Moodle WS error: ${parsed.errorcode || parsed.exception}.`, true);
  }
  return parsed;
}

function postFormUrlEncoded({ endpoint, body, headers, timeoutMs }) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint);
    const transport = url.protocol === 'https:' ? https : http;
    const payload = String(body || '');
    const req = transport.request({
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: `${url.pathname}${url.search}`,
      method: 'POST',
      headers: {
        ...headers,
        'content-length': Buffer.byteLength(payload),
      },
    }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        resolve({
          statusCode: Number(res.statusCode || 0),
          headers: res.headers || {},
          body: Buffer.concat(chunks).toString('utf8'),
        });
      });
    });

    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`Timeout after ${timeoutMs}ms`));
    });
    req.on('error', (err) => {
      reject(makeError('RETRIEVAL_UNAVAILABLE', `Moodle WS request failed: ${err.message}`, true));
    });
    req.write(payload);
    req.end();
  });
}

async function getEnrolledCourseMap(config, userId) {
  const id = Number(userId);
  if (!id) {
    return new Map();
  }
  try {
    const enrolled = await callMoodleWs(config, 'core_enrol_get_users_courses', { userid: id });
    const map = new Map();
    for (const c of Array.isArray(enrolled) ? enrolled : []) {
      if (c && c.id) {
        map.set(Number(c.id), true);
      }
    }
    return map;
  } catch (_err) {
    return new Map();
  }
}

async function getEnrolledCourses(config, userId) {
  const id = Number(userId);
  if (!id) {
    return [];
  }
  try {
    const enrolled = await callMoodleWs(config, 'core_enrol_get_users_courses', { userid: id });
    return (Array.isArray(enrolled) ? enrolled : [])
      .map(normalizeCourseFromWs)
      .filter(Boolean);
  } catch (_err) {
    return [];
  }
}

async function getCompletionStatusMap(config, userId, courseIds) {
  const id = Number(userId);
  if (!id) {
    return new Map();
  }

  const map = new Map();
  const unique = [...new Set(courseIds.map(Number).filter(Boolean))].slice(0, 20);

  for (const courseId of unique) {
    try {
      const status = await callMoodleWs(config, 'core_completion_get_course_completion_status', {
        userid: id,
        courseid: courseId,
      });
      const completed = Boolean(
        status &&
        status.completionstatus &&
        (status.completionstatus.completed || status.completionstatus.complete)
      );
      map.set(courseId, completed);
    } catch (_err) {
      // Function may be unavailable or not permitted; leave unknown.
    }
  }
  return map;
}

async function getUserDepartment(config, userId) {
  const id = Number(userId);
  if (!id) {
    return '';
  }
  try {
    const result = await callMoodleWs(config, 'core_user_get_users_by_field', {
      field: 'id',
      'values[0]': id,
    });
    const user = Array.isArray(result) && result.length ? result[0] : null;
    return stripHtml(user && user.department ? user.department : '');
  } catch (_err) {
    return '';
  }
}

function departmentKeywordMap() {
  return {
    engineering: ['engineering', 'developer', 'api', 'architecture', 'security', 'technical', 'software'],
    product: ['product', 'roadmap', 'discovery', 'ux', 'stakeholder', 'prioritisation', 'outcome'],
    'customer success': ['customer success', 'client', 'engagement', 'onboarding', 'service'],
    'customer support': ['support', 'ticket', 'incident', 'service desk', 'customer'],
    people: ['people', 'hr', 'policy', 'compliance', 'onboarding', 'conduct', 'benefits'],
    hr: ['people', 'hr', 'policy', 'compliance', 'onboarding', 'conduct', 'benefits'],
    finance: ['finance', 'risk', 'compliance', 'aml', 'kyc', 'financial crime'],
    operations: ['operations', 'process', 'workflow', 'controls', 'quality', 'service'],
    sales: ['sales', 'pipeline', 'prospecting', 'crm', 'commercial'],
    marketing: ['marketing', 'campaign', 'brand', 'content', 'go to market'],
  };
}

function normalizeDepartment(value) {
  return String(value || '').toLowerCase().trim();
}

function departmentBoost(course, department) {
  const dep = normalizeDepartment(department);
  if (!dep) {
    return 0;
  }
  const map = departmentKeywordMap();
  const key = Object.keys(map).find((k) => dep.includes(k));
  if (!key) {
    return 0;
  }
  const keywords = map[key];
  const text = `${stripHtml(course.fullname || course.displayname || course.shortname || '')} ${stripHtml(course.summary || '')}`.toLowerCase();
  let matches = 0;
  for (const kw of keywords) {
    if (text.includes(kw)) {
      matches += 1;
    }
  }
  return matches > 0 ? Math.min(4, matches) : 0;
}

async function getActivityCompletionMap(config, userId, courseId) {
  const uid = Number(userId);
  const cid = Number(courseId);
  const map = new Map();
  if (!uid || !cid) {
    return map;
  }

  try {
    const result = await callMoodleWs(config, 'core_completion_get_activities_completion_status', {
      userid: uid,
      courseid: cid,
    });
    const statuses = Array.isArray(result && result.statuses) ? result.statuses : [];
    for (const s of statuses) {
      const cmid = Number(s && (s.cmid || s.coursemoduleid));
      if (!cmid) {
        continue;
      }
      const state = Number(s && (s.state ?? s.completionstate ?? s.complete));
      if (!Number.isNaN(state)) {
        map.set(cmid, state);
      }
    }
  } catch (_err) {
    // Optional WS function; fallback to completiondata from core_course_get_contents.
  }
  return map;
}

function completionStateFromValue(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const n = Number(value);
  if (Number.isNaN(n)) {
    return null;
  }
  if (n <= 0) {
    return false;
  }
  return true;
}

function completionReasonFromModule(module) {
  const completionData = module && module.completiondata ? module.completiondata : null;
  const details = Array.isArray(completionData && completionData.details) ? completionData.details : [];
  const unmet = details
    .filter((d) => d && String(d.status || '').toLowerCase() !== 'complete')
    .map((d) => {
      const raw = d && (d.rulevalue ?? d.rulename ?? d.status ?? '');
      if (raw && typeof raw === 'object') {
        const named = raw.name || raw.label || raw.description || raw.status || '';
        if (named) {
          return stripHtml(String(named));
        }
        return stripHtml(JSON.stringify(raw));
      }
      return stripHtml(String(raw || ''));
    })
    .filter(Boolean)
    .slice(0, 3);
  if (!unmet.length) {
    return '';
  }
  return `Remaining conditions: ${unmet.join('; ')}`;
}

function moduleCompletionState(module, activityCompletionMap) {
  const cmid = Number(module && module.id);
  if (cmid && activityCompletionMap.has(cmid)) {
    return completionStateFromValue(activityCompletionMap.get(cmid));
  }

  const completionData = module && module.completiondata ? module.completiondata : null;
  const candidates = [
    completionData && completionData.state,
    completionData && completionData.completionstate,
    completionData && completionData.completed,
    completionData && completionData.complete,
  ];
  for (const value of candidates) {
    const normalized = completionStateFromValue(value);
    if (normalized !== null) {
      return normalized;
    }
  }
  return null;
}

function scoreCourseRecommendation(queryTokens, course, enrolledMap, completionMap, department, broadRecommendationQuery) {
  const summary = stripHtml(course.summary || '');
  const title = stripHtml(course.fullname || course.displayname || course.shortname || 'Course');
  let score = scoreText(queryTokens, `${title} ${summary}`);

  const courseId = Number(course.id);
  const enrolled = enrolledMap.get(courseId) === true;
  const completed = completionMap.has(courseId) ? completionMap.get(courseId) : null;

  if (enrolled && completed === false) {
    score += 4;
  } else if (enrolled && completed === true) {
    score -= 5;
  } else if (!enrolled) {
    score += 1;
  }

  const depBoost = departmentBoost(course, department);
  score += broadRecommendationQuery ? depBoost * 3 : depBoost;

  return score;
}

function normalizeCourseFromWs(c) {
  if (!c || !c.id || Number(c.id) <= 1 || c.visible === 0 || c.format === 'site') {
    return null;
  }
  return {
    id: Number(c.id),
    title: stripHtml(c.fullname || c.displayname || c.shortname || 'Course'),
    summary: stripHtml(c.summary || ''),
  };
}

async function resolveSectionCourseIds({ config, context, queryText, queryTokens, maxCourses = 2 }) {
  const ids = [];
  const fromContext = context && context.course_id ? Number(context.course_id) : 0;
  if (fromContext > 0) {
    ids.push(fromContext);
  }

  if (ids.length >= maxCourses) {
    return ids.slice(0, maxCourses);
  }

  const search = await searchCourses(config, queryText);
  const rawCourses = Array.isArray(search && search.courses) ? search.courses : [];
  const ranked = rawCourses
    .map(normalizeCourseFromWs)
    .filter(Boolean)
    .map((c) => ({
      id: c.id,
      score: scoreText(queryTokens, `${c.title} ${c.summary}`),
    }))
    .sort((a, b) => b.score - a.score);

  for (const c of ranked) {
    if (!ids.includes(c.id)) {
      ids.push(c.id);
    }
    if (ids.length >= maxCourses) {
      break;
    }
  }

  if (ids.length < maxCourses && ranked.length === 0) {
    const allCourses = await callMoodleWs(config, 'core_course_get_courses', {});
    const fallbackRanked = (Array.isArray(allCourses) ? allCourses : [])
      .map(normalizeCourseFromWs)
      .filter(Boolean)
      .map((c) => ({
        id: c.id,
        score: scoreText(queryTokens, `${c.title} ${c.summary}`),
      }))
      .filter((c) => c.score > 0)
      .sort((a, b) => b.score - a.score);

    for (const c of fallbackRanked) {
      if (!ids.includes(c.id)) {
        ids.push(c.id);
      }
      if (ids.length >= maxCourses) {
        break;
      }
    }
  }

  return ids.slice(0, maxCourses);
}

async function resolveProgressCourseIds({ config, context, queryText, queryTokens, userId, maxCourses = 3 }) {
  const ids = [];
  const contextCourseId = context && context.course_id ? Number(context.course_id) : 0;
  if (contextCourseId > 0) {
    ids.push(contextCourseId);
  }
  if (ids.length >= maxCourses) {
    return ids.slice(0, maxCourses);
  }

  const fromQuery = await resolveSectionCourseIds({
    config,
    context,
    queryText,
    queryTokens,
    maxCourses,
  });
  for (const courseId of fromQuery) {
    if (!ids.includes(courseId)) {
      ids.push(courseId);
    }
    if (ids.length >= maxCourses) {
      return ids.slice(0, maxCourses);
    }
  }

  const enrolled = await getEnrolledCourses(config, userId);
  if (!enrolled.length) {
    return ids.slice(0, maxCourses);
  }

  const completionMap = await getCompletionStatusMap(config, userId, enrolled.map((c) => c.id));
  const incomplete = enrolled.filter((c) => completionMap.get(c.id) !== true);

  const ranked = (incomplete.length ? incomplete : enrolled)
    .map((c) => ({
      id: c.id,
      score: scoreText(queryTokens, `${c.title} ${c.summary}`),
    }))
    .sort((a, b) => b.score - a.score);

  for (const c of ranked) {
    if (!ids.includes(c.id)) {
      ids.push(c.id);
    }
    if (ids.length >= maxCourses) {
      break;
    }
  }

  return ids.slice(0, maxCourses);
}

function extractLikelyTerm(queryText) {
  const q = String(queryText || '').trim();
  const quoted = q.match(/["'“”](.+?)["'“”]/);
  if (quoted && quoted[1]) {
    return quoted[1].trim();
  }
  const unquoted = q.match(/what does\s+(.+?)\s+mean/i);
  if (unquoted && unquoted[1]) {
    return unquoted[1].trim();
  }
  return '';
}

async function resolvePolicyCourseIds({ config, context, queryText, queryTokens, maxCourses = 3 }) {
  const ids = [];
  const fromContext = context && context.course_id ? Number(context.course_id) : 0;
  if (fromContext > 0) {
    ids.push(fromContext);
  }
  if (ids.length >= maxCourses) {
    return ids.slice(0, maxCourses);
  }

  const fromQuery = await resolveSectionCourseIds({
    config,
    context,
    queryText,
    queryTokens,
    maxCourses,
  });
  for (const id of fromQuery) {
    if (!ids.includes(id)) {
      ids.push(id);
    }
    if (ids.length >= maxCourses) {
      return ids.slice(0, maxCourses);
    }
  }

  const allCourses = await callMoodleWs(config, 'core_course_get_courses', {});
  const ranked = (Array.isArray(allCourses) ? allCourses : [])
    .map(normalizeCourseFromWs)
    .filter(Boolean)
    .map((c) => {
      const hay = `${c.title} ${c.summary}`.toLowerCase();
      const onboardingBoost = /onboard|induction|starter/.test(hay) ? 3 : 0;
      return {
        id: c.id,
        score: scoreText(queryTokens, `${c.title} ${c.summary}`) + onboardingBoost,
      };
    })
    .sort((a, b) => b.score - a.score);

  for (const c of ranked) {
    if (!ids.includes(c.id)) {
      ids.push(c.id);
    }
    if (ids.length >= maxCourses) {
      break;
    }
  }

  return ids.slice(0, maxCourses);
}

async function getGlossariesByCourses(config, courseIds) {
  const ids = [...new Set((courseIds || []).map(Number).filter(Boolean))].slice(0, 10);
  if (!ids.length) {
    return [];
  }
  const params = {};
  ids.forEach((id, idx) => {
    params[`courseids[${idx}]`] = id;
  });

  try {
    const result = await callMoodleWs(config, 'mod_glossary_get_glossaries_by_courses', params);
    const glossaries = Array.isArray(result && result.glossaries) ? result.glossaries : [];
    return glossaries.filter((g) => g && g.id).map((g) => ({
      id: Number(g.id),
      courseId: Number(g.course || g.courseid || 0),
      name: stripHtml(g.name || 'Glossary'),
      intro: stripHtml(g.intro || ''),
    }));
  } catch (_err) {
    return [];
  }
}

async function getGlossaryEntries(config, glossaryId, queryText) {
  const gid = Number(glossaryId);
  if (!gid) {
    return [];
  }

  const attempts = [
    () => callMoodleWs(config, 'mod_glossary_get_entries_by_search', {
      glossaryid: gid,
      query: queryText,
      fullsearch: 1,
      from: 0,
      limitnum: 30,
    }),
    () => callMoodleWs(config, 'mod_glossary_get_entries_by_letter', {
      glossaryid: gid,
      letter: 'ALL',
      from: 0,
      limitnum: 50,
    }),
  ];

  for (const attempt of attempts) {
    try {
      const result = await attempt();
      const entries = Array.isArray(result && result.entries) ? result.entries : [];
      if (entries.length) {
        return entries;
      }
    } catch (_err) {
      // Try next function.
    }
  }
  return [];
}

async function retrieveFromMoodleWs({ queryText, intent, context, user, topK = 3, config }) {
  const queryTokens = tokenize(queryText);
  const broadRecommendationQuery = queryTokens.length <= 2
    || /recommend|what next|study next|take next|next course|learning plan/.test(String(queryText || '').toLowerCase());
  const citations = [];
  const faqCitations = retrieveFaqForIntent({
    queryText,
    intent,
    corpusPath: config.retrievalFaqCorpusPath,
    topK: Math.min(2, topK),
  });
  if (faqCitations.length) {
    citations.push(...faqCitations);
  }

  // 1) Course recommendations / navigation: search courses first.
  if (intent === 'course_recommendation' || intent === 'site_navigation' || intent === 'other') {
    const search = await searchCourses(config, queryText);
    const courses = Array.isArray(search && search.courses)
      ? search.courses
      : await callMoodleWs(config, 'core_course_get_courses', {});

    const filtered = courses
      .filter((c) => c && c.id && Number(c.id) > 1 && c.visible !== 0 && c.format !== 'site');

    const enrolledMap = intent === 'course_recommendation'
      ? await getEnrolledCourseMap(config, user && user.id)
      : new Map();
    const completionMap = intent === 'course_recommendation'
      ? await getCompletionStatusMap(config, user && user.id, filtered.map((c) => c.id))
      : new Map();
    const department = (intent === 'course_recommendation' && config.recommendByDepartment)
      ? await getUserDepartment(config, user && user.id)
      : '';

    const ranked = filtered
      .map((c) => {
        const summary = stripHtml(c.summary || '');
        const title = stripHtml(c.fullname || c.displayname || c.shortname || 'Course');
        const score = intent === 'course_recommendation'
          ? scoreCourseRecommendation(queryTokens, c, enrolledMap, completionMap, department, broadRecommendationQuery)
          : scoreText(queryTokens, `${title} ${summary}`);
        return {
          score,
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
    const courseIds = await resolveSectionCourseIds({
      config,
      context,
      queryText,
      queryTokens,
      maxCourses: 2,
    });
    for (const courseId of courseIds) {
      const sections = await callMoodleWs(config, 'core_course_get_contents', { courseid: courseId });
      const sectionDocs = (Array.isArray(sections) ? sections : []).flatMap((section) => {
        const sectionNo = Number(section && section.section ? section.section : 0);
        const sectionName = stripHtml(section && section.name ? section.name : `Section ${sectionNo}`);
        const sectionSummary = stripHtml(section && section.summary ? section.summary : '');
        const modules = Array.isArray(section && section.modules) ? section.modules : [];
        const moduleNames = modules
          .map((m) => stripHtml(m && m.name ? m.name : ''))
          .filter(Boolean)
          .slice(0, 8);
        const sectionSnippet = sectionSummary || (moduleNames.length
          ? `Includes: ${moduleNames.join(', ')}`
          : `Section ${sectionNo} content.`);

        const docs = [{
          source_id: `course_${courseId}_section_${sectionNo}`,
          title: sectionName,
          url: `/course/view.php?id=${courseId}&section=${sectionNo}`,
          snippet: sectionSnippet,
        }];

        for (const m of modules) {
          const title = stripHtml(m && m.name ? m.name : sectionName || 'Section content');
          const desc = stripHtml(m && m.description ? m.description : sectionSummary);
          const url = (m && m.url) ? m.url : `/course/view.php?id=${courseId}&section=${sectionNo}`;
          docs.push({
            source_id: `course_${courseId}_section_${sectionNo}_module_${m && m.id ? m.id : 'x'}`,
            title,
            url,
            snippet: desc || `Module: ${title}`,
          });
        }
        return docs;
      })
        .map((doc) => ({ score: scoreText(queryTokens, `${doc.title} ${doc.snippet}`), item: doc }))
        .sort((a, b) => b.score - a.score)
        .slice(0, topK)
        .map((x) => x.item);

      citations.push(...sectionDocs);
    }
  }

  // 3) Progress/completion: return incomplete tracked activities and completion blockers.
  if (intent === 'progress_completion') {
    const lowerQuery = String(queryText || '').toLowerCase();
    const wantsReason = /why|not complete|marked complete|mark complete/.test(lowerQuery);
    const courseIds = await resolveProgressCourseIds({
      config,
      context,
      queryText,
      queryTokens,
      userId: user && user.id,
      maxCourses: 3,
    });

    if (courseIds.length) {
      const allCourses = await callMoodleWs(config, 'core_course_get_courses', {});
      const courseNameById = new Map(
        (Array.isArray(allCourses) ? allCourses : [])
          .map(normalizeCourseFromWs)
          .filter(Boolean)
          .map((c) => [Number(c.id), c.title])
      );

      for (const courseId of courseIds) {
        const sections = await callMoodleWs(config, 'core_course_get_contents', { courseid: courseId });
        const activityCompletionMap = await getActivityCompletionMap(config, user && user.id, courseId);
        const courseTitle = courseNameById.get(Number(courseId)) || `Course ${courseId}`;

        const moduleDocs = (Array.isArray(sections) ? sections : []).flatMap((section) => {
          const sectionNo = Number(section && section.section ? section.section : 0);
          const sectionName = stripHtml(section && section.name ? section.name : `Section ${sectionNo}`);
          const modules = Array.isArray(section && section.modules) ? section.modules : [];

          return modules.map((m) => {
            const moduleId = Number(m && m.id);
            const moduleName = stripHtml(m && m.name ? m.name : 'Activity');
            const completionEnabled = Number(m && m.completion) > 0
              || activityCompletionMap.has(moduleId)
              || Boolean(m && m.completiondata);
            if (!completionEnabled) {
              return null;
            }

            const completed = moduleCompletionState(m, activityCompletionMap);
            const reason = completionReasonFromModule(m);
            if (completed === true) {
              return null;
            }
            const statusText = completed === false ? 'Incomplete' : 'Completion unknown';
            const snippet = `${courseTitle} / ${sectionName}. Status: ${statusText}. ${reason}`.trim();
            return {
              source_id: `progress_course_${courseId}_module_${moduleId || 'x'}`,
              title: `${courseTitle}: ${moduleName}`,
              url: (m && m.url) ? m.url : `/course/view.php?id=${courseId}&section=${sectionNo}`,
              snippet,
              scoreBoost: reason ? 2 : 0,
            };
          }).filter(Boolean);
        });

        const ranked = moduleDocs
          .map((doc) => ({
            score: scoreText(queryTokens, `${doc.title} ${doc.snippet}`) + Number(doc.scoreBoost || 0),
            item: {
              source_id: doc.source_id,
              title: doc.title,
              url: doc.url,
              snippet: doc.snippet,
            },
          }))
          .filter((x) => x.score > 0 || wantsReason)
          .sort((a, b) => b.score - a.score)
          .slice(0, topK)
          .map((x) => x.item);

        citations.push(...ranked);
      }
    }
  }

  // 4) Glossary + policy snippets.
  if (intent === 'glossary_policy') {
    const beforeCount = citations.length;
    const policyTokens = new Set([
      'policy', 'policies', 'rule', 'rules', 'late', 'submission', 'deadline',
      'attendance', 'absence', 'leave', 'conduct', 'security', 'gdpr', 'hr',
    ]);
    const queryTokenSet = new Set(queryTokens);
    const asksNavigation = queryTokenSet.has('navigation') || queryTokenSet.has('navigate');
    const likelyTerm = extractLikelyTerm(queryText);
    const courseIds = await resolvePolicyCourseIds({
      config,
      context,
      queryText,
      queryTokens,
      maxCourses: 3,
    });
    const courseNameById = new Map();
    try {
      const allCourses = await callMoodleWs(config, 'core_course_get_courses', {});
      for (const c of (Array.isArray(allCourses) ? allCourses : [])) {
        const normalized = normalizeCourseFromWs(c);
        if (normalized) {
          courseNameById.set(normalized.id, normalized.title);
        }
      }
    } catch (_err) {
      // Leave fallback course labels.
    }

    const glossaries = await getGlossariesByCourses(config, courseIds);
    const glossaryDocs = [];
    for (const g of glossaries.slice(0, 5)) {
      const entries = await getGlossaryEntries(config, g.id, likelyTerm || queryText);
      for (const e of entries) {
        const concept = stripHtml(e && (e.concept || e.term || 'Glossary term'));
        const definition = stripHtml(e && (e.definition || e.entry || e.description || ''));
        const aliases = stripHtml(e && (e.aliases || e.keyword || ''));
        const termBoost = likelyTerm && concept.toLowerCase().includes(likelyTerm.toLowerCase()) ? 5 : 0;
        const score = scoreText(queryTokens, `${concept} ${definition} ${aliases}`) + termBoost;
        glossaryDocs.push({
          score,
          item: {
            source_id: `glossary_${g.id}_entry_${e && e.id ? e.id : concept.toLowerCase().replace(/\s+/g, '_')}`,
            title: `${g.name}: ${concept}`,
            url: `/mod/glossary/view.php?id=${g.id}`,
            snippet: definition || `Definition for ${concept}.`,
          },
        });
      }
    }
    glossaryDocs
      .filter((d) => d.score > 0 || Boolean(likelyTerm))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .forEach((d) => citations.push(d.item));

    const policyDocs = [];
    for (const courseId of courseIds) {
      const sections = await callMoodleWs(config, 'core_course_get_contents', { courseid: courseId });
      const courseTitle = courseNameById.get(Number(courseId)) || `Course ${courseId}`;
      for (const section of (Array.isArray(sections) ? sections : [])) {
        const sectionNo = Number(section && section.section ? section.section : 0);
        const sectionName = stripHtml(section && section.name ? section.name : `Section ${sectionNo}`);
        for (const m of (Array.isArray(section && section.modules) ? section.modules : [])) {
          const modname = String(m && m.modname ? m.modname : '').toLowerCase();
          if (!['label', 'page', 'book', 'resource', 'url', 'assign', 'forum'].includes(modname)) {
            continue;
          }
          const title = stripHtml(m && m.name ? m.name : 'Course content');
          const desc = stripHtml(m && m.description ? m.description : section && section.summary ? section.summary : '');
          const hay = `${title} ${desc}`.toLowerCase();
          const hayTokenSet = new Set(tokenize(`${title} ${desc}`));
          const isQuickNav = /quick navigation/.test(title.toLowerCase());
          if (isQuickNav && !asksNavigation) {
            continue;
          }

          const policyKeywordMatches = [...queryTokenSet].filter((t) => policyTokens.has(t) && hayTokenSet.has(t)).length;
          const baseScore = scoreText(queryTokens, `${title} ${desc}`);
          const termMatch = likelyTerm ? hay.includes(likelyTerm.toLowerCase()) : false;
          const score = baseScore + (policyKeywordMatches * 2) + (termMatch ? 5 : 0);

          if (likelyTerm && !termMatch && baseScore <= 0) {
            continue;
          }
          if (!likelyTerm && baseScore <= 0 && policyKeywordMatches === 0) {
            continue;
          }
          policyDocs.push({
            score,
            item: {
              source_id: `policy_course_${courseId}_module_${m && m.id ? m.id : 'x'}`,
              title: `${courseTitle}: ${title}`,
              url: (m && m.url) ? m.url : `/course/view.php?id=${courseId}&section=${sectionNo}`,
              snippet: desc || `${title} in ${sectionName}.`,
            },
          });
        }
      }
    }
    policyDocs
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .forEach((d) => citations.push(d.item));

    if (citations.length === beforeCount) {
      const target = likelyTerm || queryText;
      citations.push({
        source_id: 'policy_search_nohit',
        title: 'Moodle Glossary/Policy Search',
        url: context && context.current_url ? context.current_url : '/my/',
        snippet: `No matching glossary entry or policy snippet was found for "${stripHtml(target)}" in accessible Moodle sources.`,
      });
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

async function searchCourses(config, queryText) {
  // Moodle deployments differ on expected parameters for core_course_search_courses.
  const attempts = [
    { criterianame: 'search', criteriavalue: queryText },
    { 'criteria[0][key]': 'search', 'criteria[0][value]': queryText },
  ];

  for (const params of attempts) {
    try {
      const result = await callMoodleWs(config, 'core_course_search_courses', params);
      if (Array.isArray(result && result.courses) && result.courses.length > 0) {
        return result;
      }
      // Some Moodle versions nest results differently; handle that shape too.
      if (Array.isArray(result && result.results) && result.results.length > 0) {
        return { courses: result.results };
      }
    } catch (_err) {
      // Try next search shape.
    }
  }

  return null;
}

async function retrieveContext({ queryText, intentHint, intent, context, user, config, topK = 3 }) {
  if (config.retrievalProvider === 'catalog_api') {
    return retrieveFromCatalogApi({ queryText, intent, topK, config });
  }

  if (config.retrievalProvider === 'moodle_ws') {
    return retrieveFromMoodleWs({ queryText, intent, context, user, topK, config });
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
