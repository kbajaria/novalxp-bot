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
- `MODEL_OTHER`
- `MODEL_FALLBACK`
- `MAX_OUTPUT_TOKENS_DEFAULT` (default `600`)
- `RETRIEVAL_MIN_CITATIONS` (default `1`)
- `RETRIEVAL_PROVIDER` (`local`, `catalog_api`, `opensearch`)
- `RETRIEVAL_CORPUS_PATH` (default `/Users/kamilabajaria/Projects/NovaLXP-Bot/backend/data/corpus.json`)
- `RETRIEVAL_CATALOG_API_URL` (used when provider is `catalog_api`)
- `RETRIEVAL_CATALOG_API_TOKEN` (optional bearer token for catalog API)
- `RETRIEVAL_MOODLE_BASE_URL` (used when provider is `moodle_ws`, example `https://learn.novalxp.co.uk`)
- `RETRIEVAL_MOODLE_TOKEN` (Moodle web service token for retrieval functions)

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
RETRIEVAL_MOODLE_BASE_URL=https://learn.novalxp.co.uk \
RETRIEVAL_MOODLE_TOKEN=REPLACE_WITH_NEW_TOKEN \
USE_BEDROCK=false \
node src/smoke-test.js
```
