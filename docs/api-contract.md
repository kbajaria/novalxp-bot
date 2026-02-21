# NovaLXP Bot API Contract (Moodle 5.1)

Last updated: 2026-02-21  
Target AWS region: `eu-west-2`

## Purpose
Define the request/response contract between Moodle (NovaLXP plugin/block) and the AWS chat orchestration API.

## Endpoint
- Method: `POST`
- Path: `/v1/chat`
- Content type: `application/json`
- Auth: `Authorization: Bearer <api_token>` (required when backend auth is enabled)

## Request Schema
```json
{
  "request_id": "uuid-v4",
  "tenant_id": "novalxp",
  "user": {
    "id": "12345",
    "role": "student",
    "locale": "en-GB"
  },
  "context": {
    "course_id": "987",
    "course_name": "Financial Crime Foundations",
    "section_id": "4",
    "section_title": "KYC Red Flags",
    "page_type": "course_section",
    "current_url": "/course/view.php?id=987&section=4"
  },
  "query": {
    "text": "What should I do next after this section?",
    "history": [
      {
        "role": "user",
        "text": "I want to get better at onboarding checks."
      },
      {
        "role": "assistant",
        "text": "I can recommend the next modules."
      }
    ]
  },
  "options": {
    "max_output_tokens": 600,
    "require_citations": true,
    "allow_model_fallback": true
  }
}
```

### Required Fields
- `request_id`
- `tenant_id`
- `user.id`
- `query.text`

### Validation Rules
- `request_id` must be unique per request.
- `query.text` must be non-empty.
- `history` should include at most 20 turns.
- `max_output_tokens` accepted range: `100` to `2000`.

## Response Schema
```json
{
  "request_id": "uuid-v4",
  "intent": "course_recommendation",
  "answer": {
    "text": "Based on your current section, next take the Enhanced Due Diligence module.",
    "confidence": 0.84,
    "citations": [
      {
        "source_id": "course_223_section_1",
        "title": "Enhanced Due Diligence",
        "url": "/course/view.php?id=223",
        "snippet": "This module builds on KYC red-flag detection..."
      }
    ]
  },
  "actions": [
    {
      "type": "open_url",
      "label": "Open module",
      "url": "/course/view.php?id=223"
    }
  ],
  "meta": {
    "region": "eu-west-2",
    "model_id": "amazon.nova-pro-v1:0",
    "fallback_used": false,
    "latency_ms": 780
  }
}
```

## Intents
- `site_navigation`
- `course_recommendation`
- `section_explainer`
- `other`

## Routing Policy (Initial)
- `site_navigation` -> `amazon.nova-lite-v1:0`
- `course_recommendation` -> `amazon.nova-pro-v1:0`
- `section_explainer` -> `amazon.nova-pro-v1:0`
- Fallback on timeout/model error -> `us.anthropic.claude-haiku-4-5-20251001-v1:0` (if available in `eu-west-2` account policy)

Note: if the account requires inference profile IDs, use the corresponding `eu-west-2`-valid profile ID in `model_id`.

## Retrieval and Citation Rules
- All responses must be retrieval-grounded for recommendation/explainer intents.
- If fewer than 2 relevant chunks are retrieved, respond with a clarifying question.
- Recommendation/explainer answers must include at least 1 citation.
- Citations must point to Moodle/catalog content only.
- Retrieval source options currently supported in backend config: `local`, `catalog_api`, `moodle_ws` (`opensearch` placeholder).

## Error Model
### HTTP Status + Error Body
```json
{
  "request_id": "uuid-v4",
  "error": {
    "code": "MODEL_ACCESS_DENIED",
    "message": "Primary model unavailable for this account/region.",
    "retryable": true
  }
}
```

### Error Codes
- `INVALID_REQUEST` (400): malformed payload or missing required fields
- `UNAUTHORIZED` (401): invalid caller identity
- `FORBIDDEN` (403): caller lacks tenant or course access
- `MODEL_ACCESS_DENIED` (503): configured model/profile not invokable
- `RETRIEVAL_UNAVAILABLE` (503): vector service unavailable
- `TIMEOUT` (504): orchestration timed out
- `INTERNAL_ERROR` (500): unhandled backend error

## Observability Fields
Capture these per request in logs/metrics:
- `request_id`
- `user.id`
- `intent`
- `model_id`
- `fallback_used`
- `retrieved_chunk_count`
- `latency_ms`
- `feedback_score` (when submitted later)

## Versioning
- API version in URL: `/v1/chat`
- Backward-compatible additions allowed.
- Breaking schema changes require `/v2`.
