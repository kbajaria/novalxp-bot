# Runtime Matrix (eu-west-2)

Last updated: 2026-02-21 (validated)

This file freezes runtime-validated model/profile IDs for production in `eu-west-2`.

## Validation Profile
- AWS CLI profile: `finova-sso`
- Target region: `eu-west-2`

## Validation Commands

```bash
aws bedrock list-foundation-models \
  --region eu-west-2 \
  --profile finova-sso \
  --query "modelSummaries[].modelId" \
  --output text \
  --no-cli-pager
```

```bash
aws bedrock list-inference-profiles \
  --region eu-west-2 \
  --profile finova-sso \
  --query "inferenceProfileSummaries[].inferenceProfileId" \
  --output text \
  --no-cli-pager
```

```bash
aws bedrock-runtime converse \
  --region eu-west-2 \
  --profile finova-sso \
  --model-id <MODEL_OR_PROFILE_ID> \
  --messages '[{"role":"user","content":[{"text":"Reply with OK"}]}]' \
  --inference-config '{"maxTokens":16,"temperature":0}' \
  --no-cli-pager
```

```bash
aws bedrock-runtime invoke-model \
  --region eu-west-2 \
  --profile finova-sso \
  --model-id amazon.titan-embed-text-v2:0 \
  --content-type application/json \
  --accept application/json \
  --body '{"inputText":"ping"}' \
  --cli-binary-format raw-in-base64-out \
  /tmp/titan-embed-test.json \
  --no-cli-pager
```

## Production Runtime Matrix
| Capability | Primary ID | Fallback ID | eu-west-2 Invoke Verified | Notes |
|---|---|---|---|---|
| site_navigation | amazon.nova-lite-v1:0 | us.anthropic.claude-haiku-4-5-20251001-v1:0 | TBD | Validate converse call in eu-west-2 |
| course_recommendation | amazon.nova-pro-v1:0 | us.anthropic.claude-haiku-4-5-20251001-v1:0 | Yes | Verified via backend smoke test on 2026-02-21 |
| section_explainer | amazon.nova-pro-v1:0 | us.anthropic.claude-haiku-4-5-20251001-v1:0 | TBD | Validate converse call in eu-west-2 |
| embeddings | amazon.titan-embed-text-v2:0 | N/A | TBD | Verify output shape + dimensions |

## Go-Live Rule
Do not hard-code production model IDs until each row above is marked verified in `eu-west-2`.
