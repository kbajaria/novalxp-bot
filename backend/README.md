# Backend Scaffold

Lambda-style `/v1/chat` orchestrator implementation.

## Environment Variables
- `AWS_REGION` (default `eu-west-2`)
- `USE_BEDROCK` (`true` to call Bedrock, default `false`)
- `API_AUTH_ENABLED` (`true` to enforce Bearer token auth, default `false`)
- `API_KEYS` (comma-separated accepted bearer tokens)
- `MODEL_SITE_NAV`
- `MODEL_COURSE_REC`
- `MODEL_SECTION_EXPLAINER`
- `MODEL_PROGRESS_COMPLETION`
- `MODEL_GLOSSARY_POLICY`
- `MODEL_OTHER`
- `MODEL_FALLBACK`
- `MAX_OUTPUT_TOKENS_DEFAULT` (default `600`)
- `RETRIEVAL_MIN_CITATIONS` (default `1`)
- `RETRIEVAL_PROVIDER` (`local`, `catalog_api`, `moodle_ws`, `opensearch`)
- `RETRIEVAL_CORPUS_PATH` (default `/Users/kamilabajaria/Projects/NovaLXP-Bot/backend/data/corpus.json`)
- `RETRIEVAL_FAQ_CORPUS_PATH` (default `/Users/kamilabajaria/Projects/NovaLXP-Bot/backend/data/faq_corpus.json`)
- `RETRIEVAL_CATALOG_API_URL` (used when provider is `catalog_api`)
- `RETRIEVAL_CATALOG_API_TOKEN` (optional bearer token for catalog API)
- `RETRIEVAL_MOODLE_BASE_URL` (used when provider is `moodle_ws`, example `https://learn.novalxp.co.uk`)
- `RETRIEVAL_MOODLE_TOKEN` (Moodle web service token for retrieval functions)
- `RETRIEVAL_MOODLE_FORWARDED_HOST` (optional host header for loopback proxy setups, example `dev.novalxp.co.uk`)
- `RETRIEVAL_MOODLE_TIMEOUT_MS` (default `15000`)
 - `RECOMMEND_BY_DEPARTMENT` (`true`/`false`, default `true`; applies user `department` boost during `course_recommendation`)
  - Recommended Moodle WS functions for ranking: `core_course_get_courses`, `core_course_search_courses`, `core_course_get_contents`, `core_enrol_get_users_courses`, `core_completion_get_course_completion_status`, `core_completion_get_activities_completion_status` (optional but recommended), `mod_glossary_get_glossaries_by_courses` (optional), `mod_glossary_get_entries_by_search` or `mod_glossary_get_entries_by_letter` (optional)
  - When `RETRIEVAL_PROVIDER=moodle_ws`, `RETRIEVAL_CORPUS_PATH` is ignored.

## Local Smoke Test
```bash
node /Users/kamilabajaria/Projects/NovaLXP-Bot/backend/src/smoke-test.js
```

## Bedrock Enablement
1. Install dependencies:
```bash
cd /Users/kamilabajaria/Projects/NovaLXP-Bot/backend
npm install
```
2. Run with Bedrock enabled:
```bash
AWS_REGION=eu-west-2 USE_BEDROCK=true node src/smoke-test.js
```

## Auth Example
```bash
AWS_REGION=eu-west-2 \
API_AUTH_ENABLED=true \
API_KEYS=local-dev-key \
USE_BEDROCK=false \
node src/smoke-test.js
```

## Moodle WS Retrieval Example
```bash
AWS_REGION=eu-west-2 \
RETRIEVAL_PROVIDER=moodle_ws \
RETRIEVAL_MOODLE_BASE_URL=http://127.0.0.1 \
RETRIEVAL_MOODLE_TOKEN=REPLACE_WITH_NEW_TOKEN \
RETRIEVAL_MOODLE_FORWARDED_HOST=dev.novalxp.co.uk \
USE_BEDROCK=false \
node src/smoke-test.js
```

## Corpus Handoff Note
- Current runtime target is `RETRIEVAL_PROVIDER=moodle_ws` for dev/test/prod, so live Moodle data is used for broad course coverage.
- If you switch any environment to `RETRIEVAL_PROVIDER=local`, the file at `backend/data/corpus.json` must include all relevant live courses (not a small subset), or course recommendations may fail with `RETRIEVAL_UNAVAILABLE` for queries outside the seeded items.
- When adding new corpus data in future, treat corpus completeness as a release requirement for any environment using local retrieval.

## FAQ Mining From Real Chat Logs (Anonymized)
1. Export backend logs from the target host:
```bash
ssh dev-moodle-ec2 "sudo journalctl -u novalxp-bot --since '14 days ago' --no-pager" > /tmp/novalxp-bot.log
```
2. Build FAQ corpus from recurring anonymized questions:
```bash
node /Users/kamilabajaria/Projects/NovaLXP-Bot/backend/scripts/build_faq_from_logs.js \
  --input /tmp/novalxp-bot.log \
  --output /Users/kamilabajaria/Projects/NovaLXP-Bot/backend/data/faq_corpus.json \
  --min-count 2
```
3. Keep `RETRIEVAL_FAQ_CORPUS_PATH` pointing at that file so FAQ docs are considered during retrieval.
