/**
 * Repoints `image` fields in src/lib/data/standards-generated.ts at the
 * generated catalog SVGs, for every shipped standard whose id is a key in
 * catalog/out/manifest.json.
 *
 * This is the "surgical" update prescribed by catalog/README.md — running
 * `pnpm standards:build` is NOT an alternative because it requires the
 * git-ignored data/dinmedia-*.json cache and produces a lossy dataset.
 *
 * Usage: node scripts/catalog-repoint-standards.mjs
 * Rerun after each catalog basket is integrated (catalog/integrate.py).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const manifestPath = resolve(root, 'catalog/out/manifest.json');
const generatedPath = resolve(root, 'src/lib/data/standards-generated.ts');

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')).standards;
let source = readFileSync(generatedPath, 'utf8');

let repointed = 0;
let inserted = 0;

for (const [id, meta] of Object.entries(manifest)) {
	const idMarker = `\n\t\tid: '${id}',`;
	const start = source.indexOf(idMarker);
	if (start === -1) continue; // not a shipped standard

	// Entry blocks close at "\n\t}"; nested objects are indented deeper.
	const end = source.indexOf('\n\t}', start);
	if (end === -1) {
		throw new Error(`unterminated entry block for ${id}`);
	}

	const block = source.slice(start, end);
	const image = `/images/standards/${meta.svg}`;
	let next;
	if (/image: '[^']*'/.test(block)) {
		if (block.includes(`image: '${image}'`)) continue; // already current
		next = block.replace(/image: '[^']*'/, `image: '${image}'`);
		repointed++;
	} else {
		next = `${block},\n\t\timage: '${image}'`;
		inserted++;
	}
	source = source.slice(0, start) + next + source.slice(end);
}

const withImages = (source.match(/image: '/g) ?? []).length;
source = source.replace(
	/^ \* Standards with images: \d+$/m,
	` * Standards with images: ${withImages}`
);

writeFileSync(generatedPath, source);
console.log(`repointed ${repointed}, inserted ${inserted}, total with images ${withImages}`);
