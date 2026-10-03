/**
 * Drift guard between the app, the VPS deploy script and the committed env template.
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
 *   actually does with them, and against the template.
 * - The template was checked against five hardcoded operator-specific prefixes, so a
 *   future `PUBLIC_SENTRY_DSN` with a real key in it would have been committed to a
 *   public repository with CI green. The rule is now that every value in the template
 *   is empty, which needs no maintenance when a variable is added.
 *
 * These tests read the script and the template as text. They do not run them.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT, listPublicEnvVarsReadBySource } from './public-env-var-scan';

const DEPLOY_SCRIPT = join(REPO_ROOT, 'scripts/deploy.sh');
const ENV_TEMPLATE = join(REPO_ROOT, 'scripts/deploy.env.example');

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
const ENV_ASSIGNMENT_PATTERN = /^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)=(.*)$/;
const SURROUNDING_QUOTES_PATTERN = /^(['"])(.*)\1$/;
const SHELL_VAR_NAME_PATTERN = /^[A-Z][A-Z0-9_]*$/;
/** `readonly NAME="literal"` at the top of the script. */
const SCRIPT_CONSTANT_PATTERN = /^readonly ([A-Z][A-Z0-9_]*)="([^"$]*)"$/gm;
/** `-e "NAME=..."` inside the argv builder. `NAME` may be a `${CONSTANT}`. */
const RUN_ARG_ENV_PATTERN = /-e "([^"=]+)=/g;
/** `${ARRAY[@]}` — how the builder iterates one of the variable arrays. */
const arrayExpansion = (arrayName: string) => `\${${arrayName}[@]}`;

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

/** `NAME="value"` assignments in the committed template, keyed by name. */
function templateAssignments(template: string): Map<string, string> {
	const assignments = new Map<string, string>();
	for (const line of template.split('\n')) {
		const match = ENV_ASSIGNMENT_PATTERN.exec(line);
		if (!match) continue;
		const [, name, rawValue] = match;
		const unquoted = SURROUNDING_QUOTES_PATTERN.exec(rawValue.trim());
		assignments.set(name, (unquoted ? unquoted[2] : rawValue).trim());
	}
	return assignments;
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

describe('scripts/deploy.env.example', () => {
	const script = readFileSync(DEPLOY_SCRIPT, 'utf8');
	const assignments = templateAssignments(readFileSync(ENV_TEMPLATE, 'utf8'));

	it('commits no value at all', () => {
		// A rule, not a list of operator-specific prefixes: the next variable anyone adds
		// is covered without touching this test. A real Matomo id, affiliate tag, contact
		// address or API key in the template would be published in a public repository,
		// and a fork copying the template unedited would inherit it.
		const withValue = [...assignments]
			.filter(([, value]) => value !== '')
			.map(([name, value]) => `${name}=${value}`);

		expect(
			withValue,
			'Every value in the committed template must be empty. Show an example in a ' +
				'comment above the assignment instead. A committed value is published in a ' +
				'public repository, and a fork that copies the template unedited inherits it.'
		).toEqual([]);
	});

	it('leaves the operator to name the domain this host serves', () => {
		// Deliberately empty rather than pre-filled with gridfinitylabels.com. Every check
		// in deploy.sh is internal — it compares ORIGIN against the committed allowlist and
		// probes the container with those same committed values — so a fork that changed
		// neither would pass every check and still 403 its own front end. Empty makes the
		// required-variable check force a decision.
		for (const name of [SITE_ORIGIN_VAR, SHORTENER_ORIGIN_VAR]) {
			expect(assignments.has(name), `${name} must be present in the template`).toBe(true);
			expect(assignments.get(name)).toBe('');
		}
	});

	it('assigns every variable the deploy passes to the container', () => {
		const passedVars = PASSED_VAR_ARRAYS.flatMap((name) => scriptArrayEntries(script, name));

		const unassigned = passedVars.filter((name) => !assignments.has(name));

		expect(
			unassigned,
			'These variables are passed to the container by scripts/deploy.sh but are not ' +
				'assigned in scripts/deploy.env.example, so the operator never learns they exist ' +
				'and the host env file stays behind.'
		).toEqual([]);
	});

	it('does not assign a refused variable', () => {
		const refused = scriptArrayEntries(script, REFUSED_VARS_ARRAY);

		const assigned = refused.filter((name) => assignments.has(name));

		expect(
			assigned,
			'These variables are in REFUSED_VARS, so scripts/deploy.sh refuses to deploy when ' +
				'they are set. The template must describe them in a comment, not assign them.'
		).toEqual([]);
	});
});
