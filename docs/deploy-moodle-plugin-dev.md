# Deploy `local_novalxpbot` to Dev Moodle (EC2)

This deploys plugin files from:

- `/Users/kamilabajaria/Projects/NovaLXP-Bot/moodle/local_novalxpbot`

to your remote Moodle path:

- `<REMOTE_MOODLE_DIR>/local/novalxpbot`

using SSH + `rsync`.

If web root and Moodle CLI root differ, use both variables:
- `REMOTE_MOODLE_DIR` for plugin sync target
- `REMOTE_MOODLE_CLI_DIR` for `admin/cli/*` commands

## Prerequisites

1. You can SSH to your dev EC2 host.
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

For your current dev layout:
```bash
export REMOTE_MOODLE_DIR="/var/www/moodle/public"
export REMOTE_MOODLE_CLI_DIR="/var/www/moodle"
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
4. Verify endpoint on dev:
   - `https://dev.novalxp.co.uk/local/novalxpbot/chat.php`

## Retrieval Mode (Operational)

Use live Moodle WS retrieval for dev/runtime (no local corpus file dependency):

- In `/etc/novalxp-bot.env`:
  - `RETRIEVAL_PROVIDER=moodle_ws`
  - `RETRIEVAL_MOODLE_BASE_URL=http://127.0.0.1`
  - `RETRIEVAL_MOODLE_FORWARDED_HOST=dev.novalxp.co.uk`
  - `RETRIEVAL_MOODLE_TOKEN=<moodle ws token>`
- Keep required WS functions on the bot service:
  - `core_course_get_courses`
  - `core_course_search_courses`
  - `core_course_get_contents`
  - `core_enrol_get_users_courses`
  - `core_completion_get_course_completion_status`
- Ensure any corpus refresh timer is disabled when running `moodle_ws`.
