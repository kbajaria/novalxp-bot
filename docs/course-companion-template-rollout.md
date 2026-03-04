# Course Companion Template Rollout

Use this runbook to apply the Course Companion notes template URL in Moodle
for `local_novalxpbot` and purge caches.

## Template URL to use

Use the Google Docs force-copy URL so each learner creates their own copy:

`https://docs.google.com/document/d/1gE9FWtZ3toP1b0arSRXhYNRjp7QKkS5HoU5KuyG7h-8/copy`

## One-command apply

### Dev

```bash
TEMPLATE_URL="https://docs.google.com/document/d/1gE9FWtZ3toP1b0arSRXhYNRjp7QKkS5HoU5KuyG7h-8/copy" \
SSH_TARGET=dev-moodle-ec2 \
/Users/kamilabajaria/Projects/NovaLXP-Bot/scripts/set_course_companion_template.sh
```

### Test

```bash
TEMPLATE_URL="https://docs.google.com/document/d/1gE9FWtZ3toP1b0arSRXhYNRjp7QKkS5HoU5KuyG7h-8/copy" \
SSH_TARGET=test-moodle-ec2 \
/Users/kamilabajaria/Projects/NovaLXP-Bot/scripts/set_course_companion_template.sh
```

### Prod

```bash
TEMPLATE_URL="https://docs.google.com/document/d/1gE9FWtZ3toP1b0arSRXhYNRjp7QKkS5HoU5KuyG7h-8/copy" \
SSH_TARGET=prod-moodle-ec2 \
/Users/kamilabajaria/Projects/NovaLXP-Bot/scripts/set_course_companion_template.sh
```

## What the script does

1. Sets Moodle config:
   - component: `local_novalxpbot`
   - name: `coursecompaniontemplateurl`
2. Runs `admin/cli/purge_caches.php`
3. Reads back and prints the configured value

## Dry run

```bash
TEMPLATE_URL="https://docs.google.com/document/d/1gE9FWtZ3toP1b0arSRXhYNRjp7QKkS5HoU5KuyG7h-8/copy" \
DRY_RUN=true \
/Users/kamilabajaria/Projects/NovaLXP-Bot/scripts/set_course_companion_template.sh
```
