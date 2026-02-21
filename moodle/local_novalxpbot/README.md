# local_novalxpbot

Moodle local plugin scaffold that sends chat requests to the NovaLXP backend `/v1/chat` endpoint.

## Included
- `settings.php` for backend endpoint/API key/timeout config
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

Response (JSON):
- `ok` boolean
- `text` answer text
- `citations` array
- `actions` array of open_url links
- `meta` model/latency fields

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
