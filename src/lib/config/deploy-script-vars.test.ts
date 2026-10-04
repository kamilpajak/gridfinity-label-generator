/**
 * Drift guard between the app, the VPS deploy script, the committed env templates and
 * the copy-paste container commands in the deployment guide.
 *
 * `scripts/deploy.sh` names every environment variable the container is started
 * with. A `PUBLIC_*` variable the app reads but the script does not know about would
 * simply be absent from the container, and nothing would fail loudly — that is how
 * `PUBLIC_ALLOWED_ORIGINS` stayed missing from the live deployment for three months
 * while `POST /api/shorten` answered 403 to the site's own origin.
 *
 * Every assertion here is a rule rather than a list of the names known today, because
 * a list only guards what someone remembered to add to it:
 *
 * - Listing a variable used to be enough to satisfy the drift check, including listing
 *   it in `REFUSED_VARS` — which `build_run_args` never passes. Pasting a new name into
 *   the nearest array therefore turned CI green while guaranteeing the container never
 *   received the value. The arrays are now checked against what `build_run_args`
 *   actually does with them, and against the templates.
 * - The templates were checked against five hardcoded operator-specific prefixes, so a
 *   future `PUBLIC_SENTRY_DSN` with a real key in it would have been committed to a
 *   public repository with CI green. The rule is now that every value in a committed
 *   template is empty, which needs no maintenance when a variable is added.
 * - The deployment guide carries two hand-maintained `-e NAME` lists — the local
 *   "Test Docker build" command and the break-glass command — which is the exact
 *   artefact the page tells the reader never to retype. Both are now checked against the
 *   script's own arrays.
 *
 * One hole is deliberately left open, because no text-reading test can close it. A name
 * pasted into `REFUSED_VARS` *and* pinned to a fixed value in `build_run_args` satisfies
 * every rule here while the container receives the pin instead of the operator's value.
 * Reproduced: adding `PUBLIC_NEW_THING` to `REFUSED_VARS` alone fails
 * `pins every refused variable instead of passing it`, and adding
 * `-e "PUBLIC_NEW_THING=false"` next to it makes the suite green again. The test cannot
 * tell a variable that genuinely must never carry a value from one that was misfiled, so
 * the rule below asks for the justification to be written down in the comment above
 * `REFUSED_VARS`, where a reviewer will see it.
 *
 * These tests read the script, the templates and the guide as text. They do not run them.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT, listPublicEnvVarsReadBySource } from './public-env-var-scan';

const DEPLOY_SCRIPT = join(REPO_ROOT, 'scripts/deploy.sh');
const DEPLOY_ENV_TEMPLATE = join(REPO_ROOT, 'scripts/deploy.env.example');
const ROOT_ENV_TEMPLATE = join(REPO_ROOT, '.env.example');
const DEPLOYMENT_GUIDE = join(REPO_ROOT, 'docs/guides/deployment.md');

/**
 * Both committed templates get the same value rules. `.env.example` is the one CI makes a
 * developer edit when the app starts reading a new variable
 * (`env-documentation.test.ts`), so leaving it unguarded put the guard on the wrong file:
 * a real Sentry DSN pasted there passed the whole suite.
 */
const COMMITTED_ENV_TEMPLATES = [
	{ label: 'scripts/deploy.env.example', path: DEPLOY_ENV_TEMPLATE },
	{ label: '.env.example', path: ROOT_ENV_TEMPLATE }
] as const;

/** The script arrays that together cover every variable the deploy knows about. */
const REQUIRED_VARS_ARRAY = 'REQUIRED_VARS';
const OPTIONAL_VARS_ARRAY = 'OPTIONAL_VARS';
const REFUSED_VARS_ARRAY = 'REFUSED_VARS';
const ALL_VAR_ARRAYS = [REQUIRED_VARS_ARRAY, OPTIONAL_VARS_ARRAY, REFUSED_VARS_ARRAY] as const;

/** The arrays whose values come from the operator's env file and reach the container. */
const PASSED_VAR_ARRAYS = [REQUIRED_VARS_ARRAY, OPTIONAL_VARS_ARRAY] as const;

/** The script function that builds the `docker run` argv. */
const RUN_ARGS_BUILDER = 'build_run_args';

