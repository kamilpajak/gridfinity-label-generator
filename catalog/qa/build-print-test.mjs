/**
 * Compose the pen-weight variants into one 360 dpi strip for a label printer.
 *
 * The strip is 12mm tall, the app's default tape, and every drawing sits in an
 * 11.4 x 10mm box fitted contain-style — exactly the slot
 * `calculateOptimalImageSize()` hands a drawing on a 35mm label with no QR code.
 * So what comes out of the printer is the real reproduction size, not a preview.
 *
 * Each weight group is introduced by a run of solid bars: one bar for the
 * thinnest variant, five for the thickest. Bars, not printed digits, because a
 * digit small enough to fit beside a 10mm drawing is exactly the thing under
 * test — if the pen is too thin to read, so is its own caption.
 *
 * Run after catalog/qa/print_test_variants.py:
 *     node catalog/qa/build-print-test.mjs
 */
import { chromium } from 'playwright';
import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = 'catalog/out/print-test';
const OUT = 'catalog/out/print-test/print-test-360dpi.png';

// Everything below is expressed in printer dots, with one CSS pixel standing for
// one dot, so the screenshot needs no rescaling. Laying the page out in CSS `mm`
// instead loses the tape height: 12mm is 45.35 CSS px, the viewport has to be a
// whole number, and the 12mm tape comes back 12.2mm tall.
const DPI = 360;
const DOTS_PER_MM = DPI / 25.4;
const mm = (v) => v * DOTS_PER_MM;

// The image IS the printable area, with no white border of its own: the printer
// adds the tape margin itself, and a margin baked into the PNG would be added on
// top of that, shrinking every drawing below the size under test.
const SLOT_W_MM = 11.4; // what the app gives a drawing on a 35mm label
const SLOT_H_MM = 10; // printable height on 12mm tape, and the image height
const CELL_GAP_MM = 1.2;
const GROUP_GAP_MM = 3;
const BAR_W_MM = 0.7;
const BAR_H_MM = 4;
const BAR_GAP_MM = 0.6;

// Which of the rendered variants actually reach the tape. Everything the Python
// step produced stays on disk, so widening this costs no re-render.
//
// The 1.0-dot variant is left out: thin is the failure being walked away from,
// so testing thinner than today only confirms a direction already known.
const USE_FACTORS = [1.0, 1.33, 1.67, 2.0];
const USE_STANDARDS = ['din125', 'din127', 'din316', 'din7991', 'din936'];

const index = JSON.parse(readFileSync(join(SRC, 'index.json'), 'utf8'));
const factors = index.factors.filter((f) => USE_FACTORS.includes(f.factor));
const standards = index.standards.filter((s) => USE_STANDARDS.includes(s));

if (factors.length !== USE_FACTORS.length || standards.length !== USE_STANDARDS.length) {
	throw new Error(
		`index.json does not hold every requested variant: ` +
			`factors ${factors.length}/${USE_FACTORS.length}, ` +
			`standards ${standards.length}/${USE_STANDARDS.length}`
	);
}

/** Fit a drawing into the slot the same way the app does: contain, centred. */
function fitted(svgText) {
	const [, , w, h] = svgText
		.match(/viewBox="([^"]+)"/)[1]
		.trim()
		.split(/\s+/)
		.map(Number);
	const scale = Math.min(SLOT_W_MM / w, SLOT_H_MM / h);
	return { width: w * scale, height: h * scale };
}

let bodyWidthMm = 0;
const groups = [];

for (const [i, f] of factors.entries()) {
	const bars = i + 1;
	const last = i === factors.length - 1;
	// One GROUP_GAP after the bars, one after the group — except the final group,
	// which ends flush with the image edge so the PNG carries no trailing white.
	let groupWidth =
		bars * BAR_W_MM + (bars - 1) * BAR_GAP_MM + GROUP_GAP_MM + (last ? 0 : GROUP_GAP_MM);
	const cells = [];
	for (const [j, sid] of standards.entries()) {
		const svgText = readFileSync(join(SRC, `${sid}__${f.tag}.svg`), 'utf8');
		const box = fitted(svgText);
		// Strip the outer width/height so CSS sizing wins; keep the viewBox.
		const inline = svgText
			.replace(/<svg([^>]*?)width="[^"]*"/, '<svg$1')
			.replace(/<svg([^>]*?)height="[^"]*"/, '<svg$1');
		cells.push({ inline, ...box });
		groupWidth += SLOT_W_MM + (j === standards.length - 1 ? 0 : CELL_GAP_MM);
	}
	groups.push({ bars, cells, dots: f.visible_dots });
	bodyWidthMm += groupWidth;
}

