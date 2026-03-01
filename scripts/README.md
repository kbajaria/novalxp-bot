# Scripts

Use `node /Users/kamilabajaria/Projects/NovaLXP-Bot/backend/src/smoke-test.js` to run a local handler smoke test.

Use `/Users/kamilabajaria/Projects/NovaLXP-Bot/scripts/deploy_moodle_plugin_dev.sh` to deploy the Moodle plugin to a dev EC2 host over SSH + rsync.
## Manual FAQ Corpus Refresh (Remote)

Regenerates FAQ docs from anonymized backend chat logs on a remote host:

```bash
/Users/kamilabajaria/Projects/NovaLXP-Bot/scripts/refresh_faq_corpus_remote.sh
```

Target test instead of dev:

```bash
SSH_TARGET=test-moodle-ec2 /Users/kamilabajaria/Projects/NovaLXP-Bot/scripts/refresh_faq_corpus_remote.sh
```

Tune recency and frequency threshold:

```bash
SINCE="30 days ago" MIN_COUNT=3 /Users/kamilabajaria/Projects/NovaLXP-Bot/scripts/refresh_faq_corpus_remote.sh
```