/** Without this the shortener rejects its own front end and every QR code stays long. */
const SHORTENER_ORIGIN_VAR = 'PUBLIC_ALLOWED_ORIGINS';

/** `true` on the public site would expose the internal `/e2e` comparison routes. */
const E2E_PAGES_VAR = 'PUBLIC_ALLOW_E2E_PAGES';

/** SvelteKit adapter-node resolves request URLs with it. */
const SITE_ORIGIN_VAR = 'ORIGIN';

const SHELL_COMMENT_PATTERN = /#.*$/;
const COMMENT_LINE_PATTERN = /^\s*#/;
const ENV_ASSIGNMENT_PATTERN = /^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)=(.*)$/;
/** A trailing ` # …` after a value, which is a comment and not part of the value. */
const TRAILING_COMMENT_PATTERN = /\s+#.*$/;
const SURROUNDING_QUOTES_PATTERN = /^(['"])(.*)\1$/;
const SHELL_VAR_NAME_PATTERN = /^[A-Z][A-Z0-9_]*$/;
/** `readonly NAME="literal"` at the top of the script. */
const SCRIPT_CONSTANT_PATTERN = /^readonly ([A-Z][A-Z0-9_]*)="([^"$]*)"$/gm;
/** `-e "NAME=..."` inside the argv builder. `NAME` may be a `${CONSTANT}`. */
const RUN_ARG_ENV_PATTERN = /-e "([^"=]+)=/g;
/** The comment lines immediately above `readonly REFUSED_VARS=(`. */
const REFUSED_VARS_COMMENT_PATTERN = /((?:^#.*\n)+)readonly REFUSED_VARS=\(/m;
/** A fenced ```bash block in the guide. */
const FENCED_BASH_BLOCK_PATTERN = /```bash\n([\s\S]*?)```/g;
/** A line inside such a block whose command IS `docker run`. */
const DOCKER_RUN_COMMAND_PATTERN = /^\s*(?:sudo\s+)?docker\s+run\b/;
/** A URL anywhere on a comment line, whose host must be a reserved example host. */
const URL_IN_VALUE_PATTERN = /https?:\/\/[^\s,"'<>]+/g;
/** `${ARRAY[@]}` — how the builder iterates one of the variable arrays. */
/** The host-port publish flag inside the argv builder, e.g. `-p "${A}:${B}:${C}"`. */
const PUBLISH_FLAG_PATTERN = /-p "([^"]+)"/g;
/** `-e "NAME=value"` inside the argv builder, value included, so a pin can be resolved. */
const RUN_ARG_ENV_ASSIGNMENT_PATTERN = /-e "([^"]+)"/g;
/** `${NAME}` inside a flag, resolvable through the script's readonly constants. */
const CONSTANT_EXPANSION_PATTERN = /\$\{([A-Z][A-Z0-9_]*)\}/g;

/** Addresses that keep the published port off every non-local interface. */
const LOOPBACK_PUBLISH_HOSTS = ['127.0.0.1', '::1'];
/** The bind address constant the publish flag and every probe must both go through. */
const BIND_ADDRESS_CONSTANT = 'HOST_BIND_ADDRESS';
/** Written out so a probe cannot quietly go back to a hardcoded address or to `localhost`. */
const PROBE_URL_PREFIX = 'http://${HOST_BIND_ADDRESS}:${HOST_PORT}';
/** Every function that talks to the container over HTTP. */
const PROBE_FUNCTIONS = ['wait_until_healthy', 'container_is_answering', 'probe_shortener_origin'];
/** Flags that would make the publish spec meaningless, or lose the restart policy. */
const FORBIDDEN_RUN_FLAGS = ['--network', '--net', '--publish-all', '-P'];
const REQUIRED_RUN_FLAGS = ['--restart unless-stopped'];
/** The guide's own `docker run` blocks that publish the app's port. */
const GUIDE_PUBLISHED_PORT = '8081';
const GUIDE_PUBLISHING_COMMAND_COUNT = 2;

/** Substitutes `${NAME}` from the script's readonly constants, leaving unknown names alone. */
function resolveScriptConstants(value: string, constants: Map<string, string>): string {
	return value.replace(CONSTANT_EXPANSION_PATTERN, (whole, name) => constants.get(name) ?? whole);
}