const widthDots = Math.round(mm(bodyWidthMm));
const heightDots = Math.round(mm(SLOT_H_MM));

const html = `<style>
  html, body { margin: 0; padding: 0; background: #fff }
  body {
    width: ${widthDots}px;
    height: ${heightDots}px;
    display: flex;
    align-items: center;
    box-sizing: border-box;
  }
  .group { display: flex; align-items: center; margin-right: ${mm(GROUP_GAP_MM)}px }
  .group:last-child { margin-right: 0 }
  .bars { display: flex; align-items: center; margin-right: ${mm(GROUP_GAP_MM)}px }
  .bar {
    width: ${mm(BAR_W_MM)}px;
    height: ${mm(BAR_H_MM)}px;
    background: #000;
    margin-right: ${mm(BAR_GAP_MM)}px;
  }
  .bar:last-child { margin-right: 0 }
  .cell {
    width: ${mm(SLOT_W_MM)}px;
    height: ${mm(SLOT_H_MM)}px;
    margin-right: ${mm(CELL_GAP_MM)}px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .cell:last-child { margin-right: 0 }
  .cell svg { display: block }
</style>
<body>
${groups
	.map(
		(g) => `<div class="group">
  <div class="bars">${'<div class="bar"></div>'.repeat(g.bars)}</div>
  ${g.cells
		.map(
			(c) =>
				`<div class="cell"><div style="width:${mm(c.width)}px;height:${mm(c.height)}px">${c.inline}</div></div>`
		)
		.join('\n  ')}
</div>`
	)
	.join('\n')}
</body>`;

const browser = await chromium.launch();
const page = await browser.newPage({
	viewport: { width: widthDots, height: heightDots },
	deviceScaleFactor: 1
});
await page.setContent(html);
const shot = await page.screenshot({ omitBackground: false });
await browser.close();

// The layout ends flush, but a drawing whose aspect makes it height-bound sits
// narrower than the 11.4mm cell, which would leave a white column at the right
// edge. Crop to the ink so the image starts and ends on a printed dot.
//
// Columns only: the 10mm height is the app's slot, not padding, and a drawing
// that does not fill it vertically is showing its own proportions.
const { data, info } = await sharp(shot).raw().toBuffer({ resolveWithObject: true });
let inkLeft = info.width;
let inkRight = -1;
for (let y = 0; y < info.height; y++) {
	for (let x = 0; x < info.width; x++) {
		if (data[(y * info.width + x) * info.channels] !== 255) {
			if (x < inkLeft) inkLeft = x;
			if (x > inkRight) inkRight = x;
		}
	}
}
if (inkRight < inkLeft) throw new Error('composed strip is blank');

// Stamp the real resolution, so a print dialog places the strip at 1:1 instead
// of assuming the PNG default of 72 dpi and blowing it up five times.
await sharp(shot)
	.extract({ left: inkLeft, top: 0, width: inkRight - inkLeft + 1, height: info.height })
	.withMetadata({ density: DPI })
	.toFile(OUT);

writeFileSync(join(SRC, 'print-test.html'), html, 'utf8');

const meta = await sharp(OUT).metadata();
console.log(
	JSON.stringify(
		{
			out: OUT,
			dpi: meta.density,
			png_px: { width: meta.width, height: meta.height },
			png_mm: {
				width: Number(((meta.width / DPI) * 25.4).toFixed(1)),
				height: Number(((meta.height / DPI) * 25.4).toFixed(1))
			},
			trimmed_dots: { left: inkLeft, right: info.width - 1 - inkRight },
			groups: groups.map((g) => ({ bars: g.bars, visible_dots: g.dots }))
		},
		null,
		2
	)
);
