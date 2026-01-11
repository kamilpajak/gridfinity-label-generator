/**
 * Integration tests for standards-validate.js
 *
 * Tests the validation script against standards config structure.
 * Run with: node --test scripts/standards-validate.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT_PATH = path.join(__dirname, 'standards-validate.js');
const CONFIG_PATH = path.join(__dirname, '..', 'data', 'standards-config.json');

/**
 * Helper to run the validation script
 * @param {string} configPath - Path to config file
 * @returns {{ exitCode: number, output: string }}
 */
function runValidator(configPath) {
	try {
		const output = execSync(`node ${SCRIPT_PATH} --config="${configPath}"`, {
			encoding: 'utf-8',
			stdio: ['pipe', 'pipe', 'pipe']
		});
		return { exitCode: 0, output };
	} catch (error) {
		return {
			exitCode: error.status || 1,
			output: error.stdout?.toString() || error.stderr?.toString() || ''
		};
	}
}

/**
 * Create a temporary config file for testing
 * @param {object} config - Config object
 * @returns {string} Path to temp file
 */
function createTempConfig(config) {
	const tempPath = path.join(__dirname, '..', 'data', `temp-test-config-${Date.now()}.json`);
	fs.writeFileSync(tempPath, JSON.stringify(config, null, '\t'));
	return tempPath;
}

/**
 * Remove temp config file
 * @param {string} tempPath
 */
function removeTempConfig(tempPath) {
	if (fs.existsSync(tempPath)) {
		fs.unlinkSync(tempPath);
	}
}

describe('standards-validate.js', () => {
	it('should pass for valid config with iso and din sections', () => {
		const config = {
			iso: { 4762: { din: ['912'] } },
			din: { 95: {} }
		};
		const tempPath = createTempConfig(config);

		try {
			const result = runValidator(tempPath);
			assert.strictEqual(
				result.exitCode,
				0,
				`Expected exit code 0, got ${result.exitCode}\n${result.output}`
			);
			assert.ok(result.output.includes('PASSED'), 'Output should include PASSED');
		} finally {
			removeTempConfig(tempPath);
		}
	});

	it('should pass for the actual standards-config.json file', () => {
		// Skip if file doesn't exist
		if (!fs.existsSync(CONFIG_PATH)) {
			console.log('Skipping: standards-config.json not found');
			return;
		}

		const result = runValidator(CONFIG_PATH);
		assert.strictEqual(
			result.exitCode,
			0,
			`Expected exit code 0, got ${result.exitCode}\n${result.output}`
		);
		assert.ok(result.output.includes('PASSED'), 'Output should include PASSED');
	});

	it('should fail for empty config', () => {
		const config = {};
		const tempPath = createTempConfig(config);

		try {
			const result = runValidator(tempPath);
			assert.strictEqual(result.exitCode, 1, 'Expected exit code 1 for empty config');
			assert.ok(result.output.includes('FAILED'), 'Output should include FAILED');
		} finally {
			removeTempConfig(tempPath);
		}
	});

	it('should fail for invalid standard number format', () => {
		const config = {
			iso: { iso4762: { din: ['912'] } } // Should be '4762', not 'iso4762'
		};
		const tempPath = createTempConfig(config);

		try {
			const result = runValidator(tempPath);
			assert.strictEqual(result.exitCode, 1, 'Expected exit code 1 for invalid key');
			assert.ok(result.output.includes('FAILED'), 'Output should include FAILED');
		} finally {
			removeTempConfig(tempPath);
		}
	});

	it('should fail for invalid DIN cross-ref code', () => {
		const config = {
			iso: { 4762: { din: ['abc'] } } // Should be numeric string
		};
		const tempPath = createTempConfig(config);

		try {
			const result = runValidator(tempPath);
			assert.strictEqual(result.exitCode, 1, 'Expected exit code 1 for invalid cross-ref');
			assert.ok(result.output.includes('FAILED'), 'Output should include FAILED');
		} finally {
			removeTempConfig(tempPath);
		}
	});

	it('should fail for invalid withdrawn value', () => {
		const config = {
			din: { 127: { withdrawn: 'yes' } } // Should be boolean
		};
		const tempPath = createTempConfig(config);

		try {
			const result = runValidator(tempPath);
			assert.strictEqual(result.exitCode, 1, 'Expected exit code 1 for invalid withdrawn');
			assert.ok(result.output.includes('FAILED'), 'Output should include FAILED');
		} finally {
			removeTempConfig(tempPath);
		}
	});

	it('should fail for invalid replacedBy reference', () => {
		const config = {
			din: { 7991: { withdrawn: true, replacedBy: 'iso99999' } } // Non-existent
		};
		const tempPath = createTempConfig(config);

		try {
			const result = runValidator(tempPath);
			assert.strictEqual(result.exitCode, 1, 'Expected exit code 1 for invalid replacedBy');
			assert.ok(result.output.includes('FAILED'), 'Output should include FAILED');
		} finally {
			removeTempConfig(tempPath);
		}
	});

	it('should pass with valid withdrawn and replacedBy', () => {
		const config = {
			iso: { 10642: {} },
			din: { 7991: { withdrawn: true, replacedBy: 'iso10642' } }
		};
		const tempPath = createTempConfig(config);

		try {
			const result = runValidator(tempPath);
			assert.strictEqual(
				result.exitCode,
				0,
				`Expected exit code 0, got ${result.exitCode}\n${result.output}`
			);
		} finally {
			removeTempConfig(tempPath);
		}
	});
});