const arrayExpansion = (arrayName: string) => `\${${arrayName}[@]}`;

/**
 * Hosts a committed example value may name. RFC 2606 and RFC 6761 set these aside
 * precisely so documentation cannot name a real endpoint by accident.
 */
const RESERVED_EXAMPLE_HOSTS = ['localhost', '127.0.0.1'];
const RESERVED_EXAMPLE_HOST_SUFFIXES = [
	'example.com',
	'example.net',
	'example.org',
	'.example',
	'.test',
	'.invalid',
	'.localhost'
];

/** Entries of one `NAME=( ... )` array in the deploy script, comments stripped. */
function scriptArrayEntries(script: string, arrayName: string): string[] {
	const match = new RegExp(`${arrayName}=\\(([^)]*)\\)`).exec(script);
	if (!match) {
		throw new Error(`${arrayName} not found in scripts/deploy.sh`);
	}
	return match[1]
		.split('\n')
		.map((line) => line.replace(SHELL_COMMENT_PATTERN, '').trim())
		.filter(Boolean);
}

/** The text of one `name() { ... }` function, up to its closing brace in column 0. */
function scriptFunctionBody(script: string, functionName: string): string {
	const start = script.indexOf(`${functionName}() {`);
	if (start === -1) {
		throw new Error(`${functionName} not found in scripts/deploy.sh`);
	}
	const end = script.indexOf('\n}', start);
	if (end === -1) {
		throw new Error(`${functionName} is never closed in scripts/deploy.sh`);
	}
	return script.slice(start, end);
}

/** `readonly NAME="literal"` constants, so `-e "${NAME}=false"` can be resolved. */
function scriptConstants(script: string): Map<string, string> {
	const constants = new Map<string, string>();
	for (const [, name, value] of script.matchAll(SCRIPT_CONSTANT_PATTERN)) {
		constants.set(name, value);
	}
	return constants;
}

/**
 * Variable names the argv builder pins to a fixed value, such as
 * `-e "${E2E_PAGES_VAR}=false"`. Names that come from the env file are passed inside a
 * loop over an array, so their line reads `-e "${name}=${value}"` and is skipped here:
 * the lowercase `${name}` resolves to no constant and fails the shell-name filter.
 */
function pinnedVarNames(script: string): string[] {
	const constants = scriptConstants(script);
	const body = scriptFunctionBody(script, RUN_ARGS_BUILDER);
	return [...body.matchAll(RUN_ARG_ENV_PATTERN)]
		.map(([, name]) => constants.get(name.replace(/^\$\{(.*)\}$/, '$1')) ?? name)
		.filter((name) => SHELL_VAR_NAME_PATTERN.test(name));
}

/**
 * Every `NAME=value` assignment in a committed template, in file order and keeping
 * duplicates. A list and not a map: keying by name let a real value followed by an empty
 * re-assignment of the same name hide behind the empty one, while the real string stayed
 * in the committed file. Reproduced with `PUBLIC_AMAZON_STORE_ID="realtag-21"` followed
 * by `PUBLIC_AMAZON_STORE_ID=""`, which the old guard passed.
 *
 * A trailing ` # comment` is stripped before the quotes are removed. Without that an
 * empty value with a note beside it — `PUBLIC_NEW_FLAG="" # off unless you need it` —
 * failed the emptiness rule with the confusing message that a value was committed.
 */
function templateAssignments(template: string): { name: string; value: string }[] {
	const assignments: { name: string; value: string }[] = [];
	for (const line of template.split('\n')) {
		const match = ENV_ASSIGNMENT_PATTERN.exec(line);
		if (!match) continue;
		const [, name, rawValue] = match;
		const withoutComment = rawValue.trim().replace(TRAILING_COMMENT_PATTERN, '');
		const unquoted = SURROUNDING_QUOTES_PATTERN.exec(withoutComment);
		assignments.push({ name, value: (unquoted ? unquoted[2] : withoutComment).trim() });
	}
	return assignments;
}

/** Assigned names, for the rules that only ask whether a variable is mentioned at all. */
function templateAssignedNames(template: string): Set<string> {
	return new Set(templateAssignments(template).map(({ name }) => name));
}

