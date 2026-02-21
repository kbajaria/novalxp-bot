# Backend Scaffold

Lambda-style `/v1/chat` orchestrator implementation.

## Environment Variables
- `AWS_REGION` (default `eu-west-2`)
- `USE_BEDROCK` (`true` to call Bedrock, default `false`)
- `MODEL_SITE_NAV`
- `MODEL_COURSE_REC`
- `MODEL_SECTION_EXPLAINER`
- `MODEL_OTHER`
- `MODEL_FALLBACK`
- `MAX_OUTPUT_TOKENS_DEFAULT` (default `600`)
- `RETRIEVAL_MIN_CITATIONS` (default `1`)
- `RETRIEVAL_CORPUS_PATH` (default `/Users/kamilabajaria/Projects/NovaLXP-Bot/backend/data/corpus.json`)

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
