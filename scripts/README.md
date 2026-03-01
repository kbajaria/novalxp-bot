# Scripts

Use `node /Users/kamilabajaria/Projects/NovaLXP-Bot/backend/src/smoke-test.js` to run a local handler smoke test.

Use `/Users/kamilabajaria/Projects/NovaLXP-Bot/scripts/deploy_moodle_plugin_dev.sh` to deploy the Moodle plugin to a dev EC2 host over SSH + rsync.

You can target any environment by setting `EC2_HOST` to `dev-moodle-ec2`, `test-moodle-ec2`, or `prod-moodle-ec2`.
## Manual FAQ Corpus Refresh (Remote)

Regenerates FAQ docs from anonymized backend chat logs on a remote host:

```bash
/Users/kamilabajaria/Projects/NovaLXP-Bot/scripts/refresh_faq_corpus_remote.sh
```

Target test instead of dev:

```bash
SSH_TARGET=test-moodle-ec2 /Users/kamilabajaria/Projects/NovaLXP-Bot/scripts/refresh_faq_corpus_remote.sh
```

Target prod:

```bash
SSH_TARGET=prod-moodle-ec2 /Users/kamilabajaria/Projects/NovaLXP-Bot/scripts/refresh_faq_corpus_remote.sh
```

Tune recency and frequency threshold:

```bash
SINCE="30 days ago" MIN_COUNT=3 /Users/kamilabajaria/Projects/NovaLXP-Bot/scripts/refresh_faq_corpus_remote.sh
```

## Production Nightly Refresh

Production uses a systemd timer to refresh course + FAQ corpus nightly outside backup windows:

- Timer: `novalxp-corpus-refresh.timer`
- Service: `novalxp-corpus-refresh.service`
- Script: `/opt/novalxp-bot/backend/scripts/nightly_corpus_refresh.sh`
- Schedule: `02:30 UTC` daily with up to `10m` randomized delay

Useful commands on prod:

```bash
ssh prod-moodle-ec2 "systemctl list-timers --all --no-pager | grep novalxp-corpus-refresh"
ssh prod-moodle-ec2 "sudo systemctl status novalxp-corpus-refresh.timer --no-pager -l"
ssh prod-moodle-ec2 "sudo systemctl start novalxp-corpus-refresh.service"
ssh prod-moodle-ec2 "sudo journalctl -u novalxp-corpus-refresh.service -n 100 --no-pager"
```
