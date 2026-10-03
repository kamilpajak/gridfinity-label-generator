#!/usr/bin/env bash
#
# GridScribe VPS deploy.
#
# Replaces the running container with an image from ghcr.io and passes the full
# environment the app needs. Every variable the app reads is named in one of the
# three lists below, so a deploy cannot silently drop one the way
# PUBLIC_ALLOWED_ORIGINS was dropped in July 2026: the QR URL shortener answered 403
# to the site's own origin for three months, every QR code carried the full long URL,
# and nothing failed loudly.
#
# Values come from an env file on this host, never from the repository, because the
# Matomo and affiliate ids belong to the operator. Start from
# scripts/deploy.env.example.
#
# The env file is READ line by line, not sourced - see load_env_file. It still holds
# operator values, so keep it root-owned and not group/world readable:
#   sudo chown root:root /etc/gridscribe/deploy.env
#   sudo chmod 600 /etc/gridscribe/deploy.env
# The reading strips one layer of matching quotes, which is what `docker run --env-file`
# does not do: PUBLIC_ALLOWED_ORIGINS="https://example.com" passed that way reaches the
# app with the quote characters inside the value and never matches a browser's Origin
# header - the exact class of silent failure this script exists to prevent.
#
# There is deliberately no --format=json renderer. The repository's CLI conventions
# ask for one, and for an agent-driven tool that would be right, but this script is
# run by one maintainer in one SSH session; a second output path would be untested
# code on the money path. The omission is a decision, not an oversight.
#
# Run --help for usage, options and exit codes.

set -euo pipefail

readonly IMAGE_REPO="ghcr.io/kamilpajak/gridfinity-label-generator"
readonly CONTAINER_NAME="gridscribe"
readonly PREVIOUS_CONTAINER_NAME="gridscribe-previous"
readonly HOST_PORT="8081"
readonly CONTAINER_PORT="80"
readonly DEFAULT_ENV_FILE="/etc/gridscribe/deploy.env"
# A fixed path, not ${HOME}: the env file is root-only, so the script runs under sudo and
# ${HOME} resolved to /root while the deployment guide told the operator to read
# ~/gridscribe-deployments.log in their own home.
readonly DEPLOY_LOG="/var/log/gridscribe-deployments.log"
readonly HEALTH_TIMEOUT_SECONDS=60
readonly HEALTH_POLL_SECONDS=2
# Bound on a single health request. Larger than the poll interval, because a cold
# adapter-node server-side render can take longer than two seconds and a poll that
# timed out early would make a slow but healthy container look dead. Much smaller than
# the whole budget, because nothing else can happen while a poll is in flight - see
# wait_until_healthy.
readonly HEALTH_REQUEST_TIMEOUT_SECONDS=10
readonly SMOKE_TEST_TIMEOUT_SECONDS=15
readonly LOG_TAIL_LINES=50

# Exit codes. Kept small and documented in --help and in
# docs/guides/deployment.md; the two must agree.
readonly EXIT_USAGE=2
readonly EXIT_NOT_DEPLOYED=7
readonly EXIT_PARTIAL=8

# Variables the deploy must provide. A missing or malformed one aborts before any
# container is touched.
#   ORIGIN                 - SvelteKit adapter-node resolves request URLs with it.
#   PUBLIC_ALLOWED_ORIGINS - origins allowed to POST /api/shorten. Compared against
#                            the browser's Origin header verbatim in
#                            src/lib/utils/api-security.ts.
readonly REQUIRED_VARS=(
	ORIGIN
	PUBLIC_ALLOWED_ORIGINS
)

# Variables the app reads but can run without: an empty value disables the feature.
# Listed so every run reports which features are off, and so the drift test in
# src/lib/config/deploy-script-vars.test.ts can account for them.
readonly OPTIONAL_VARS=(
	PUBLIC_MATOMO_URL
	PUBLIC_MATOMO_SITE_ID
	PUBLIC_AMAZON_STORE_ID
	PUBLIC_AFFILIATE_PTE560BT
	PUBLIC_AFFILIATE_PTP710BT
	PUBLIC_AFFILIATE_TZE231
	PUBLIC_AFFILIATE_MAGNETS
	PUBLIC_CONTACT_EMAIL
	PUBLIC_PRIVACY_CONTROLLER
)

# Variables that must never be enabled in a production deploy.
# PUBLIC_ALLOW_E2E_PAGES=true exposes the internal /e2e render-comparison routes on
# the public site. It is both refused in the env file and pinned to false in the
# container, so the intent is visible in `docker inspect`.
readonly REFUSED_VARS=(
	PUBLIC_ALLOW_E2E_PAGES
)

