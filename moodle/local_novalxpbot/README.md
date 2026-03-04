# local_novalxpbot

Moodle local plugin scaffold that sends chat requests to the NovaLXP backend `/v1/chat` endpoint.

## Included
- `settings.php` for backend endpoint/API key/timeout config
- optional Course Companion template URL setting used for setup wizard links
- `classes/payload_builder.php` to build contract-compliant payloads
- `classes/service.php` to call backend
- `classes/response_formatter.php` to normalize response
- `chat.php` authenticated endpoint for UI integration

## Configure in Moodle
1. Install plugin in `local/novalxpbot`.
2. Visit Site administration -> Plugins -> Local plugins -> NovaLXP bot integration.
3. Set:
   - Backend endpoint (e.g. `https://<your-backend-domain>`)
   - Backend API key (Bearer token expected by backend)
   - Timeout (seconds)

## Endpoint Contract for Frontend
Path: `/local/novalxpbot/chat.php`
Method: `POST`
Required params:
- `sesskey`
- `q` (question text)
Optional params:
- `history` (JSON string array of `{role,text}`)
- `course_id` (optional explicit course context override)
- `course_name` (optional explicit course context override)
- `course_title` (optional explicit course title override)
- `current_url` (optional page URL context)

Response (JSON):
- `ok` boolean
- `text` answer text
- `citations` array
- `actions` array of open_url links
- `meta` model/latency fields

## Dashboard + Course Wiring
The plugin auto-loads `local_novalxpbot/chat_client` on:
- Moodle dashboard pages (`$PAGE->pagelayout === 'mydashboard'`)
- Course view pages (`/course/view.php`)

On first open per course (per browser), the chat auto-runs a
`Course Companion Setup` wizard that covers:
- Step A: create/open Course Notes from template URL (if configured)
- Step B: what to add to NotebookLM
- Step C: three tailored copy-paste starter prompts

If exact course title context is unavailable at runtime, starter prompts fall back
to generic phrasing (`this course`) rather than using unrelated site-level labels.

## Current Product Scope (Important)
- Supported: `course_companion_setup`, course recommendations, and navigation help.
- Not currently supported/reliable: asking the bot to explain specific concepts or
  sections from the current course context.

Add dashboard markup with these data attributes:

```html
<form data-novalxpbot-form>
  <input type="text" data-novalxpbot-question placeholder="Ask Nova..." />
  <input type="hidden" data-novalxpbot-history value="[]" />
  <button type="submit">Send</button>
</form>
<div data-novalxpbot-output></div>
```

Defaults used by the AMD module:
- form: `[data-novalxpbot-form]`
- question input: `[data-novalxpbot-question]`
- history input: `[data-novalxpbot-history]` (JSON string)
- output target: `[data-novalxpbot-output]`

If no matching markup exists, the module auto-injects a default floating
chat widget on the dashboard page.

## JS Example
```js
const params = new URLSearchParams();
params.set('sesskey', M.cfg.sesskey);
params.set('q', userQuestion);
params.set('history', JSON.stringify(history));

const res = await fetch(M.cfg.wwwroot + '/local/novalxpbot/chat.php', {
  method: 'POST',
  headers: {'Content-Type': 'application/x-www-form-urlencoded'},
  body: params.toString()
});

const data = await res.json();
if (!data.ok) {
  console.error(data.error);
} else {
  renderAnswer(data.text, data.citations, data.actions);
}
```
