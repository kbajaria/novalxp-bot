'use strict';

function boolFromEnv(name, defaultValue) {
  const value = process.env[name];
  if (value === undefined) {
    return defaultValue;
  }
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

const config = {
  region: process.env.AWS_REGION || 'eu-west-2',
  modelByIntent: {
    site_navigation: process.env.MODEL_SITE_NAV || 'amazon.nova-lite-v1:0',
    course_recommendation: process.env.MODEL_COURSE_REC || 'amazon.nova-pro-v1:0',
    section_explainer: process.env.MODEL_SECTION_EXPLAINER || 'amazon.nova-pro-v1:0',
    other: process.env.MODEL_OTHER || 'amazon.nova-lite-v1:0',
  },
  fallbackModelId: process.env.MODEL_FALLBACK || 'us.anthropic.claude-haiku-4-5-20251001-v1:0',
  maxTokensDefault: Number(process.env.MAX_OUTPUT_TOKENS_DEFAULT || 600),
  useBedrock: boolFromEnv('USE_BEDROCK', false),
  apiAuthEnabled: boolFromEnv('API_AUTH_ENABLED', false),
  apiKeys: (process.env.API_KEYS || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean),
  retrievalMinCitations: Number(process.env.RETRIEVAL_MIN_CITATIONS || 1),
  retrievalProvider: process.env.RETRIEVAL_PROVIDER || 'local',
  retrievalCorpusPath: process.env.RETRIEVAL_CORPUS_PATH || '/Users/kamilabajaria/Projects/NovaLXP-Bot/backend/data/corpus.json',
  retrievalCatalogApiUrl: process.env.RETRIEVAL_CATALOG_API_URL || '',
  retrievalCatalogApiToken: process.env.RETRIEVAL_CATALOG_API_TOKEN || '',
  retrievalMoodleBaseUrl: process.env.RETRIEVAL_MOODLE_BASE_URL || '',
  retrievalMoodleToken: process.env.RETRIEVAL_MOODLE_TOKEN || '',
  retrievalMoodleForwardedHost: process.env.RETRIEVAL_MOODLE_FORWARDED_HOST || process.env.RETRIEVAL_MOODLE_HOST_HEADER || '',
  retrievalMoodleTimeoutMs: Number(process.env.RETRIEVAL_MOODLE_TIMEOUT_MS || 15000),
};

module.exports = {
  config,
};