readonly E2E_PAGES_VAR="PUBLIC_ALLOW_E2E_PAGES"

# One line of the env file: an optional `export `, a shell identifier, `=`, and the rest.
# The rest is handed to parse_env_value rather than matched here, because a value may
# contain anything at all once it is quoted.
readonly ENV_ASSIGNMENT_PATTERN='^[[:space:]]*(export[[:space:]]+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$'

# Repeated verbatim by the ORIGIN check and by the allowlist check, so the two cannot
# drift into describing different rules.
readonly BARE_ORIGIN_HINT="  Expected scheme://host with no trailing slash and no path, and without the
  scheme's default port - a browser leaves :443 off https and :80 off http, so an
  explicit one never matches. For example https://gridfinitylabels.com"

# This script's own settings, as opposed to the app's environment. They come from the
# command line and must not come from the env file, so load_env_file refuses a file that
# assigns one of them by name. The fixed settings above need no list: they are readonly,
# and load_env_file asks the shell which names are readonly rather than keeping a second
# copy of that list here to drift.
readonly SCRIPT_SETTING_VARS=(
	TAG
	ENV_FILE
	DRY_RUN
	CHECK_ONLY
	DO_PULL
	PREVIOUS_SAVED
	NEW_CONTAINER_OWNS_NAME
)

TAG="latest"
ENV_FILE="${GRIDSCRIBE_ENV_FILE:-$DEFAULT_ENV_FILE}"
DRY_RUN=0
CHECK_ONLY=0
DO_PULL=1
PREVIOUS_SAVED=0
# 1 once this run has taken ownership of $CONTAINER_NAME, which happens the moment
# `docker run` is invoked. Until then the name still belongs to whatever was serving
# the site, and a rollback must not delete it.
NEW_CONTAINER_OWNS_NAME=0
RUN_ARGS=()
ORIGIN_ENTRIES=()

usage() {
	cat <<'EOF'
USAGE
  deploy.sh [options]

OPTIONS
  --env-file <path>  Env file to read values from (default: /etc/gridscribe/deploy.env,
                     or $GRIDSCRIBE_ENV_FILE)
  --tag <tag>        Image tag to deploy (default: latest). Use sha-<short> to roll back.
  --dry-run          Validate and print the docker run command. Changes nothing.
                     WARNING: the printed command contains the values from the env
                     file. Do not paste that output into an issue or a chat.
  --check-only       Validate the env file and smoke-test the RUNNING container.
                     Deploys nothing. Safe to run unattended from cron.
  --no-pull          Do not pull; use the image already on this host.
  -h, --help         Show this help.

OUTPUT
  Progress, warnings and errors go to stderr. On success stdout holds the deployed
  image digest and nothing else.

EXIT CODES
  0  deployed, healthy, and the shortener accepted the site's own origin
     (or --check-only passed)
  2  usage error, a required variable is missing or malformed, or an earlier deploy
     left a container behind and has to be sorted out first. Nothing was touched and
     the running container keeps serving
  7  the deploy did not land and the previous version is serving again: the image
     could not be pulled, the new container failed a check, or the run was
     interrupted. Safe to retry once the cause is fixed
  8  partial. Either the container was replaced and the rollback also failed, so the
     live site needs attention now, or --check-only found the running deployment
     failing the origin check, so the site is up but the shortener is broken

EXAMPLES
  Run under sudo: the env file is root-owned and mode 600, and the deployment log is
  under /var/log.
  sudo ./scripts/deploy.sh
  sudo ./scripts/deploy.sh --dry-run
  sudo ./scripts/deploy.sh --tag sha-abc1234
  sudo ./scripts/deploy.sh --check-only
  sudo ./scripts/deploy.sh --env-file /etc/gridscribe/staging.env
EOF
}

info() { printf '%s\n' "$*" >&2; }
warn() { printf 'warning: %s\n' "$*" >&2; }

die() {
	local code="$1"
	shift
	printf 'error: %s\n' "$*" >&2
	exit "$code"
}

