/**
 * Shared scanner for the `PUBLIC_*` environment variables the shipped app reads.
 *
 * Test support only — nothing in the running application imports this module. It
 * exists so the two deployment drift guards share one implementation:
 *
 * - `env-documentation.test.ts` — every variable is documented for a human.
 * - `deploy-script-vars.test.ts` — every variable is passed by the deploy script.
 *
 * Two filters keep a documentation glob such as `PUBLIC_AFFILIATE_*` from being
 * mistaken for a real variable. Comments are stripped before matching, and a name
 * ending in an underscore is dropped. Either one handles today's glob on its own;
 * together they survive a future comment that writes a glob differently, for
 * example `PUBLIC_AFFILIATE_XX`.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

/** Repository root, resolved from this module rather than from `process.cwd()`. */
export const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

const SRC_DIR = join(REPO_ROOT, 'src');

const SOURCE_FILE_PATTERN = /\.(ts|js|svelte)$/;
const TEST_FILE_PATTERN = /\.(test|spec)\.(ts|js)$/;

/**
 * Deliberately permissive: it also matches a trailing underscore, which the
 * trailing-underscore filter below then drops. A stricter pattern would make that
 * filter dead code and hide a malformed name instead of reporting it.
 */
const ENV_VAR_PATTERN = /PUBLIC_[A-Z0-9_]+/g;

const BLOCK_COMMENT_PATTERN = /\/\*[\s\S]*?\*\//g;
const LINE_COMMENT_PATTERN = /(^|[^:])\/\/[^\n]*/g;

/** Every non-test source file under `src/`, recursively. */
function listSourceFiles(dir: string, found: string[] = []): string[] {
	for (const entry of readdirSync(dir)) {
		const path = join(dir, entry);
		if (statSync(path).isDirectory()) {
			listSourceFiles(path, found);
		} else if (SOURCE_FILE_PATTERN.test(path) && !TEST_FILE_PATTERN.test(path)) {
			found.push(path);
		}
	}
	return found;
}

/** Strips comments so a variable mentioned only in a doc comment does not count as read. */
export function stripComments(source: string): string {
	return source.replace(BLOCK_COMMENT_PATTERN, '').replace(LINE_COMMENT_PATTERN, '$1');
}

/**
 * Every `PUBLIC_*` variable the shipped app reads, mapped to the first file that
 * reads it. Test files are skipped: they mock these variables to working values,
 * which is exactly why a missing one never fails CI.
 */
export function findPublicEnvVarsReadBySource(): Map<string, string> {
	const vars = new Map<string, string>();
	for (const file of listSourceFiles(SRC_DIR)) {
		const code = stripComments(readFileSync(file, 'utf8'));
		for (const match of code.matchAll(ENV_VAR_PATTERN)) {
			const name = match[0];
			if (!name.endsWith('_') && !vars.has(name)) {
				vars.set(name, file);
			}
		}
	}
	return vars;
}

/** Sorted names only, for assertions that do not care where a variable is read. */
export function listPublicEnvVarsReadBySource(): string[] {
	return [...findPublicEnvVarsReadBySource().keys()].sort((a, b) => a.localeCompare(b));
}
