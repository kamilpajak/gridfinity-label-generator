#!/usr/bin/env npx tsx
/**
 * Combines two SVG views (back + left) into a single SVG.
 *
 * Usage:
 *   npx tsx scripts/combine-svg-views.ts <back.svg> <left.svg> <output.svg>
 *
 * Example:
 *   npx tsx scripts/combine-svg-views.ts back.svg left.svg combined.svg
 */

import { readFileSync, writeFileSync } from 'fs';
import { basename } from 'path';

const GAP = 2; // Gap between views (in SVG units)

interface ViewBox {
	x: number;
	y: number;
	width: number;
	height: number;
}

function parseViewBox(svg: string): ViewBox {
	const match = svg.match(/viewBox="([^"]+)"/);
	if (!match) throw new Error('No viewBox found');
	const [x, y, width, height] = match[1].split(/\s+/).map(Number);
	return { x, y, width, height };
}

function extractContent(svg: string): string {
	// Remove XML declaration and outer SVG tags, keep inner content
	const content = svg
		.replace(/<\?xml[^?]*\?>\s*/g, '')
		.replace(/<svg[^>]*>/g, '')
		.replace(/<\/svg>\s*/g, '');
	return content.trim();
}

function fixClipPathIds(content: string, suffix: string): string {
	// Make clipPath IDs unique to avoid conflicts
	return content
		.replace(/id="clipId(\d+)"/g, `id="clipId$1_${suffix}"`)
		.replace(/url\(#clipId(\d+)\)/g, `url(#clipId$1_${suffix})`);
}

function combineSvgs(backPath: string, leftPath: string, outputPath: string): void {
	const backSvg = readFileSync(backPath, 'utf-8');
	const leftSvg = readFileSync(leftPath, 'utf-8');

	const backBox = parseViewBox(backSvg);
	const leftBox = parseViewBox(leftSvg);

	// Scale left view to match back view height
	const scale = backBox.height / leftBox.height;
	const scaledLeftWidth = leftBox.width * scale;
	const scaledLeftHeight = leftBox.height * scale;

	// Calculate combined dimensions
	const totalWidth = backBox.width + GAP + scaledLeftWidth;
	const totalHeight = backBox.height;

	// Extract and fix content
	const backContent = fixClipPathIds(extractContent(backSvg), 'back');
	const leftContent = fixClipPathIds(extractContent(leftSvg), 'left');

	// Position for left view (after back view + gap)
	const leftX = backBox.width + GAP;

	const combined = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 ${totalWidth.toFixed(2)} ${totalHeight.toFixed(2)}"
     xmlns="http://www.w3.org/2000/svg"
     stroke-linecap="round"
     stroke-linejoin="round"
     fill-rule="evenodd">
  <!-- Back view (side) -->
  <g transform="translate(${-backBox.x}, ${-backBox.y})">
    ${backContent}
  </g>

  <!-- Left view (head) -->
  <g transform="translate(${leftX}, 0) scale(${scale.toFixed(4)}) translate(${-leftBox.x}, ${-leftBox.y})">
    ${leftContent}
  </g>
</svg>`;

	writeFileSync(outputPath, combined);
	console.log(`Combined: ${basename(backPath)} + ${basename(leftPath)} → ${basename(outputPath)}`);
	console.log(`  Back: ${backBox.width}×${backBox.height}`);
	console.log(
		`  Left:  ${leftBox.width}×${leftBox.height} (scaled to ${scaledLeftWidth.toFixed(1)}×${scaledLeftHeight.toFixed(1)})`
	);
	console.log(`  Output: ${totalWidth.toFixed(1)}×${totalHeight.toFixed(1)}`);
}

// CLI
const args = process.argv.slice(2);
if (args.length < 3) {
	console.error('Usage: npx tsx combine-svg-views.ts <back.svg> <left.svg> <output.svg>');
	process.exit(1);
}

combineSvgs(args[0], args[1], args[2]);
