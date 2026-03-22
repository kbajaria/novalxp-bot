# Engineering Log — NovaLXP-Bot

Chronological record of features shipped, bugs fixed, and investigations completed in this repo. Newest entries first.

Used to generate the weekly engineering report. Each entry should be added at the time the work is done or concluded.

**Entry types:** `Feature` · `Bug` · `Investigation` · `Infra` · `Chore`
**Statuses:** `released` · `resolved` · `no-action` · `wont-fix` · `ongoing`

---

## 2026-03-22 — [Feature] Popular courses injected into course recommendation citations

**Component:** `backend/src/retrieval.js` — `retrieveFromMoodleWs()`
**Status:** released (dev, test, production)

### What shipped
For `course_recommendation` intent, the bot now appends up to 3 popular courses from `context.catalog.popular_courses` (sent by Moodle's `payload_builder.php`) to the citation list, after deduplication. Popular courses that are already cited from keyword retrieval are skipped. The model receives up to 6 total citations (3 keyword-matched + 3 popular) and can reference popularity data ("X completions, Y enrolled") in its recommendations.

**File:** `backend/src/retrieval.js`

---

## 2026-03-22 — [Bug] Bot returning clarification request instead of course recommendations

**Component:** `backend/src/intent.js` — `classifyIntent()`
**Status:** released (dev, test, production)

### Report
Bot responded "Could you please provide more information about your previous courses or areas of interest?" instead of making course recommendations for queries like "what course should I take next?".

### Root cause
The `course_recommendation` intent regex did not cover natural-language phrasings with "take next" (word order mismatch — matched "next course" but not "course … take next"). The query fell through to `other` intent, which has no forced grounding, so the model received "No context retrieved" and asked for clarification.

### Fix
Extended the `course_recommendation` regex in `classifyIntent()` to cover additional phrasings:
- `take next` — "what course should I take next"
- `suggest` — "suggest a course for me"
- `what (course|training|learning).*take` — "what course should I take"
- `what should i (do|take|learn|study)` — "what should I study next"

**File:** `backend/src/intent.js`

---

<!-- Add new entries here, newest first. -->
