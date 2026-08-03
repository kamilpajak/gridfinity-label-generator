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
const mappingsPath = resolve(root, 'data/image-mappings.json');

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')).standards;
let source = readFileSync(generatedPath, 'utf8');

// The edits below rely on the generator's exact formatting (tab indentation,
// single quotes, entries closed by "\n\t}"). Bail out loudly if it changed.
if (
	!source.includes('GENERATED FILE - DO NOT EDIT') ||
	!/\n\t\{\n\t\tid: '/.test(source) ||
	!/ as HardwareType[,\n]/.test(source)
) {
	throw new Error('standards-generated.ts format changed — update this script before rerunning');
}

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

// Pass 2: standards with no manifest key of their own, whose legacy png already
// showed another standard's drawing. Swapping that png for the vectorization of
// the SAME raster is a like-for-like upgrade — it does not introduce a claim the
// dataset was not already making.
//
// The list is explicit on purpose. Matching by filename instead let any png whose
// name happened to collide with a manifest key be bridged automatically, which is
// how two approximations below were picked up without anyone deciding to. Adding
// an entry here is a per-key decision, the same review the remaining unmapped
// keys still await.
const BRIDGES = {
	// Exact: fine pitch only, and pitch is not drawn.
	iso12474: 'din_912.png',
	// Approximations inherited from the legacy dataset, not introduced here. Each
	// keeps whatever the raster already showed; a correct drawing would need its
	// own catalog entry.
	din562: 'din_557.png', // thin square nut drawn at DIN 557 full height
	iso14583: 'din_7985.png', // hexalobular drive drawn as a cross recess
	iso7090: 'din_125.png', // chamfered washer drawn as the unchamfered form
	iso8678: 'din_603.png', // small-head cup square-neck bolt drawn at normal head
	iso4162: 'din_6921.png', // small-series flange bolt drawn at the normal flange
	iso15071: 'din_6921.png',
	iso15072: 'din_6921.png'
};

let bridged = 0;
const bridgedImages = {};
for (const [id, legacyPng] of Object.entries(BRIDGES)) {
	const meta = manifest[legacyPng.replace('.png', '').replaceAll('_', '')];
	if (!meta) throw new Error(`bridge ${id}: ${legacyPng} has no matching drawing`);
	const marker = `\n\t\tid: '${id}',`;
	const start = source.indexOf(marker);
	if (start === -1) continue; // not a shipped standard
	const end = source.indexOf('\n\t}', start);
	const block = source.slice(start, end);
	const image = `/images/standards/${meta.svg}`;
	// Record it either way: on a rerun the dataset is already bridged, but the
	// mappings still have to be checked against it.
	bridgedImages[id] = image;
	if (block.includes(`image: '${image}'`)) continue;
	if (!block.includes(`image: '/images/standards/${legacyPng}'`)) {
		throw new Error(`bridge ${id}: expected it to still show ${legacyPng}`);
	}
	source =
		source.slice(0, start) +
		block.replace(/image: '[^']*'/, `image: '${image}'`) +
		source.slice(end);
	bridged++;
}

const withImages = (source.match(/image: '/g) ?? []).length;
source = source.replace(
	/^ \* Standards with images: \d+$/m,
	` * Standards with images: ${withImages}`
);

writeFileSync(generatedPath, source);

// integrate.py owns image-mappings.json but never sees the bridges, since those
// ids are not manifest keys. Left alone the two files disagree, and regenerating
// the dataset from the mappings would silently undo every bridge.
const mappings = JSON.parse(readFileSync(mappingsPath, 'utf8'));
let mappingsChanged = 0;
for (const [id, image] of Object.entries(bridgedImages)) {
	if (mappings[id] && mappings[id].image !== image) {
		mappings[id].image = image;
		mappingsChanged++;
	}
}
if (mappingsChanged) {
	writeFileSync(mappingsPath, JSON.stringify(mappings, null, '\t') + '\n');
}

// Nothing else keeps the two in step, so check rather than trust.
const shipped = [...source.matchAll(/id: '([^']+)',[\s\S]*?(?=\n\t\})/g)].flatMap((m) => {
	const image = /image: '([^']+)'/.exec(m[0]);
	return image ? [[m[1], image[1]]] : [];
});
const disagreements = shipped.filter(([id, image]) => mappings[id] && mappings[id].image !== image);
if (disagreements.length) {
	throw new Error(
		`image-mappings.json disagrees with standards-generated.ts for: ${disagreements
			.map(([id]) => id)
			.join(', ')}`
	);
}

console.log(
	`repointed ${repointed}, inserted ${inserted}, bridged ${bridged} ` +
		`(${mappingsChanged} written back to image-mappings.json), total with images ${withImages}`
);
