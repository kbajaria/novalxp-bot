# Deploy `local_novalxpbot` to Dev Moodle (EC2)

This deploys plugin files from:

- `/Users/kamilabajaria/Projects/NovaLXP-Bot/moodle/local_novalxpbot`

to your remote Moodle path:

- `<REMOTE_MOODLE_DIR>/local/local_novalxpbot`

using SSH + `rsync`.

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
REMOTE_PLUGIN_DIR="/var/www/moodle/local/local_novalxpbot" \
/Users/kamilabajaria/Projects/NovaLXP-Bot/scripts/deploy_moodle_plugin_dev.sh
```

## Recommended workflow

1. Commit plugin changes to Git.
2. Run dry run.
3. Run real deploy.
4. Verify endpoint on dev:
   - `https://dev.novalxp.co.uk/local/local_novalxpbot/chat.php`
