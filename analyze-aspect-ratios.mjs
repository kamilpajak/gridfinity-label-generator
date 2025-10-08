#!/usr/bin/env node
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import sizeOf from 'image-size';

const IMAGES_DIR = './static/images/standards';

// Parse command-line arguments for target aspect ratios
const targetARs = process.argv
	.slice(2)
	.map((arg) => parseFloat(arg))
	.filter((n) => !isNaN(n));

async function analyzeImages() {
	const files = await readdir(IMAGES_DIR);
	const imageFiles = files.filter((f) => /\.(jpg|jpeg|png|svg|webp)$/i.test(f));

	const results = [];

	for (const file of imageFiles) {
		const path = join(IMAGES_DIR, file);
		try {
			const buffer = await readFile(path);
			const dimensions = sizeOf(buffer);
			const aspectRatio = dimensions.width / dimensions.height;

			results.push({
				file,
				width: dimensions.width,
				height: dimensions.height,
				aspectRatio: aspectRatio.toFixed(2),
				aspectRatioRaw: aspectRatio
			});
		} catch (error) {
			console.error(`Error processing ${file}:`, error.message);
		}
	}

	// Sort by aspect ratio
	results.sort((a, b) => a.aspectRatioRaw - b.aspectRatioRaw);

	console.log(`\n📊 Analyzed ${results.length} images\n`);

	// Show 5 narrowest (lowest aspect ratio)
	console.log('🔽 5 NARROWEST (lowest aspect ratio - tallest):');
	results.slice(0, 5).forEach((img, i) => {
		console.log(`${i + 1}. ${img.file.padEnd(25)} ${img.width}x${img.height} → ${img.aspectRatio}`);
	});

	console.log('\n🔼 5 WIDEST (highest aspect ratio - longest):');
	results
		.slice(-5)
		.reverse()
		.forEach((img, i) => {
			console.log(
				`${i + 1}. ${img.file.padEnd(25)} ${img.width}x${img.height} → ${img.aspectRatio}`
			);
		});

	// Find most square images (closest to 1.0)
	const squareResults = [...results]
		.map((r) => ({
			...r,
			distanceFrom1: Math.abs(r.aspectRatioRaw - 1.0)
		}))
		.sort((a, b) => a.distanceFrom1 - b.distanceFrom1);

	console.log('\n🟦 5 MOST SQUARE (closest to 1:1):');
	squareResults.slice(0, 5).forEach((img, i) => {
		console.log(`${i + 1}. ${img.file.padEnd(25)} ${img.width}x${img.height} → ${img.aspectRatio}`);
	});

	// Statistics
	const aspectRatios = results.map((r) => r.aspectRatioRaw);
	const min = Math.min(...aspectRatios);
	const max = Math.max(...aspectRatios);
	const avg = aspectRatios.reduce((a, b) => a + b, 0) / aspectRatios.length;

	console.log('\n📈 Statistics:');
	console.log(`   Min aspect ratio: ${min.toFixed(2)}`);
	console.log(`   Max aspect ratio: ${max.toFixed(2)}`);
	console.log(`   Average: ${avg.toFixed(2)}`);
	console.log(`   Range: ${(max - min).toFixed(2)}`);
	console.log(`   Most square: ${squareResults[0].file} (${squareResults[0].aspectRatio})`);

	// Search for target aspect ratios if provided
	if (targetARs.length > 0) {
		console.log('\n🎯 TARGET ASPECT RATIO SEARCH:\n');

		for (const target of targetARs) {
			// Find images closest to target
			const targetResults = [...results]
				.map((r) => ({
					...r,
					distanceFromTarget: Math.abs(r.aspectRatioRaw - target)
				}))
				.sort((a, b) => a.distanceFromTarget - b.distanceFromTarget);

			console.log(`Target: ${target.toFixed(2)}`);
			console.log(`   Closest matches:`);
			targetResults.slice(0, 5).forEach((img, i) => {
				const diff = (img.aspectRatioRaw - target).toFixed(2);
				const sign = diff >= 0 ? '+' : '';
				console.log(
					`   ${i + 1}. ${img.file.padEnd(25)} ${img.width}x${img.height} → ${img.aspectRatio} (${sign}${diff})`
				);
			});
			console.log('');
		}
	}
}

analyzeImages().catch(console.error);
