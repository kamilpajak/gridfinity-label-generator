# 🚀 GridScribe Deployment Guide

Quick reference guide for deploying GridScribe to VPS using GitHub Container Registry and Docker.

---

## 📋 Prerequisites

- Docker installed locally and on VPS
- GitHub account with Personal Access Token (PAT) with `write:packages` permission
- VPS with Docker installed
- Cloudflare Tunnel configured (pointing to `localhost:8081`)
- A clone of this repository on the VPS at `/opt/gridscribe`, so `scripts/deploy.sh`
  is available there
- `/etc/gridscribe/deploy.env` on the VPS, filled in from
  [`scripts/deploy.env.example`](../../scripts/deploy.env.example)

---

## 🔧 Local Build & Test

### Test application build

```bash
# Build the application
pnpm build

# Test locally on port 80
PORT=80 node build/index.js
```

### Test Docker build

```bash
# Build Docker image
docker build -t gridscribe-test .

# Run locally. Copy .env.example to .env and fill it in first; an env file keeps
# the list of variables in one place instead of a -e list you retype from memory.
#
# Read it with `.`, not with --env-file: the values in .env are quoted, and
# `docker run --env-file` does not strip quotes, so PUBLIC_ALLOWED_ORIGINS would
# arrive with the quote characters inside the value and never match an Origin
# header. A bare `-e NAME` makes docker take the value from this shell instead,
# already unquoted.
set -a
. ./.env
set +a

docker run -p 8081:80 \
  -e ORIGIN=http://localhost:8081 \
  -e PUBLIC_ALLOWED_ORIGINS \
  -e PUBLIC_MATOMO_URL \
  -e PUBLIC_MATOMO_SITE_ID \
  -e PUBLIC_AMAZON_STORE_ID \
  -e PUBLIC_AFFILIATE_PTE560BT \
  -e PUBLIC_AFFILIATE_PTP710BT \
  -e PUBLIC_AFFILIATE_TZE231 \
  -e PUBLIC_AFFILIATE_MAGNETS \
  -e PUBLIC_CONTACT_EMAIL \
  -e PUBLIC_PRIVACY_CONTROLLER \
  -e PUBLIC_ALLOW_E2E_PAGES \
  gridscribe-test

# Test in browser
open http://localhost:8081
```

---

## 📦 GitHub Container Registry (Automated)

### Automated builds via GitHub Actions

Docker images are automatically built and pushed when:

- **Push to `master`** → Builds `latest` and `sha-{short_sha}` tags
- **Pull Request** → Builds `pr-{number}` tag for testing

**Image tags created:**

- `ghcr.io/kamilpajak/gridfinity-label-generator:latest` (only from master)
- `ghcr.io/kamilpajak/gridfinity-label-generator:sha-abc1234` (every commit)
- `ghcr.io/kamilpajak/gridfinity-label-generator:pr-123` (pull requests)

**Verify builds:** Check [Actions tab](../../actions) after pushing to master.

### Make package public

After first build, make the package public:

1. Go to https://github.com/kamilpajak?tab=packages
2. Click on `gridfinity-label-generator` package
3. Package settings → Change visibility → Public

This allows pulling images without authentication on VPS.

---

## 🖥️ VPS Deployment

Deploys run through [`scripts/deploy.sh`](../../scripts/deploy.sh). The script holds the
whole `docker run` invocation, so the list of environment variables lives in version
control instead of in someone's shell history. It refuses to start the container when a
required variable is missing or malformed, and it verifies after start that the QR URL
shortener accepts the site's own origin.

Values come from `/etc/gridscribe/deploy.env` on the VPS. That file is never committed —
the Matomo and affiliate ids belong to the operator. The committed template is
[`scripts/deploy.env.example`](../../scripts/deploy.env.example).

### One-time setup

```bash
ssh user@your-vps.com

# 1. Clone the repository; the deploy script lives in it
sudo git clone https://github.com/kamilpajak/gridfinity-label-generator.git /opt/gridscribe

# 2. Create the env file from the template and fill in the blanks
sudo install -d -m 755 /etc/gridscribe
sudo cp /opt/gridscribe/scripts/deploy.env.example /etc/gridscribe/deploy.env
sudo $EDITOR /etc/gridscribe/deploy.env

# 3. The file holds operator values, so keep it root-owned and not world readable
sudo chown root:root /etc/gridscribe/deploy.env
sudo chmod 600 /etc/gridscribe/deploy.env
```