trim() {
	local s="$1"
	s="${s#"${s%%[![:space:]]*}"}"
	s="${s%"${s##*[![:space:]]}"}"
	printf '%s' "$s"
}

lower() { printf '%s' "$1" | tr '[:upper:]' '[:lower:]'; }

# Spelled out rather than `date -Is`, which is a GNU extension: on a BSD date it
# fails and the log line would silently carry an empty timestamp.
timestamp() { date -u '+%Y-%m-%dT%H:%M:%SZ'; }

# Warns instead of failing. $DEPLOY_LOG is under /var/log, so a run without the rights
# to write there would otherwise abort through `set -e` after a deploy that had already
# passed every check, and report a failure that did not happen.
append_deploy_log() {
	# The redirection is inside a subshell so that its own failure message is captured
	# too: a redirection error is printed by the shell, not by the command, and would
	# escape a plain `2>/dev/null` on the printf.
	(printf '%s\n' "$1" >>"$DEPLOY_LOG") 2>/dev/null ||
		warn "could not append to $DEPLOY_LOG: $1"
}

parse_args() {
	while [ $# -gt 0 ]; do
		case "$1" in
		--env-file)
			[ $# -ge 2 ] || die "$EXIT_USAGE" "--env-file needs a path"
			ENV_FILE="$2"
			shift 2
			;;
		--tag)
			[ $# -ge 2 ] || die "$EXIT_USAGE" "--tag needs a value"
			TAG="$2"
			shift 2
			;;
		--dry-run)
			DRY_RUN=1
			shift
			;;
		--check-only)
			CHECK_ONLY=1
			shift
			;;
		--no-pull)
			DO_PULL=0
			shift
			;;
		-h | --help)
			usage
			exit 0
			;;
		*)
			usage >&2
			die "$EXIT_USAGE" "unknown option: $1"
			;;
		esac
	done

	# Safe to check here, before the env file is read, because load_env_file refuses an
	# env file that assigns TAG at all - so this is the only source of the value.
	case "$TAG" in
	'' | *[!A-Za-z0-9._-]*)
		die "$EXIT_USAGE" "refusing an image tag with unexpected characters: '$TAG'"
		;;
	esac
}

var_is_known() {
	local needle="$1" name
	for name in "${REQUIRED_VARS[@]}" "${OPTIONAL_VARS[@]}" "${REFUSED_VARS[@]}"; do
		if [ "$name" = "$needle" ]; then
			return 0
		fi
	done
	return 1
}

var_is_script_setting() {
	local needle="$1" name
	for name in "${SCRIPT_SETTING_VARS[@]}"; do
		if [ "$name" = "$needle" ]; then
			return 0
		fi
	done
	return 1
}

# Is $1 one of the script's own fixed settings - the readonly constants at the top?
# Asked of the shell instead of kept as a second list beside SCRIPT_SETTING_VARS, so
# adding a constant up there cannot leave this check behind. `declare -p` prints
# `declare -r NAME=...` for a readonly scalar and `declare -ar NAME=...` for a readonly
# array, so only the flag letters are examined.
var_is_fixed_setting() {
	local declaration flags
	declaration="$(declare -p "$1" 2>/dev/null)" || return 1
	flags="${declaration#declare -}"
	flags="${flags%% *}"
	case "$flags" in
	*r*) return 0 ;;
	esac
	return 1
}

# Strips one layer of matching quotes from the right-hand side of an assignment, plus a
# trailing comment outside the quotes, and leaves the result in $ENV_VALUE. Returns 1
# when what follows the value is neither blank nor a comment, so the caller can refuse
# the line instead of guessing what the operator meant. A global rather than a return
# value because a command substitution runs in a subshell, where `die` would exit only
# the subshell.
ENV_VALUE=""
parse_env_value() {
	local raw quoted rest
	raw="$(trim "$1")"
	case "$raw" in
	'"'*)
		quoted="${raw#\"}"
		case "$quoted" in *'"'*) ;; *) return 1 ;; esac
		ENV_VALUE="${quoted%%\"*}"
		rest="${quoted#*\"}"
		;;
	"'"*)
		quoted="${raw#\'}"
		case "$quoted" in *"'"*) ;; *) return 1 ;; esac
		ENV_VALUE="${quoted%%\'*}"
		rest="${quoted#*\'}"
		;;
	*)
		ENV_VALUE="${raw%%[[:space:]]*}"
		rest="${raw#"$ENV_VALUE"}"
		;;
	esac
	case "$(trim "$rest")" in
	'' | '#'*) return 0 ;;
	esac
	return 1
}

