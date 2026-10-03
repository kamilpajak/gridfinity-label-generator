/**
 * Drift guard between the app and the VPS deploy script.
 *
 * `scripts/deploy.sh` names every environment variable the container is started
 * with. A `PUBLIC_*` variable the app reads but the script does not know about would
 * simply be absent from the container, and nothing would fail loudly — that is how
 * `PUBLIC_ALLOWED_ORIGINS` stayed missing from the live deployment for three months
 * while `POST /api/shorten` answered 403 to the site's own origin.
 *
 * It also guards the committed template against shipping operator-specific values,
 * which a fork would otherwise copy unedited.
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

/** Without this the shortener rejects its own front end and every QR code stays long. */
const SHORTENER_ORIGIN_VAR = 'PUBLIC_ALLOWED_ORIGINS';

/** `true` on the public site would expose the internal `/e2e` comparison routes. */
const E2E_PAGES_VAR = 'PUBLIC_ALLOW_E2E_PAGES';

/** Shared, already-public values the template is allowed to commit. */
const SITE_ORIGIN_VAR = 'ORIGIN';

/**
 * Prefixes of variables that identify one operator. The committed template must
 * leave these empty, so a fork does not report to the maintainer's analytics or
 * publish the maintainer's contact details.
 */
const OPERATOR_SPECIFIC_PREFIXES = [
	'PUBLIC_MATOMO_',
	'PUBLIC_AFFILIATE_',
	'PUBLIC_AMAZON_',
	'PUBLIC_CONTACT_',
	'PUBLIC_PRIVACY_'
];

const SHELL_COMMENT_PATTERN = /#.*$/;
const ENV_ASSIGNMENT_PATTERN = /^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)=(.*)$/;
const SURROUNDING_QUOTES_PATTERN = /^(['"])(.*)\1$/;

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
		const refused = scriptArrayEntries(script, REFUSED_VARS_ARRAY);

		expect(refused).toContain(E2E_PAGES_VAR);
	});
});

describe('scripts/deploy.env.example', () => {
	const assignments = templateAssignments(readFileSync(ENV_TEMPLATE, 'utf8'));

	it('commits no operator-specific value', () => {
		const withValue = [...assignments]
			.filter(([name]) => OPERATOR_SPECIFIC_PREFIXES.some((prefix) => name.startsWith(prefix)))
			.filter(([, value]) => value !== '')
			.map(([name]) => name);

		expect(
			withValue,
			'The committed template must leave operator-specific values empty. A fork that ' +
				'copies it unedited would otherwise report to someone else’s analytics or ' +
				'publish someone else’s contact details.'
		).toEqual([]);
	});

	it('commits a shortener allowlist that covers the committed site origin', () => {
		const origin = assignments.get(SITE_ORIGIN_VAR) ?? '';
		const allowlist = assignments.get(SHORTENER_ORIGIN_VAR) ?? '';

		expect(origin).not.toBe('');
		expect(allowlist.split(',').map((entry) => entry.trim())).toContain(origin);
	});
});