Every value in the template is empty, including `ORIGIN` and
`PUBLIC_ALLOWED_ORIGINS`, and each one has an example in the comment above it. Fill in
at least those two, with the domain **this** host serves:

- `ORIGIN` — the public URL, e.g. `https://gridfinitylabels.com`
- `PUBLIC_ALLOWED_ORIGINS` — every hostname the site answers on, e.g.
  `https://gridfinitylabels.com,https://www.gridfinitylabels.com`

`deploy.sh` refuses to deploy while either is empty, which is deliberate. Every check it
makes is internal: it compares `ORIGIN` against the allowlist in the same file, and
probes the container with those same values. Nothing in the deploy can tell what domain
the host really serves. A template that shipped `gridfinitylabels.com` pre-filled would
let a fork deploy at its own domain, pass every check, and still answer `403` to its own
front end — the outage this script exists to prevent. The optional values stay empty on
purpose too: an empty value turns that feature off, and a fork must not inherit someone
else's analytics or contact details.

### Deploy

```bash
ssh user@your-vps.com
cd /opt/gridscribe && sudo git pull
sudo ./scripts/deploy.sh
```

Every `deploy.sh` command on this page runs under `sudo`. The script reads
`/etc/gridscribe/deploy.env`, which step 3 above made root-owned and mode `600`, and it
appends to `/var/log/gridscribe-deployments.log`. Without `sudo` it stops at
`error: env file is not readable: /etc/gridscribe/deploy.env` and exits `2`.

The script:

1. Reads `/etc/gridscribe/deploy.env` and checks every required variable. Each entry of
   `PUBLIC_ALLOWED_ORIGINS` must be a bare `scheme://host`, optionally with a
   non-default port, and `ORIGIN` must appear in the list. `https://host:443` is
   refused: a browser leaves the default port out of the `Origin` header, so an
   explicit `:443` never matches.
2. Warns about any name in the file that no code reads — that catches a typo. The file is
   read line by line, not sourced: a line that is not `NAME=value`, and an assignment to
   one of the script's own options (`TAG`, `DRY_RUN`, `CHECK_ONLY`, `DO_PULL`, `ENV_FILE`)
   or fixed settings (`HOST_PORT` and the rest), is refused with exit `2` naming the line.
   One layer of matching quotes is stripped; nothing else in a value is interpreted.
3. Pulls `ghcr.io/kamilpajak/gridfinity-label-generator:latest`.
4. Renames the running container to `gridscribe-previous` and starts the new one, passing
   every variable as an explicit `-e` flag so the full environment is visible in
   `docker inspect`.
5. Waits for `http://localhost:8081/` to answer. No fixed sleep.
6. Smoke-tests `POST /api/shorten` once per entry of `PUBLIC_ALLOWED_ORIGINS`, with an
   empty JSON body. `400` ("URL is required") means the allowlist accepted that origin,
   because the origin check runs before the body is read. `403` on any entry rolls the
   deploy back. Nothing is sent to is.gd or TinyURL.

   Be clear about what this proves on a deploy. The container was just started from the
   same list the check reads, so every entry is accepted by construction: the check shows
   the value reached the app and that the app accepts each entry exactly as written. It
   does **not** check that an entry names a hostname anything serves — an entry like
   `https://not-served-anywhere.invalid` is reported as accepted and the deploy exits `0`.
   It cannot check a hostname that is **missing** from the list either, because a missing
   hostname is not an entry. Under `--check-only` the same walk is worth more: there the
   container was started by an earlier run, so an entry the env file lists and the running
   container does not accept comes back `403`.

7. On success removes `gridscribe-previous`, appends the deployed tag and digest to
   `/var/log/gridscribe-deployments.log`, and prints the digest reference on stdout. A
   log append that fails is a warning, not a failure.

If validation fails nothing is touched and the running container keeps serving. If a
check fails after the container was replaced, the previous container is renamed back and
started again.

If a run is killed between step 4 and step 7 it leaves a `gridscribe-previous` container
behind. What the next run does then depends on whether anything is serving:

- The site answers on `http://localhost:8081/` — the run stops with exit `2` and changes
  nothing. `gridscribe-previous` is older than what is serving, so removing it is your
  call: `docker rm -f gridscribe-previous`.
- Nothing answers — the site is down, so the run says so, removes the container that is
  not answering, keeps `gridscribe-previous` as its own rollback target, and deploys. One
  command restores the site, and the last container known to have served it is still
  there to fall back to.