# Reads $ENV_FILE one line at a time. It is deliberately NOT sourced.
#
# Sourcing was shorter and wrong three ways over. It ran every line as shell, so a stray
# line in a root-owned config file executed as root under sudo - verified: a file with
# `id -un > /tmp/x` appended ran the command on a plain --dry-run. It let the file assign
# this script's own options, where TAG="sha-deadbee" overruled --tag and skipped the
# character check in parse_args and DRY_RUN=1 turned every deploy into a no-op that
# still exited 0. And it let the file touch the fixed constants, where HOST_PORT=9999
# ended the run with a raw `HOST_PORT: readonly variable` from bash and exit status 1 -
# a code neither --help nor the deployment guide documents.
#
# Accepted on a line: a comment, a blank line, or NAME=value with an optional leading
# `export ` and at most one layer of matching quotes. The quotes are what the template's
# own quoting is for; nothing else is interpreted, so a $, a backtick or a semicolon in a
# value reaches the container verbatim. A value spanning lines and shell expansion are
# deliberately unsupported: the file is a list of values, not a program.
load_env_file() {
	[ -f "$ENV_FILE" ] || die "$EXIT_USAGE" "env file not found: $ENV_FILE
  Create it from scripts/deploy.env.example:
    sudo install -d -m 755 /etc/gridscribe
    sudo cp scripts/deploy.env.example $ENV_FILE
    sudo \$EDITOR $ENV_FILE"
	[ -r "$ENV_FILE" ] || die "$EXIT_USAGE" "env file is not readable: $ENV_FILE"

	local line number=0 name
	local clobbered=() fixed=()

	# `|| [ -n "$line" ]` so a final line without a newline is still read.
	while IFS= read -r line || [ -n "$line" ]; do
		number=$((number + 1))
		# A file edited on Windows would otherwise put a carriage return at the end of
		# every value, where it survives into the container and never matches anything.
		line="${line%$'\r'}"

		case "$(trim "$line")" in
		'' | '#'*) continue ;;
		esac

		if [[ ! $line =~ $ENV_ASSIGNMENT_PATTERN ]]; then
			die "$EXIT_USAGE" "$ENV_FILE line $number is not an assignment: $line
  The file is read line by line, not run as a shell script. Every line is a comment, a
  blank line, or NAME=value. A value with spaces in it needs quotes, for example
  PUBLIC_PRIVACY_CONTROLLER=\"Jane Doe\".
  Nothing was touched and the running container keeps serving."
		fi
		name="${BASH_REMATCH[2]}"

		if ! parse_env_value "${BASH_REMATCH[3]}"; then
			die "$EXIT_USAGE" "$ENV_FILE line $number: cannot read the value of $name: $line
  Expected NAME=value, NAME=\"value\" or NAME='value', optionally followed by a comment.
  An unterminated quote, or anything else after the closing quote, is refused rather
  than guessed at.
  Nothing was touched and the running container keeps serving."
		fi

		# Collected rather than reported one at a time, so one run names every line the
		# operator has to change.
		if var_is_script_setting "$name"; then
			clobbered+=("$name")
			continue
		fi
		if var_is_fixed_setting "$name"; then
			fixed+=("$name")
			continue
		fi

		# A typo'd variable name is the one mistake no other check here can see: the app
		# would read an unset variable and silently turn the feature off.
		if ! var_is_known "$name"; then
			warn "$ENV_FILE line $number sets $name, which no code in src/ reads. A typo? It is not passed to the container."
			continue
		fi

		# -g because this runs inside a function and the value has to outlive it. The
		# name has already been matched against $ENV_ASSIGNMENT_PATTERN, so it is a
		# plain shell identifier.
		declare -g "$name=$ENV_VALUE"
	done <"$ENV_FILE"

	if [ ${#clobbered[@]} -gt 0 ]; then
		die "$EXIT_USAGE" "$ENV_FILE assigns deploy.sh's own setting(s): ${clobbered[*]}
  Those are this script's options, not the app's environment, and they are only ever
  taken from the command line. Nothing was touched and the running container keeps
  serving.
  Remove the line(s) and pass the option instead, for example --tag sha-abc1234.
  The env file is for the app's environment only; see scripts/deploy.env.example."
	fi

	if [ ${#fixed[@]} -gt 0 ]; then
		die "$EXIT_USAGE" "$ENV_FILE assigns deploy.sh's fixed setting(s): ${fixed[*]}
  Those are constants in the script - the image repository, the container names, the
  published port, the deployment log path and the timeouts. They are not configurable
  from the env file; edit scripts/deploy.sh if one of them has to change. Nothing was
  touched and the running container keeps serving."
	fi
}

# scheme://host[:port], no trailing slash, no path, and never the scheme's own default
# port. A browser's Origin header has exactly this shape and api-security.ts compares
# the strings after lowercasing only, so a trailing slash, a path, or an explicit :443
# silently never matches: new URL('https://host:443').origin is 'https://host', and
# that is what the browser sends. Verified against the production image - an allowlist
# of https://host:443 answers 400 to Origin: https://host:443 and 403 to the browser's
# https://host.
is_bare_origin() {
	local candidate="$1"
	printf '%s' "$candidate" | grep -qE '^https?://[A-Za-z0-9._-]+(:[0-9]{1,5})?$' || return 1
	case "$candidate" in
	https://*:443 | http://*:80) return 1 ;;
	esac
	return 0
}

# Reads a comma-separated origin list into the global ORIGIN_ENTRIES array. An array
# read rather than unquoted word splitting, because unquoted expansion also globs and
# would mangle an entry containing * or ?.
split_origin_list() {
	local raw="$1" entry
	ORIGIN_ENTRIES=()
	local parts=()
	IFS=',' read -r -a parts <<<"$raw"
	for entry in "${parts[@]+"${parts[@]}"}"; do
		ORIGIN_ENTRIES+=("$(trim "$entry")")
	done
}

validate_origin_list() {
	local entry
	split_origin_list "$1"
	for entry in "${ORIGIN_ENTRIES[@]+"${ORIGIN_ENTRIES[@]}"}"; do
		if [ -z "$entry" ]; then
			die "$EXIT_USAGE" "PUBLIC_ALLOWED_ORIGINS has an empty entry: a double comma or a trailing comma"
		fi
		if ! is_bare_origin "$entry"; then
			die "$EXIT_USAGE" "PUBLIC_ALLOWED_ORIGINS entry is not a bare origin: '$entry'
$BARE_ORIGIN_HINT"
		fi
	done
}

origin_in_list() {
	local needle entry
	needle="$(lower "$1")"
	split_origin_list "$2"
	for entry in "${ORIGIN_ENTRIES[@]+"${ORIGIN_ENTRIES[@]}"}"; do
		if [ "$(lower "$entry")" = "$needle" ]; then
			return 0
		fi
	done
	return 1
}

validate_env() {
	local name value
	local missing=()

	for name in "${REQUIRED_VARS[@]}"; do
		value="$(trim "${!name-}")"
		if [ -z "$value" ]; then
			missing+=("$name")
		fi
	done

	# Report every missing variable at once, not just the first one.
	if [ ${#missing[@]} -gt 0 ]; then
		die "$EXIT_USAGE" "required variable(s) missing or empty in $ENV_FILE: ${missing[*]}
  Nothing was deployed. The running container is untouched.
  See scripts/deploy.env.example for what each one means."
	fi

	for name in "${REFUSED_VARS[@]}"; do
		value="$(lower "$(trim "${!name-}")")"
		if [ "$value" = "true" ]; then
			die "$EXIT_USAGE" "$name is 'true' in $ENV_FILE. That exposes the internal /e2e routes on the public site. Remove it before deploying."
		fi
	done

	if ! is_bare_origin "$(trim "$ORIGIN")"; then
		die "$EXIT_USAGE" "ORIGIN is not a bare origin: '$ORIGIN'
$BARE_ORIGIN_HINT"
	fi

	validate_origin_list "$PUBLIC_ALLOWED_ORIGINS"

	# The invariant the July 2026 outage broke. The site is served at ORIGIN, so the
	# browser sends exactly that Origin header to /api/shorten. If it is not in the
	# allowlist the shortener 403s its own front end and every QR code carries the
	# full long URL.
	if ! origin_in_list "$(trim "$ORIGIN")" "$PUBLIC_ALLOWED_ORIGINS"; then
		die "$EXIT_USAGE" "ORIGIN ($ORIGIN) is not listed in PUBLIC_ALLOWED_ORIGINS ($PUBLIC_ALLOWED_ORIGINS).
  The site's own QR shortener would answer 403 and every QR code would carry the
  full long URL. Add $ORIGIN to PUBLIC_ALLOWED_ORIGINS in $ENV_FILE."
	fi

	for name in "${OPTIONAL_VARS[@]}"; do
		if [ -z "$(trim "${!name-}")" ]; then
			info "  $name is empty - that feature stays off"
		fi
	done

	info "env file validated: $ENV_FILE"
}

# Builds the docker run argv as a global array. One explicit -e per variable, so the
# whole environment is visible in `docker inspect` and in --dry-run output.
build_run_args() {
	local image_ref="$1" name value

	RUN_ARGS=(
		docker run -d
		--name "$CONTAINER_NAME"
		-p "${HOST_PORT}:${CONTAINER_PORT}"
		--restart unless-stopped
		# Also set in the Dockerfile; repeated so the intent is visible here and in
		# `docker inspect`.
		-e "NODE_ENV=production"
		-e "PORT=${CONTAINER_PORT}"
		# Pinned off rather than merely absent, so someone debugging unexpected /e2e
		# routes can see the decision in `docker inspect`.
		-e "${E2E_PAGES_VAR}=false"
	)

	for name in "${REQUIRED_VARS[@]}"; do
		value="$(trim "${!name}")"
		RUN_ARGS+=(-e "${name}=${value}")
	done

	for name in "${OPTIONAL_VARS[@]}"; do
		value="$(trim "${!name-}")"
		if [ -n "$value" ]; then
			RUN_ARGS+=(-e "${name}=${value}")
		fi
	done

	RUN_ARGS+=("$image_ref")
}

# Polls until the port answers, or until $HEALTH_TIMEOUT_SECONDS of wall clock have
# passed.
#
# Each poll is bounded. Without --max-time a container that completes the TCP handshake
# and then never sends a byte - an app that binds the port before it can serve, or one
# wedged in startup - leaves curl waiting with no deadline of its own. The loop then
# never comes round, so $HEALTH_TIMEOUT_SECONDS never fires; and because bash defers a
# trap handler until the running foreground command returns, arm_interrupt_rollback's
# INT/TERM/HUP trap cannot run either. Reproduced against a container that accepts the
# connection and never answers: the run was still going at 91s against a 60s budget,
# the site was down, and SIGTERM had no effect for a further 30s.
#
# The budget is measured on the clock, not counted as iterations times the poll
# interval. A poll that uses its full timeout advances the clock by more than
# $HEALTH_POLL_SECONDS, so counting iterations let the real wait run well past the
# documented one.
#
# -S is deliberately absent. The loop already handles a failed poll, and curl's "Recv
# failure: Connection reset by peer" on stderr made every successful deploy print errors
# while the container was still booting.
wait_until_healthy() {
	local started="$SECONDS"
	while [ $((SECONDS - started)) -lt "$HEALTH_TIMEOUT_SECONDS" ]; do
		if curl -fs -o /dev/null \
			--connect-timeout "$HEALTH_REQUEST_TIMEOUT_SECONDS" \
			--max-time "$HEALTH_REQUEST_TIMEOUT_SECONDS" \
			"http://localhost:${HOST_PORT}/"; then
			info "container answers on http://localhost:${HOST_PORT}/ after $((SECONDS - started))s"
			return 0
		fi
		sleep "$HEALTH_POLL_SECONDS"
	done
	return 1
}

# Does the port answer at all? Asked on its own, because a shortener probe cannot tell
# a rejected origin from nothing listening.
container_is_answering() {
	curl -fs -o /dev/null -m "$SMOKE_TEST_TIMEOUT_SECONDS" "http://localhost:${HOST_PORT}/"
}

# Checks the EFFECT of PUBLIC_ALLOWED_ORIGINS, not its presence. POSTs an empty JSON
# body with one Origin header. In src/routes/api/shorten/+server.ts the
# origin check is step 1, the two rate limiters are steps 2 and 3, and the empty-body
# check is step 4, so:
#   400 "URL is required"     -> the origin was accepted; the variable reached the app
#   429 "Rate limit exceeded" -> also past the origin check, so the allowlist is fine
#   403 {"error":"Forbidden"} -> the July 2026 bug, exactly
# Nothing is sent to is.gd or TinyURL, because the request never reaches step 7.
# Content-Type is application/json because SvelteKit's built-in CSRF check rejects
# form content types only; a form-encoded body would 403 for an unrelated reason.
probe_shortener_origin() {
	local probed_origin="$1" response code body
	response="$(curl -sS -m "$SMOKE_TEST_TIMEOUT_SECONDS" -w '\n%{http_code}' -X POST \
		-H 'Content-Type: application/json' \
		-H "Origin: $probed_origin" \
		--data '{}' \
		"http://localhost:${HOST_PORT}/api/shorten" 2>/dev/null)" || {
		warn "shortener probe for $probed_origin could not reach the container on port ${HOST_PORT}"
		return 1
	}

	code="${response##*$'\n'}"
	body="${response%$'\n'*}"

	case "$code" in
	400 | 429)
		info "  $probed_origin accepted (HTTP $code on the empty test body, as expected)"
		return 0
		;;
	403)
		if printf '%s' "$body" | grep -q '"error"'; then
			warn "shortener REJECTED $probed_origin with 403."
			warn "PUBLIC_ALLOWED_ORIGINS did not reach the running app, or does not contain this origin."
			warn "A QR code generated on that origin would carry the full long URL. Body: $body"
		else
			warn "got 403 for $probed_origin, but not from the endpoint's own origin check. Body: $body"
			warn "This can mean SvelteKit's CSRF check rejected the request; see probe_shortener_origin in this script."
		fi
		return 1
		;;
	*)
		warn "shortener probe for $probed_origin got an unexpected status $code. Body: $body"
		return 1
		;;
	esac
}

# Probes EVERY entry of PUBLIC_ALLOWED_ORIGINS, not just ORIGIN. Probing ORIGIN alone
# was a tautology: validate_env has already proved ORIGIN is a member of the list, so
# the only thing the probe could ever catch was the variable not reaching the container
# at all. A second served hostname missing from the list now fails the deploy too.
smoke_test_shortener() {
	local entry failed=0
	split_origin_list "$PUBLIC_ALLOWED_ORIGINS"
	local entries=("${ORIGIN_ENTRIES[@]+"${ORIGIN_ENTRIES[@]}"}")

	info "probing the shortener with every entry of PUBLIC_ALLOWED_ORIGINS (${#entries[@]})"
	for entry in "${entries[@]+"${entries[@]}"}"; do
		probe_shortener_origin "$entry" || failed=1
	done

	[ "$failed" -eq 0 ] || return 1
	info "shortener origin check OK"
	return 0
}

dump_container_logs() {
	docker logs --tail "$LOG_TAIL_LINES" "$CONTAINER_NAME" >&2 2>&1 || true
}

# Keeps the running container under a second name instead of recording its image id.
# An image id is what `docker image prune -a` deletes, and the deployment guide's own
# Cleanup section recommends exactly that prune.
stash_current_container() {
	# $PREVIOUS_CONTAINER_NAME exists only while a deploy is in flight: a finished run
	# either removes it (success) or renames it back (rollback). Finding one here means
	# an earlier run died in between, which makes it the last container known to have
	# served the site. Deleting it - which is what this function used to do first,
	# before checking anything - throws away the only rollback target there is.
	if docker inspect "$PREVIOUS_CONTAINER_NAME" >/dev/null 2>&1; then
		die "$EXIT_USAGE" "a container named $PREVIOUS_CONTAINER_NAME is still here, so an earlier deploy did not finish.
  It is the last container known to have served the site, so this run will not
  delete it. Nothing was touched.
  Put it back, then deploy again:
    docker rm -f $CONTAINER_NAME
    docker rename $PREVIOUS_CONTAINER_NAME $CONTAINER_NAME
    docker start $CONTAINER_NAME
  Or, if $CONTAINER_NAME is serving correctly already, drop the stale copy:
    docker rm -f $PREVIOUS_CONTAINER_NAME"
	fi

	if docker inspect "$CONTAINER_NAME" >/dev/null 2>&1; then
		docker stop "$CONTAINER_NAME" >/dev/null
		docker rename "$CONTAINER_NAME" "$PREVIOUS_CONTAINER_NAME"
		PREVIOUS_SAVED=1
		info "kept the running container as $PREVIOUS_CONTAINER_NAME for rollback"
	else
		info "no container named $CONTAINER_NAME is present - this is a first deploy"
	fi
}

rollback() {
	# A rollback already under way needs no second one on top of it.
	disarm_interrupt_rollback
	# Only this run's own container may be removed. An interrupt can fire before
	# `docker run` was reached, and then $CONTAINER_NAME is still the container that
	# was serving the site a moment ago.
	if [ "$NEW_CONTAINER_OWNS_NAME" -eq 1 ]; then
		docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
		NEW_CONTAINER_OWNS_NAME=0
	fi
	if [ "$PREVIOUS_SAVED" -eq 0 ]; then
		warn "there was no previous container, so there is nothing to restore"
		return 1
	fi
	info "restoring $PREVIOUS_CONTAINER_NAME"
	docker rename "$PREVIOUS_CONTAINER_NAME" "$CONTAINER_NAME" >/dev/null || return 1
	docker start "$CONTAINER_NAME" >/dev/null || return 1
	wait_until_healthy || return 1
	PREVIOUS_SAVED=0
	info "rolled back and healthy"
	append_deploy_log "rolled back at $(timestamp)"
	return 0
}

discard_previous_container() {
	if [ "$PREVIOUS_SAVED" -eq 1 ]; then
		docker rm -f "$PREVIOUS_CONTAINER_NAME" >/dev/null 2>&1 ||
			warn "could not remove $PREVIOUS_CONTAINER_NAME. Remove it by hand, or the next deploy will refuse to start."
		PREVIOUS_SAVED=0
	fi
}

# An interrupted deploy used to leave the site down: the new container kept
# restarting under `--restart unless-stopped` while the known-good one sat stopped
# under $PREVIOUS_CONTAINER_NAME. A dropped SSH session (SIGHUP) or a Ctrl-C anywhere
# in the ~75s of health check plus smoke test was enough.
on_interrupt() {
	local signal="$1"
	# Disarmed first, so a second Ctrl-C stops the script outright instead of
	# re-entering a rollback that is already running.
	disarm_interrupt_rollback
	warn "interrupted by SIG${signal} while replacing the container"
	if rollback; then
		die "$EXIT_NOT_DEPLOYED" "interrupted; rolled back to the previous container"
	fi
	die "$EXIT_PARTIAL" "interrupted, and the previous container could not be restored - see the warning above. The live site needs attention now."
}

# Armed only around the mutating phase, so interrupting --dry-run or --check-only
# still just stops. The two docker calls inside stash_current_container are outside
# the armed window on purpose: until the rename has happened there is no previous
# container to restore, and the container that was serving is still in place.
arm_interrupt_rollback() {
	local signal
	for signal in INT TERM HUP; do
		# shellcheck disable=SC2064 # $signal must expand now, not when the trap fires.
		trap "on_interrupt $signal" "$signal"
	done
}

disarm_interrupt_rollback() { trap - INT TERM HUP; }

main() {
	parse_args "$@"

	command -v docker >/dev/null 2>&1 || die "$EXIT_USAGE" "docker not found on PATH"
	command -v curl >/dev/null 2>&1 || die "$EXIT_USAGE" "curl not found on PATH"

	load_env_file
	validate_env

	if [ "$CHECK_ONLY" -eq 1 ]; then
		info "checking the container already running on port ${HOST_PORT} - deploying nothing"
		# Liveness first. The shortener probe cannot tell "the origin was rejected"
		# from "nothing answered", and it used to report the former either way - so an
		# unattended check mailed a shortener diagnosis while the site was fully down.
		container_is_answering ||
			die "$EXIT_PARTIAL" "nothing answers on http://localhost:${HOST_PORT}/ - the site is down, so the shortener could not be checked.
  Look at the container first:
    docker ps -a --filter name=$CONTAINER_NAME
    docker logs --tail $LOG_TAIL_LINES $CONTAINER_NAME"
		smoke_test_shortener ||
			die "$EXIT_PARTIAL" "the running deployment fails the shortener origin check. The site is up, but every QR code carries the full long URL."
		info "check passed"
		exit 0
	fi

	local image_ref="${IMAGE_REPO}:${TAG}"
	build_run_args "$image_ref"

	if [ "$DRY_RUN" -eq 1 ]; then
		info "dry run - nothing was changed. The command that would run (contains values, do not paste this into an issue):"
		printf '%q ' "${RUN_ARGS[@]}" >&2
		printf '\n' >&2
		exit 0
	fi

	if [ "$DO_PULL" -eq 1 ]; then
		info "pulling $image_ref"
		docker pull "$image_ref" >/dev/null ||
			die "$EXIT_NOT_DEPLOYED" "docker pull failed for $image_ref. Nothing was changed; retry."
	fi

	local digest
	digest="$(docker inspect --format '{{index .RepoDigests 0}}' "$image_ref" 2>/dev/null || printf '%s' "$image_ref")"

	stash_current_container
	arm_interrupt_rollback

	info "starting the new container"
	NEW_CONTAINER_OWNS_NAME=1
	if ! "${RUN_ARGS[@]}" >/dev/null; then
		rollback || die "$EXIT_PARTIAL" "the new container would not start and the previous one could not be restored - see the warning above. The live site needs attention now."
		die "$EXIT_NOT_DEPLOYED" "the new container would not start; rolled back to the previous one"
	fi

	if ! wait_until_healthy; then
		warn "the new container did not answer within ${HEALTH_TIMEOUT_SECONDS}s"
		dump_container_logs
		rollback || die "$EXIT_PARTIAL" "the new container is unhealthy and the previous one could not be restored - see the warning above. The live site needs attention now."
		die "$EXIT_NOT_DEPLOYED" "deploy failed the health check; rolled back to the previous container"
	fi

	if ! smoke_test_shortener; then
		dump_container_logs
		rollback || die "$EXIT_PARTIAL" "the shortener check failed and the previous container could not be restored - see the warning above. The live site needs attention now."
		die "$EXIT_NOT_DEPLOYED" "deploy rejected: the shortener refused the site's own origin; rolled back"
	fi

	# The deploy has passed every check from here on, so an interrupt must no longer
	# roll back a container that is serving correctly.
	disarm_interrupt_rollback
	discard_previous_container
	append_deploy_log "deployed $digest at $(timestamp)"
	info "deploy complete"
	printf '%s\n' "$digest"
}

main "$@"
