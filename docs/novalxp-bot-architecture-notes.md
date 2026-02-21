# NovaLXP Bot Architecture Notes (Moodle 5.1)

Last updated: 2026-02-21

## Goal
Replace the current Asyntai integration with a new AWS-based assistant that improves:
- Course recommendations
- Site navigation help
- Section-level explanations

## Confirmed AWS Access (validated by CLI tests)
- Target deployment region: `eu-west-2` (London)
- Auth method: IAM Identity Center (`finova-sso` profile)

### Historical model invocation results
The following were validated earlier in `us-east-1` and should be re-validated in `eu-west-2` before production cutover.
- `amazon.nova-lite-v1:0` (Converse success)
- `amazon.nova-pro-v1:0` (Converse success)
- `amazon.titan-embed-text-v2:0` (Invoke success, embeddings returned)
- `us.anthropic.claude-haiku-4-5-20251001-v1:0` (Converse success via inference profile)

### Important model access nuance
`list-foundation-models` output does not guarantee invoke permission in this account mode. Some Anthropic usage requires inference profile IDs as `--model-id`.

## MVP Architecture
1. Moodle plugin/block sends chat requests with user/course/section context.
2. API Gateway -> Lambda orchestrator.
3. Orchestrator performs intent classification + retrieval + generation.
4. Retrieval corpus in S3 + vector index (OpenSearch Serverless preferred).
5. Embeddings via `amazon.titan-embed-text-v2:0`.
6. Generation via Nova models with Claude fallback.
7. Logs + feedback in CloudWatch and DynamoDB.

## Intent Design
- `site_navigation`
- `course_recommendation`
- `section_explainer`
- `other`

## Initial Model Routing Policy
- `site_navigation` -> `amazon.nova-lite-v1:0` (or `us.amazon.nova-lite-v1:0` if inference profiles are required)
- `course_recommendation` -> `amazon.nova-pro-v1:0` (or `us.amazon.nova-pro-v1:0` if inference profiles are required)
- `section_explainer` -> `amazon.nova-pro-v1:0` (or `us.amazon.nova-pro-v1:0` if inference profiles are required)
- Error/timeout fallback -> `us.anthropic.claude-haiku-4-5-20251001-v1:0` (if profile is available in-region policy)

## Guardrails
- Retrieval-first responses (no free-form answers without context)
- Return citations/snippets for recommendations/explanations
- Ask clarifying question when confidence is low
- Store feedback per answer for tuning

## Next Implementation Steps
1. Define plugin/API request-response contract in code.
2. Build ingestion pipeline for catalog + Moodle navigation map + section content.
3. Add vector retrieval and intent router.
4. Add model fallback and observability.
5. Run a prompt-based quality evaluation set and tune.

## Open Decisions
- Confirm VPC endpoint requirements for Bedrock/OpenSearch/S3 in Finova account.
- Confirm approved AWS services list (OpenSearch Serverless vs alternatives).
- Confirm data handling constraints for learner PII and retention.
- Re-run model and inference profile validation commands in `eu-west-2` and freeze final model IDs for production.
