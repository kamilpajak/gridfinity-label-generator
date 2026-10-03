/**
 * Env Var Documentation Tests
 *
 * Guards against a deployment-only failure mode: code starts reading a new
 * `PUBLIC_*` env var, the operator never learns it exists, and the feature it
 * controls silently stops working in production while every unit test stays green.
 *
 * This happened with `PUBLIC_ALLOWED_ORIGINS` — the QR URL shortener returned 403
 * on the live site for three months because the deploy never set it, and the
 * endpoint's own tests mock the variable to a working value.
 *
 * The companion guard is `deploy-script-vars.test.ts`: this file keeps the docs
 * honest for a human, that one keeps `scripts/deploy.sh` honest for the machine.
 * Both scan the source tree through `public-env-var-scan.ts`.
 *
 * These tests read the real source tree and the real docs, and mock nothing.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT, findPublicEnvVarsReadBySource } from './public-env-var-scan';

const ENV_EXAMPLE = join(REPO_ROOT, '.env.example');
const DEPLOYMENT_GUIDE = join(REPO_ROOT, 'docs/guides/deployment.md');

/**
 * Without this variable the shortener rejects its own site with 403, so every
 * copy-paste container command in the guide — not just the reference table — has to
 * supply it.
 */
const SHORTENER_ORIGIN_VAR = 'PUBLIC_ALLOWED_ORIGINS';

/**
 * A `docker run` example satisfies the check either by naming the variable inline, as a
 * bare `-e PUBLIC_ALLOWED_ORIGINS` or an explicit `-e PUBLIC_ALLOWED_ORIGINS=...`, or by
 * reading an env file that carries it (`--env-file ...`). The copy-paste commands in the
 * guide use the bare form after reading the env file with `.`, because `docker run
 * --env-file` does not strip the quotes the file is written with.
 */
const ENV_FILE_FLAG = '--env-file';

function undocumentedIn(docPath: string): string[] {
	const doc = readFileSync(docPath, 'utf8');
	return [...findPublicEnvVarsReadBySource().keys()].filter((name) => !doc.includes(name)).sort();
}

describe('PUBLIC_* env var documentation', () => {
	it('finds the env vars the app reads', () => {
		const vars = findPublicEnvVarsReadBySource();

		// Sanity check on the scanner itself: a known variable must be picked up,
		// otherwise an empty result would make the assertions below vacuous.
		expect(vars.has(SHORTENER_ORIGIN_VAR)).toBe(true);
	});

	it('lists every env var the app reads in .env.example', () => {
		expect(undocumentedIn(ENV_EXAMPLE)).toEqual([]);
	});

	it('documents every env var the app reads in the deployment guide', () => {
		expect(undocumentedIn(DEPLOYMENT_GUIDE)).toEqual([]);
	});

	it('supplies the shortener origin allowlist in every docker run example', () => {
		const guide = readFileSync(DEPLOYMENT_GUIDE, 'utf8');

		const runExamples = guide.split('docker run').slice(1);
		const examplesWithVar = runExamples.filter(
			(example) => example.includes(SHORTENER_ORIGIN_VAR) || example.includes(ENV_FILE_FLAG)
		);

		expect(runExamples.length).toBeGreaterThan(0);
		expect(examplesWithVar).toHaveLength(runExamples.length);
	});
});
