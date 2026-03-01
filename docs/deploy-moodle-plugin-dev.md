# Deploy `local_novalxpbot` to Moodle (Dev/Test/Prod)

This deploys plugin files from:

- `/Users/kamilabajaria/Projects/NovaLXP-Bot/moodle/local_novalxpbot`

to a remote Moodle path:

- `<REMOTE_MOODLE_DIR>/local/novalxpbot`

using SSH + `rsync`.

If web root and Moodle CLI root differ, use both variables:
- `REMOTE_MOODLE_DIR` for plugin sync target
- `REMOTE_MOODLE_CLI_DIR` for `admin/cli/*` commands

## Prerequisites

1. You can SSH to the target EC2 host.
2. `rsync` is installed locally.
3. Remote user has permission to write to Moodle plugin dir.
4. Remote host can run Moodle CLI:
   - `php admin/cli/upgrade.php --non-interactive`
   - `php admin/cli/purge_caches.php`

## One-time variables (example)

```bash
export EC2_HOST="ec2-xx-xx-xx-xx.eu-west-2.compute.amazonaws.com"
export EC2_USER="ec2-user"
export EC2_PORT="22"
export EC2_SSH_KEY="$HOME/.ssh/novalxp-dev.pem"
export REMOTE_MOODLE_DIR="/var/www/moodle"
export REMOTE_MOODLE_CLI_DIR="/var/www/moodle"
```

For current environment layout:
```bash
export REMOTE_MOODLE_DIR="/var/www/moodle/public"
export REMOTE_MOODLE_CLI_DIR="/var/www/moodle"
```

Target by environment:
```bash
# Dev
export EC2_HOST="dev-moodle-ec2"

# Test
export EC2_HOST="test-moodle-ec2"

# Prod
export EC2_HOST="prod-moodle-ec2"
```

## Dry run (no changes)

```bash
DRY_RUN=true /Users/kamilabajaria/Projects/NovaLXP-Bot/scripts/deploy_moodle_plugin_dev.sh
```

## Real deploy

```bash
/Users/kamilabajaria/Projects/NovaLXP-Bot/scripts/deploy_moodle_plugin_dev.sh
```

## Optional controls

- Disable remote sudo (only if remote user already has write permissions):
```bash
USE_SUDO_REMOTE=false /Users/kamilabajaria/Projects/NovaLXP-Bot/scripts/deploy_moodle_plugin_dev.sh
```

- Skip upgrade:
```bash
RUN_UPGRADE=false /Users/kamilabajaria/Projects/NovaLXP-Bot/scripts/deploy_moodle_plugin_dev.sh
```

- Skip cache purge:
```bash
RUN_PURGE=false /Users/kamilabajaria/Projects/NovaLXP-Bot/scripts/deploy_moodle_plugin_dev.sh
```

- Override remote plugin directory:
```bash
REMOTE_PLUGIN_DIR="/var/www/moodle/local/novalxpbot" \
/Users/kamilabajaria/Projects/NovaLXP-Bot/scripts/deploy_moodle_plugin_dev.sh
```

## Recommended workflow

1. Commit plugin changes to Git.
2. Run dry run.
3. Run real deploy.
4. Verify endpoint for target environment:
   - Dev: `https://dev.novalxp.co.uk/local/novalxpbot/chat.php`
   - Test: `https://test.novalxp.co.uk/local/novalxpbot/chat.php`
   - Prod: `https://learn.novalxp.co.uk/local/novalxpbot/chat.php`

## Retrieval Mode (Operational)

Use live Moodle WS retrieval for runtime (no local course corpus dependency for recommendations):

- In `/etc/novalxp-bot.env`:
  - `RETRIEVAL_PROVIDER=moodle_ws`
  - `RETRIEVAL_MOODLE_BASE_URL=http://127.0.0.1`
  - `RETRIEVAL_MOODLE_FORWARDED_HOST=<env host>`
  - `RETRIEVAL_MOODLE_TOKEN=<moodle ws token>`
  - `RETRIEVAL_FAQ_CORPUS_PATH=/opt/novalxp-bot/backend/data/faq_corpus.json`
  - `RECOMMEND_BY_DEPARTMENT=true`
- Keep required WS functions on the bot service:
  - `core_course_get_courses`
  - `core_course_search_courses`
  - `core_course_get_contents`
  - `core_enrol_get_users_courses`
  - `core_completion_get_course_completion_status`
  - `core_completion_get_activities_completion_status` (recommended for detailed completion blockers)
  - `core_user_get_users_by_field` (required for department-aware ranking)
  - `mod_glossary_get_glossaries_by_courses` (optional for glossary definitions)
  - `mod_glossary_get_entries_by_search` or `mod_glossary_get_entries_by_letter` (optional for glossary definitions)

## Refresh Strategy By Environment

- Dev/Test: manual refreshes only.
- Prod: nightly scheduled refresh (outside backup window).
  - Timer: `novalxp-corpus-refresh.timer`
  - Schedule: `OnCalendar=*-*-* 02:30:00 UTC` with `RandomizedDelaySec=10m`
  - Service: `novalxp-corpus-refresh.service`
  - Script: `/opt/novalxp-bot/backend/scripts/nightly_corpus_refresh.sh`
  - Covers:
    - `/opt/novalxp-bot/backend/data/corpus.json` via `refresh_corpus_from_moodle.php`
    - `/opt/novalxp-bot/backend/data/faq_corpus.json` via `build_faq_from_logs.js`

## Manual FAQ Refresh

Use the one-command script from this repo to regenerate FAQ docs from anonymized chat logs:

```bash
/Users/kamilabajaria/Projects/NovaLXP-Bot/scripts/refresh_faq_corpus_remote.sh
```

Target test host later:

```bash
SSH_TARGET=test-moodle-ec2 /Users/kamilabajaria/Projects/NovaLXP-Bot/scripts/refresh_faq_corpus_remote.sh
```

Target prod host:

```bash
SSH_TARGET=prod-moodle-ec2 /Users/kamilabajaria/Projects/NovaLXP-Bot/scripts/refresh_faq_corpus_remote.sh
```