### Before deploying anything

```bash
sudo ./scripts/deploy.sh --dry-run    # validate and print the exact docker run command
```

`--dry-run` prints the command including its values. Do not paste that output into an
issue or a chat.

### Checking a deployment that is already running

```bash
sudo ./scripts/deploy.sh --check-only
```

This validates the env file and smoke-tests the container that is already running. It
deploys nothing and is safe to run unattended.

This is the check that would have caught the three-month shortener outage, where
`PUBLIC_ALLOWED_ORIGINS` was missing from the running container. Nothing looks wrong
without it: the page renders, the QR code is valid and scans fine — it just carries the
full long URL instead of a short one. A daily cron entry is enough:

A root crontab, not the operator's own: a user crontab cannot read
`/etc/gridscribe/deploy.env` and would mail `env file is not readable` every morning
while the shortener went unchecked. Write `/etc/cron.d/gridscribe-shortener-check`,
owned by root and mode `644`:

```cron
# Check the QR shortener every morning; cron mails the output on failure.
# The user field is what makes this run as root.
MAILTO=you@example.com
17 6 * * * root cd /opt/gridscribe && ./scripts/deploy.sh --check-only
```

Check it once by hand first, with `sudo ./scripts/deploy.sh --check-only`, so a
misconfigured path is found now rather than in six months of silent mail.

### Exit codes

The script and its `--help` use the same set.

| Code | Meaning                                                                                                                                                                                                                                          |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `0`  | Deployed, healthy, and the shortener accepted the site's own origin. Also a passing `--check-only`                                                                                                                                               |
| `2`  | Usage error, the env file is malformed or a required variable is missing, or a stale `gridscribe-previous` container is in the way **while the site is still answering**. Nothing was touched and the running container keeps serving            |
| `7`  | The deploy did not land and the previous version is serving again: the image could not be pulled, a check failed, or the run was interrupted. Safe to retry                                                                                      |
| `8`  | Partial. The container was replaced and the rollback also failed, so the live site needs attention now; or `--check-only` found the shortener rejecting an origin the site serves; or `--check-only` found nothing answering on port 8081 at all |

---

## 🔄 Update Deployment

Merge to `master`, wait for the Docker Build workflow to finish, then on the VPS:

```bash
cd /opt/gridscribe && sudo git pull
sudo ./scripts/deploy.sh
```

`git pull` matters as much as the image does: it is what brings a new variable, or a
changed template, onto the host.

---

## ⏪ Rollback

A failed health check or a failed shortener check rolls back on its own, before the
script exits.

### Roll back on purpose

```bash
# Find a tag in /var/log/gridscribe-deployments.log or in the container registry
sudo ./scripts/deploy.sh --tag sha-abc1234
```

### Find available versions

```bash
# Deployment history
sudo cat /var/log/gridscribe-deployments.log

# Or the container registry
# https://github.com/kamilpajak/gridfinity-label-generator/pkgs/container/gridfinity-label-generator
```

Each successful deploy appends one line naming both the tag and the digest:

```text
deployed ghcr.io/kamilpajak/gridfinity-label-generator:sha-abc1234 (sha256:4112…) at 2026-10-03T14:49:41Z
```

The tag is the part `--tag` takes — `sha-abc1234` above. `--tag` refuses anything with an
`@` or a `:` in it, so the digest is there to identify the exact image, not to be pasted
back.

The history can have gaps. Appending to the log is only a warning: a run without write
access to `/var/log` prints `warning: could not append to
/var/log/gridscribe-deployments.log: …` and still exits `0`, with the deploy done. The
registry is the complete list.

### Break glass

If the script itself is broken, start the container by hand — but from the env file, never
from a retyped `-e` list. Retyping that list from memory is how the shortener broke in the
first place.

Read the file with `.`, the same way `deploy.sh` does, and pass bare `-e NAME` flags so
docker takes each value from the shell. Do **not** use `--env-file` here: it does not
strip quotes, so `ORIGIN` would arrive as `"https://gridfinitylabels.com"` and
adapter-node would refuse to start with `Invalid ORIGIN`, while an unquoted `ORIGIN` next
to a still-quoted `PUBLIC_ALLOWED_ORIGINS` starts fine and answers `403` to every
shortener call — silently, which is the whole failure this page exists to prevent.

Run it as root (`sudo -i`): `/etc/gridscribe/deploy.env` is mode `600` and root-owned.