/** The one value of `name`, for the rules that care what a specific variable says. */
function templateValue(template: string, name: string): string | undefined {
	return templateAssignments(template).find((assignment) => assignment.name === name)?.value;
}

/**
 * `NAME="value"` shapes that appear inside a comment. The templates' own convention is to
 * show an example value in a comment above the assignment, which is the one place the
 * assignment parser never looks — so a real endpoint or key could be committed there with
 * every guard green. Reproduced with a live-looking Sentry DSN in a comment.
 *
 * This scans every URL on a comment line, not only URLs inside a `NAME="value"` shape.
 * That shape is the convention in scripts/deploy.env.example, but .env.example writes its
 * examples as bare quoted URLs in prose, so the narrower version found nothing there and
 * passed vacuously on one of the two files it is meant to cover. An unquoted
 * `# NAME=https://real-host/`, a bare URL in prose and a trailing inline comment all
 * escaped it as well.
 */
function templateCommentUrls(template: string): { line: string; host: string }[] {
	const found: { line: string; host: string }[] = [];
	for (const line of template.split('\n')) {
		if (!COMMENT_LINE_PATTERN.test(line)) continue;
		for (const host of urlHostsIn(line)) {
			found.push({ line: line.trim(), host });
		}
	}
	return found;
}

/** Hosts named by any URL inside one value. */
function urlHostsIn(value: string): string[] {
	return [...value.matchAll(URL_IN_VALUE_PATTERN)].map(
		([url]) => url.replace(/^https?:\/\//, '').split(/[/:?#]/)[0]
	);
}

function isReservedExampleHost(host: string): boolean {
	const lower = host.toLowerCase();
	return (
		RESERVED_EXAMPLE_HOSTS.includes(lower) ||
		RESERVED_EXAMPLE_HOST_SUFFIXES.some((suffix) => lower.endsWith(suffix))
	);
}

/**
 * Each `docker run` invocation in the guide, as one shell command including its
 * backslash-continued lines.
 *
 * The line has to START with the command. Matching `docker run` anywhere in a line also
 * matched `sudo ./scripts/deploy.sh --dry-run  # … print the exact docker run command`,
 * which is a sentence about a command, carries no `-e` flags, and made the rule below
 * fail on the guide as written.
 */
function guideDockerRunCommands(guide: string): string[] {
	const commands: string[] = [];
	for (const [, body] of guide.matchAll(FENCED_BASH_BLOCK_PATTERN)) {
		const lines = body.split('\n');
		for (let index = 0; index < lines.length; index += 1) {
			if (!DOCKER_RUN_COMMAND_PATTERN.test(lines[index])) {
				continue;
			}
			const command = [lines[index]];
			while (command[command.length - 1].trimEnd().endsWith('\\') && index + 1 < lines.length) {
				index += 1;
				command.push(lines[index]);
			}
			commands.push(command.join('\n'));
		}
	}
	return commands;
}

/** Does a command pass `name` to the container, as `-e NAME` or `-e NAME=...`? */
function commandPassesVar(command: string, name: string): boolean {
	return new RegExp(`-e "?${name}("|=|\\s|$)`, 'm').test(command);
}

describe('scripts/deploy.sh environment coverage', () => {
	const script = readFileSync(DEPLOY_SCRIPT, 'utf8');
	const passedVars = PASSED_VAR_ARRAYS.flatMap((name) => scriptArrayEntries(script, name));
	const refusedVars = scriptArrayEntries(script, REFUSED_VARS_ARRAY);

	it('names every PUBLIC_ variable the app reads', () => {
		const known = new Set(ALL_VAR_ARRAYS.flatMap((name) => scriptArrayEntries(script, name)));

		const unlisted = listPublicEnvVarsReadBySource().filter((name) => !known.has(name));

		expect(
			unlisted,
			'These PUBLIC_* variables are read by src/ but are not listed in scripts/deploy.sh. ' +
				'Add each one to REQUIRED_VARS (the deploy must refuse to start without it), ' +
				'OPTIONAL_VARS (an empty value disables a feature), or REFUSED_VARS (must never be ' +
				'set in production), and add it to scripts/deploy.env.example.'
		).toEqual([]);
	});

	it('treats the shortener origin allowlist as required', () => {
		const required = scriptArrayEntries(script, REQUIRED_VARS_ARRAY);

		expect(required).toContain(SHORTENER_ORIGIN_VAR);
	});

	it('refuses the e2e preview routes in production', () => {
		expect(refusedVars).toContain(E2E_PAGES_VAR);
	});

	it('passes the required and optional arrays to the container', () => {
		const builder = scriptFunctionBody(script, RUN_ARGS_BUILDER);

		for (const arrayName of PASSED_VAR_ARRAYS) {
			expect(
				builder,
				`${RUN_ARGS_BUILDER} must iterate ${arrayName}, or the variables listed there ` +
					'are never passed to the container.'
			).toContain(arrayExpansion(arrayName));
		}
	});

	it('pins every refused variable instead of passing it', () => {
		const builder = scriptFunctionBody(script, RUN_ARGS_BUILDER);
		const pinned = pinnedVarNames(script);

		// A refused variable has to be visibly pinned off in `docker inspect`, not merely
		// absent. Requiring that also stops REFUSED_VARS from being used as a parking
		// space: a new name dropped in there satisfied the coverage test above while
		// guaranteeing the container never received the value.
		const notPinned = refusedVars.filter((name) => !pinned.includes(name));
		expect(
			notPinned,
			'These names are in REFUSED_VARS but are not pinned to a fixed value in ' +
				`${RUN_ARGS_BUILDER}. REFUSED_VARS is for variables that must never carry an ` +
				'operator value and are pinned off so the decision shows up in `docker inspect`. ' +
				'A variable the container actually needs belongs in REQUIRED_VARS or OPTIONAL_VARS.'
		).toEqual([]);

		expect(
			builder,
			`${RUN_ARGS_BUILDER} must not iterate ${REFUSED_VARS_ARRAY}: those values must ` +
				'never be taken from the env file.'
		).not.toContain(arrayExpansion(REFUSED_VARS_ARRAY));
	});

	it('explains in the comment why each refused variable is refused', () => {
		// Pinning a name is a one-line act, and a name pinned by mistake looks exactly like
		// a name pinned on purpose. Requiring the comment to mention it makes the author
		// write down the reason, which is the part a reviewer can actually judge.
		const comment = REFUSED_VARS_COMMENT_PATTERN.exec(script)?.[1] ?? '';

		const unexplained = refusedVars.filter((name) => !comment.includes(name));

		expect(
			unexplained,
			'These names are in REFUSED_VARS but are not mentioned in the comment above the ' +
				'array. Say there what the variable does and why a production deploy must never ' +
				'carry a value for it, so the pin in build_run_args can be reviewed.'
		).toEqual([]);
	});

	it('does not pin a variable that comes from the env file', () => {
		const pinned = pinnedVarNames(script);

		const overridden = passedVars.filter((name) => pinned.includes(name));

		expect(
			overridden,
			'These names are both read from the env file and pinned to a fixed value in ' +
				`${RUN_ARGS_BUILDER}, so the operator's value is silently ignored.`
		).toEqual([]);
	});
});

describe.each(COMMITTED_ENV_TEMPLATES)('$label', ({ label, path }) => {
	const template = readFileSync(path, 'utf8');
	const assignments = templateAssignments(template);
	const commentUrls = templateCommentUrls(template);

	it('commits no value at all', () => {
		// A rule, not a list of operator-specific prefixes: the next variable anyone adds
		// is covered without touching this test. A real Matomo id, affiliate tag, contact
		// address or API key in a template would be published in a public repository,
		// and a fork copying the template unedited would inherit it.
		const withValue = assignments
			.filter(({ value }) => value !== '')
			.map(({ name, value }) => `${name}=${value}`);

		expect(
			withValue,
			`Every value in ${label} must be empty. Show an example in a comment above the ` +
				'assignment instead. A committed value is published in a public repository, and a ' +
				'fork that copies the template unedited inherits it.'
		).toEqual([]);
	});

	it('names only reserved example hosts in comments', () => {
		// The convention is to put the example value in a comment, which is exactly where
		// the assignment rule above cannot see it.
		//
		// What this rule checks, precisely: every URL on a comment line names a host
		// reserved for documentation. That covers the committed-endpoint shape — an
		// analytics instance, an error-reporting DSN, an API host — and a DSN carries its
		// key in the URL, so it covers that key too. It does NOT check an example value
		// with no URL in it: an Amazon Associates tag in a comment would pass. The
		// surrounding prose tells the reader to keep those fake; nothing enforces it.
		const realHosts = commentUrls
			.filter(({ host }) => !isReservedExampleHost(host))
			.map(({ host, line }) => `${host}  (in: ${line})`);

		expect(
			realHosts,
			`A comment in ${label} names a host that is not reserved for documentation. Use ` +
				'example.com, example.org, example.net, or a .test / .invalid / .example name. If ' +
				'this is a link to real documentation rather than an example value, refer to it ' +
				'without the URL — this rule cannot tell the two apart.'
		).toEqual([]);
	});

	it('actually has a comment URL to check', () => {
		// Without this the rule above goes quiet the moment a template's comment style
		// changes, which is how the narrower version it replaced came to pass on
		// .env.example while checking nothing there.
		expect(
			commentUrls.length,
			`No URL was found in any comment in ${label}, so the reserved-host rule above ` +
				'checked nothing. Either the template lost its example values or the comment ' +
				'scanner no longer matches its style.'
		).toBeGreaterThan(0);
	});
});

describe('scripts/deploy.env.example', () => {
	const script = readFileSync(DEPLOY_SCRIPT, 'utf8');
	const template = readFileSync(DEPLOY_ENV_TEMPLATE, 'utf8');
	const assignedNames = templateAssignedNames(template);

	it('leaves the operator to name the domain this host serves', () => {
		// Deliberately empty rather than pre-filled with gridfinitylabels.com. Every check
		// in deploy.sh is internal — it compares ORIGIN against the committed allowlist and
		// probes the container with those same committed values — so a fork that changed
		// neither would pass every check and still 403 its own front end. Empty makes the
		// required-variable check force a decision.
		for (const name of [SITE_ORIGIN_VAR, SHORTENER_ORIGIN_VAR]) {
			expect(assignedNames.has(name), `${name} must be present in the template`).toBe(true);
			expect(templateValue(template, name)).toBe('');
		}
	});

	it('assigns every variable the deploy passes to the container', () => {
		const passedVars = PASSED_VAR_ARRAYS.flatMap((name) => scriptArrayEntries(script, name));

		const unassigned = passedVars.filter((name) => !assignedNames.has(name));

		expect(
			unassigned,
			'These variables are passed to the container by scripts/deploy.sh but are not ' +
				'assigned in scripts/deploy.env.example, so the operator never learns they exist ' +
				'and the host env file stays behind.'
		).toEqual([]);
	});

	it('does not assign a refused variable', () => {
		const refused = scriptArrayEntries(script, REFUSED_VARS_ARRAY);

		const assigned = refused.filter((name) => assignedNames.has(name));

		expect(
			assigned,
			'These variables are in REFUSED_VARS, so scripts/deploy.sh refuses to deploy when ' +
				'they are set. The template must describe them in a comment, not assign them.'
		).toEqual([]);
	});
});

describe('docs/guides/deployment.md container commands', () => {
	const script = readFileSync(DEPLOY_SCRIPT, 'utf8');
	const guide = readFileSync(DEPLOYMENT_GUIDE, 'utf8');
	const passedVars = PASSED_VAR_ARRAYS.flatMap((name) => scriptArrayEntries(script, name));
	const commands = guideDockerRunCommands(guide);

	it('finds the hand-maintained docker run commands', () => {
		// Without this the rule below would pass by finding nothing. The guide carries two:
		// the local "Test Docker build" command and the break-glass command.
		expect(commands.length).toBeGreaterThanOrEqual(2);
	});

	it.each(commands.map((command, index) => ({ index, command })))(
		'passes every variable the deploy passes (command $index)',
		({ command }) => {
			// These are the last unguarded copies of the container's environment list. The
			// break-glass command exists precisely because retyping that list from memory is
			// how PUBLIC_ALLOWED_ORIGINS went missing for three months, so it must not be
			// allowed to drift from the script. Reproduced: deleting only the
			// `-e PUBLIC_CONTACT_EMAIL` line from the break-glass block left the whole suite
			// green, because the other guards only ask whether the name appears somewhere on
			// the page.
			const missing = passedVars.filter((name) => !commandPassesVar(command, name));

			expect(
				missing,
				'This docker run command in docs/guides/deployment.md does not pass these ' +
					'variables, which scripts/deploy.sh does pass. Add `-e NAME` for each one, or ' +
					'the documented command starts a container with a different environment from a ' +
					'real deploy — the failure this page exists to prevent.'
			).toEqual([]);
		}
	);
});

/**
 * The published port must stay on the loopback address.
 *
 * There is no firewall in front of docker's DNAT rules on the deployment host, so the bind
 * address is the whole perimeter: `-p 8081:80` publishes the app on the public IP and
 * bypasses Cloudflare's TLS, WAF and logs entirely. These rules exist because an adversarial
 * review of the first version of this guard found four edits that broke production while
 * every rule still passed: flipping the e2e pin (the older rules collected names, not
 * values), adding `--network host` (which makes docker ignore the publish spec and the app
 * bind the host directly), moving the constants to a different loopback address or port
 * (which leaves the tunnel pointing at nothing), and dropping the restart policy.
 */
describe('scripts/deploy.sh port publishing', () => {
	const script = readFileSync(DEPLOY_SCRIPT, 'utf8');
	const constants = scriptConstants(script);
	const builder = scriptFunctionBody(script, RUN_ARGS_BUILDER);

	it('publishes on a loopback address only', () => {
		const specs = [...builder.matchAll(PUBLISH_FLAG_PATTERN)].map(([, spec]) => spec);

		expect(specs, `${RUN_ARGS_BUILDER} must publish exactly one port mapping`).toHaveLength(1);

		const resolved = resolveScriptConstants(specs[0], constants);
		const fields = resolved.split(':');

		expect(
			fields,
			`The publish spec resolves to '${resolved}'. It must have three colon-separated ` +
				'fields - host address, host port, container port. Two fields means the host ' +
				'address was left out, which binds every interface including the public one.'
		).toHaveLength(3);

		expect(
			LOOPBACK_PUBLISH_HOSTS,
			`The publish spec resolves to '${resolved}', whose host address is not a loopback ` +
				'address. With no firewall in front of docker, that puts the app on the public IP.'
		).toContain(fields[0]);
	});

	it('probes the address it publishes on', () => {
		const missing = PROBE_FUNCTIONS.filter(
			(name) => !scriptFunctionBody(script, name).includes(PROBE_URL_PREFIX)
		);

		expect(
			missing,
			`These functions do not probe ${PROBE_URL_PREFIX}. The publish address and the probe ` +
				'address have to be the same string, or they can drift: a probe hardcoded to an ' +
				'address, or left as `localhost`, starts depending on /etc/hosts instead of on the ' +
				'constant the container is actually published with.'
		).toEqual([]);
	});

	it('has no probe left on a hostname', () => {
		// The rule above only asks whether the prefix appears somewhere in each function, and
		// wait_until_healthy contains it twice - so changing one of the two back to `localhost`
		// satisfied it. Reproduced before this assertion existed. The deployment host resolves
		// `localhost` to ::1 only, where nothing listens, so a probe on the hostname works by
		// falling back to IPv4 and would stop working the day that resolution changes.
		const code = script
			.split('\n')
			.filter((line) => !COMMENT_LINE_PATTERN.test(line))
			.join('\n');
		const strays = [...code.matchAll(/http:\/\/[A-Za-z][A-Za-z0-9.-]*:/g)].map(([url]) => url);

		expect(
			strays,
			'These URLs in scripts/deploy.sh address the container by hostname instead of through ' +
				`the ${BIND_ADDRESS_CONSTANT} constant. Every probe and every message must use ` +
				`${PROBE_URL_PREFIX}, so the address the script talks to cannot differ from the one ` +
				'it published.'
		).toEqual([]);
	});

	it('keeps the loopback address in exactly one place', () => {
		// Comment lines are exempt: the rationale for the bind address legitimately spells the
		// address out, and the rule is about a second place the code could read it from.
		const code = script
			.split('\n')
			.filter((line) => !COMMENT_LINE_PATTERN.test(line))
			.join('\n');
		const occurrences = code.split(LOOPBACK_PUBLISH_HOSTS[0]).length - 1;

		expect(
			occurrences,
			`'${LOOPBACK_PUBLISH_HOSTS[0]}' appears ${occurrences} times in scripts/deploy.sh. It ` +
				`must appear exactly once, as the ${BIND_ADDRESS_CONSTANT} constant, so changing the ` +
				'bind address is one reviewed edit rather than a hunt through the file.'
		).toBe(1);
	});

	it('pins the e2e routes off by value, not only by name', () => {
		const assignments = [...builder.matchAll(RUN_ARG_ENV_ASSIGNMENT_PATTERN)]
			.map(([, assignment]) => resolveScriptConstants(assignment, constants))
			.filter((assignment) => assignment.startsWith(`${E2E_PAGES_VAR}=`));

		expect(
			assignments,
			`${RUN_ARGS_BUILDER} must pin ${E2E_PAGES_VAR} exactly once. The other guards in this ` +
				'file collect flag NAMES, so flipping the pinned value would publish the internal ' +
				'/e2e routes with every test still green.'
		).toEqual([`${E2E_PAGES_VAR}=false`]);
	});

	it('does not use a flag that would defeat the publish spec', () => {
		const present = FORBIDDEN_RUN_FLAGS.filter((flag) =>
			new RegExp(`(^|\\s)${flag.replace('-', '\\-')}(\\s|$)`, 'm').test(builder)
		);

		expect(
			present,
			`${RUN_ARGS_BUILDER} uses these flags, each of which makes the loopback publish ` +
				'meaningless: host networking ignores -p entirely and binds the app on the host, ' +
				'and publish-all opens every exposed port on every interface.'
		).toEqual([]);
	});

	it('keeps the restart policy', () => {
		const missing = REQUIRED_RUN_FLAGS.filter((flag) => !builder.includes(flag));

		expect(
			missing,
			`${RUN_ARGS_BUILDER} must pass these flags. Without the restart policy the site does ` +
				'not come back after a reboot, and nothing else here would notice.'
		).toEqual([]);
	});
});

/**
 * The guide's own `docker run` blocks must publish the same way the script does.
 *
 * The break-glass block is the one an operator pastes during an incident, from whatever copy
 * of the page they have open — so a stale `-p 8081:80` there reopens the public port at the
 * worst possible moment, and `--restart unless-stopped` keeps it open across reboots.
 * Deliberately not restricted to the production image: a locally built image on
 * 0.0.0.0:8081 on that host is the same exposure.
 */
describe('docs/guides/deployment.md port publishing', () => {
	const guide = readFileSync(DEPLOYMENT_GUIDE, 'utf8');
	const publishing = guideDockerRunCommands(guide).filter((command) =>
		command.includes(GUIDE_PUBLISHED_PORT)
	);

	it('finds every docker run command that publishes the port', () => {
		expect(
			publishing.length,
			`Expected ${GUIDE_PUBLISHING_COMMAND_COUNT} docker run commands publishing port ` +
				`${GUIDE_PUBLISHED_PORT} in the guide, found ${publishing.length}. An exact count, ` +
				'not a minimum, so deleting one block cannot make the rule below pass vacuously.'
		).toBe(GUIDE_PUBLISHING_COMMAND_COUNT);
	});

	it.each(publishing.map((command, index) => ({ index, command })))(
		'publishes on a loopback address (command $index)',
		({ command }) => {
			const specs = [...command.matchAll(PUBLISH_FLAG_PATTERN)].map(([, spec]) => spec);
			const bare = [...command.matchAll(/-p (\S+)/g)].map(([, spec]) => spec);
			const allSpecs = specs.length > 0 ? specs : bare;
			const bad = allSpecs.filter((spec) => {
				const fields = spec.split(':');
				return fields.length !== 3 || !LOOPBACK_PUBLISH_HOSTS.includes(fields[0]);
			});

			expect(
				bad,
				'This docker run command in the guide publishes without a loopback host address. ' +
					`Use -p ${LOOPBACK_PUBLISH_HOSTS[0]}:${GUIDE_PUBLISHED_PORT}:80 so the command ` +
					'cannot put the app on a public interface.'
			).toEqual([]);
		}
	);
});