```bash
docker stop gridscribe && docker rm gridscribe

set -a
. /etc/gridscribe/deploy.env
set +a

docker run -d \
  --name gridscribe \
  -p 8081:80 \
  -e NODE_ENV=production \
  -e PORT=80 \
  -e PUBLIC_ALLOW_E2E_PAGES=false \
  -e PUBLIC_ALLOWED_ORIGINS \
  -e PUBLIC_MATOMO_URL \
  -e PUBLIC_MATOMO_SITE_ID \
  -e PUBLIC_AMAZON_STORE_ID \
  -e PUBLIC_AFFILIATE_PTE560BT \
  -e PUBLIC_AFFILIATE_PTP710BT \
  -e PUBLIC_AFFILIATE_TZE231 \
  -e PUBLIC_AFFILIATE_MAGNETS \
  -e PUBLIC_CONTACT_EMAIL \
  -e PUBLIC_PRIVACY_CONTROLLER \
  -e ORIGIN \
  --restart unless-stopped \
  ghcr.io/kamilpajak/gridfinity-label-generator:latest
```

A break-glass start leaves whatever `docker ps -a` already showed. If that includes
`gridscribe-previous`, remove it (`docker rm -f gridscribe-previous`) once the site is
answering again, or the next `deploy.sh` run stops with exit `2` because a stale copy is
in the way.

If only the deploy logic is broken and validation still works,
`sudo ./scripts/deploy.sh --dry-run` prints the same argv with the values already filled
in, ready to copy. After a break-glass start, check the shortener by hand:

```bash
curl -s -o /dev/null -w '%{http_code}\n' \
  -X POST http://localhost:8081/api/shorten \
  -H 'Content-Type: application/json' \
  -H 'Origin: https://gridfinitylabels.com' \
  -d '{}'
# 400 = the origin allowlist is correct. 403 = it is missing or wrong.
```

---

## 🛠️ Useful Commands

### Check container status

```bash
docker ps
docker ps -a  # including stopped containers
```

### View logs

```bash
docker logs gridscribe
docker logs -f gridscribe  # follow logs
docker logs --tail 100 gridscribe  # last 100 lines
```

### Container info

```bash
docker inspect gridscribe
docker stats gridscribe  # resource usage
```

### Cleanup

```bash
# Remove old images
docker image prune -a

# Remove stopped containers
docker container prune

# Full cleanup
docker system prune -a
```

---

## 🔍 Troubleshooting

### Container won't start

```bash
# Check logs
docker logs gridscribe

# Check if port 8081 is already in use
lsof -i :8081
netstat -tulpn | grep 8081
```

### Application errors

```bash
# Check environment variables
docker inspect gridscribe | grep -A 10 "Env"

# Access container shell
docker exec -it gridscribe sh

# Check inside container
docker exec gridscribe ls -la /app
docker exec gridscribe cat /app/package.json
```

### Image pull issues

```bash
# Re-login
echo $GITHUB_TOKEN | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin

# Verify package visibility (should be public or you must be logged in)
```

### Cloudflare Tunnel not working

```bash
# Verify container is listening on 8081
curl http://localhost:8081

# Check Cloudflare Tunnel status
# (depends on your tunnel setup - cloudflared service)
systemctl status cloudflared
```

---

## 📝 Environment Variables

The authoritative template is
[`scripts/deploy.env.example`](../../scripts/deploy.env.example). The tables below explain
what each variable does; the template is what you copy to
`/etc/gridscribe/deploy.env` and fill in. `scripts/deploy.sh` names every variable it
passes, and `src/lib/config/deploy-script-vars.test.ts` fails CI when the app starts
reading a `PUBLIC_*` variable the script does not know about.

Required environment variables for the container. The two origin values belong to the
operator, not to this repository, and the committed template leaves them empty —
`https://gridfinitylabels.com` below is only what the maintainer's own deployment uses:

| Variable   | Value           | Description                     |
| ---------- | --------------- | ------------------------------- |
| `NODE_ENV` | `production`    | Node environment                |
| `PORT`     | `80`            | Internal container port         |
| `ORIGIN`   | your own domain | Public URL (for CORS/SvelteKit) |

Required for the QR code shortener:

| Variable                 | Value                                   | Description                            |
| ------------------------ | --------------------------------------- | -------------------------------------- |
| `PUBLIC_ALLOWED_ORIGINS` | every hostname your own site answers on | Origins allowed to call `/api/shorten` |

Comma-separated list of origins. `localhost:5173`, `localhost:4173` and
`localhost:3000` are always allowed, so dev works without this variable. Any other
origin — including the real domain, for example `https://gridfinitylabels.com` and
`https://www.gridfinitylabels.com` on the maintainer's deployment — is rejected with
`403 Forbidden` unless listed here.

Leaving this unset does not break the page and does not show an error. QR codes are
still generated, but long URLs are no longer shortened: the full URL goes into the QR
code, which makes it denser and harder to scan on a small label. Set the variable to
the exact origins the site is served from, scheme included, no trailing slash.

Analytics (optional but recommended):

| Variable                | Value                                      | Description          |
| ----------------------- | ------------------------------------------ | -------------------- |
| `PUBLIC_MATOMO_URL`     | `https://statistics.gridfinitylabels.com/` | Matomo analytics URL |
| `PUBLIC_MATOMO_SITE_ID` | `1`                                        | Matomo site ID       |

Affiliate links (optional, leave unset to hide affiliate links):

| Variable                    | Value          | Description                       |
| --------------------------- | -------------- | --------------------------------- |
| `PUBLIC_AMAZON_STORE_ID`    | Associates tag | Amazon Associates store id        |
| `PUBLIC_AFFILIATE_PTE560BT` | Affiliate URL  | Link for the Brother PT-E560BT    |
| `PUBLIC_AFFILIATE_PTP710BT` | Affiliate URL  | Link for the Brother P-touch CUBE |
| `PUBLIC_AFFILIATE_TZE231`   | Affiliate URL  | Link for the Brother TZe-231 tape |
| `PUBLIC_AFFILIATE_MAGNETS`  | Affiliate URL  | Link for the neodymium magnets    |

Privacy policy (optional, operator details shown in the in-app policy):

| Variable                    | Value          | Description                         |
| --------------------------- | -------------- | ----------------------------------- |
| `PUBLIC_CONTACT_EMAIL`      | Operator email | Contact address shown in the policy |
| `PUBLIC_PRIVACY_CONTROLLER` | Operator name  | Named data controller               |

Leave both empty and the policy renders a neutral self-hosted notice instead.

Optional:

| Variable                 | Default   | Description                                |
| ------------------------ | --------- | ------------------------------------------ |
| `HOST`                   | `0.0.0.0` | Bind address (already set in Dockerfile)   |
| `BODY_SIZE_LIMIT`        | -         | Request body size limit                    |
| `PUBLIC_ALLOW_E2E_PAGES` | unset     | `true` exposes the `/e2e` test-only routes |

Keep `PUBLIC_ALLOW_E2E_PAGES` unset in production. It exists for end-to-end test runs
and serves internal comparison pages that are not meant for visitors.

---

## ✅ Deployment Checklist

- [ ] Application builds successfully locally (`pnpm build`)
- [ ] Docker image builds successfully
- [ ] Image pushed to ghcr.io
- [ ] Package visibility set correctly (public/private)
- [ ] `cd /opt/gridscribe && sudo git pull` ran, so the host has the current script and template
- [ ] `sudo ./scripts/deploy.sh --dry-run` passes
- [ ] `sudo ./scripts/deploy.sh` exits 0
- [ ] Container logs show no errors
- [ ] Application accessible via `https://gridfinitylabels.com`
- [ ] A QR code generated on the live site encodes a short URL (is.gd or tinyurl), not the full one
- [ ] All features work as expected

`sudo ./scripts/deploy.sh` already runs the shortener check against the container on the VPS.
The check below goes through Cloudflare to the live site, which the script cannot do, and
it is worth running by hand because a missing `PUBLIC_ALLOWED_ORIGINS` shows no error in
the browser:

```bash
curl -s -o /dev/null -w '%{http_code}\n' \
  -X POST https://gridfinitylabels.com/api/shorten \
  -H 'Content-Type: application/json' \
  -H 'Origin: https://gridfinitylabels.com' \
  -d '{"url":"https://example.com/a-url-longer-than-fifty-characters-for-testing"}'
```

`200` means shortening works. `403` means the origin is not in
`PUBLIC_ALLOWED_ORIGINS` and every QR code is carrying its full long URL.

---

## 🔐 Security Notes

- GitHub Personal Access Token should have minimal permissions (`write:packages` only)
- Store tokens securely (use environment variables, not hardcoded)
- Consider using GitHub Actions for automated deployment
- Keep Docker images updated regularly
- Monitor container logs for security issues
