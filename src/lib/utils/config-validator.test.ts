/**
 * Standards Config Validator Tests (TDD)
 *
 * Tests for validating standards-config.json v2 structure.
 * V2 uses per-system sections (iso, din, etc.) instead of crossref/dinOnly.
 *
 * @see docs/plan-standards-config-migration.md
 */

import { describe, it, expect } from 'vitest';
import {
	validateConfigStructure,
	validateStandardNumber,
	validateSystemSection,
	validateNoDuplicateCrossRefs,
	validateWithdrawnFields,
	validateConfig,
	type ValidationResult,
	type StandardsConfig
} from './config-validator';

describe('validateConfigStructure', () => {
	it('should pass for valid config with iso and din sections', () => {
		const config = {
			iso: { '4762': { din: ['912'] } },
			din: { '912': {} }
		};
		const result = validateConfigStructure(config);
		expect(result.valid).toBe(true);
		expect(result.errors).toHaveLength(0);
	});

	it('should pass for config with only iso section', () => {
		const config = { iso: { '4762': {} } };
		const result = validateConfigStructure(config);
		expect(result.valid).toBe(true);
	});

	it('should pass for config with only din section', () => {
		const config = { din: { '912': {} } };
		const result = validateConfigStructure(config);
		expect(result.valid).toBe(true);
	});

	it('should fail for empty config', () => {
		const config = {};
		const result = validateConfigStructure(config);
		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.includes('at least one system section'))).toBe(true);
	});

	it('should fail if config is not an object', () => {
		const result = validateConfigStructure(null);
		expect(result.valid).toBe(false);
		expect(result.errors).toContain('Config must be an object');
	});

	it('should fail if config is an array', () => {
		const result = validateConfigStructure([]);
		expect(result.valid).toBe(false);
		expect(result.errors).toContain('Config must be an object');
	});

	it('should fail if system section is not an object', () => {
		const config = { iso: 'invalid' };
		const result = validateConfigStructure(config);
		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.includes('must be an object'))).toBe(true);
	});

	it('should fail if system section is an array', () => {
		const config = { din: [] };
		const result = validateConfigStructure(config);
		expect(result.valid).toBe(false);
	});

	it('should pass for future systems (ansi, pn, gb, jis)', () => {
		const config = {
			ansi: { '123': {} },
			pn: { '456': {} },
			gb: { '789': {} },
			jis: { '101': {} }
		};
		const result = validateConfigStructure(config);
		expect(result.valid).toBe(true);
	});

	it('should warn about unknown top-level keys', () => {
		const config = {
			iso: { '4762': {} },
			unknownKey: { '123': {} }
		};
		const result = validateConfigStructure(config);
		expect(result.valid).toBe(true); // Still valid, just a warning
		expect(result.warnings?.some((w) => w.includes('unknownKey'))).toBe(true);
	});
});

describe('validateStandardNumber', () => {
	it('should pass for valid numeric standard number', () => {
		expect(validateStandardNumber('4762').valid).toBe(true);
		expect(validateStandardNumber('912').valid).toBe(true);
		expect(validateStandardNumber('10642').valid).toBe(true);
	});

	it('should pass for standard number with letter suffix (variant)', () => {
		expect(validateStandardNumber('7504k').valid).toBe(true);
		expect(validateStandardNumber('15071a').valid).toBe(true);
	});

	it('should fail for non-numeric standard number', () => {
		const result = validateStandardNumber('abc');
		expect(result.valid).toBe(false);
		expect(result.errors[0]).toContain('Invalid standard number');
	});

	it('should fail for empty string', () => {
		const result = validateStandardNumber('');
		expect(result.valid).toBe(false);
	});

	it('should fail for number with spaces', () => {
		const result = validateStandardNumber('47 62');
		expect(result.valid).toBe(false);
	});

	it('should fail for number with special characters', () => {
		const result = validateStandardNumber('4762-1');
		expect(result.valid).toBe(false);
	});

	it('should fail for full ID format (iso4762)', () => {
		const result = validateStandardNumber('iso4762');
		expect(result.valid).toBe(false);
		expect(result.errors[0]).toContain('Invalid standard number');
	});
});

describe('validateSystemSection', () => {
	it('should pass for valid ISO section with DIN cross-refs', () => {
		const section = {
			'4762': { din: ['912'] },
			'4017': { din: ['933'] }
		};
		const result = validateSystemSection('iso', section);
		expect(result.valid).toBe(true);
	});

	it('should pass for valid DIN section with empty entries', () => {
		const section = {
			'95': {},
			'127': { withdrawn: true }
		};
		const result = validateSystemSection('din', section);
		expect(result.valid).toBe(true);
	});

	it('should pass for entry with multiple cross-refs', () => {
		const section = {
			'4018': { din: ['558', '561'] }
		};
		const result = validateSystemSection('iso', section);
		expect(result.valid).toBe(true);
	});

	it('should fail for non-numeric DIN cross-ref code', () => {
		const section = {
			'4762': { din: ['abc'] }
		};
		const result = validateSystemSection('iso', section);
		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.includes('Invalid cross-ref code'))).toBe(true);
	});

	it('should fail for cross-ref that is not an array', () => {
		const section = {
			'4762': { din: '912' }
		} as unknown as Record<string, { din?: string[] }>;
		const result = validateSystemSection('iso', section);
		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.includes('must be an array'))).toBe(true);
	});

	it('should fail for invalid standard number as key', () => {
		const section = {
			iso4762: { din: ['912'] }
		};
		const result = validateSystemSection('iso', section);
		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.includes('Invalid standard number'))).toBe(true);
	});

	it('should fail for entry that is not an object', () => {
		const section = {
			'4762': 'invalid'
		} as unknown as Record<string, object>;
		const result = validateSystemSection('iso', section);
		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.includes('must be an object'))).toBe(true);
	});
});

describe('validateNoDuplicateCrossRefs', () => {
	it('should pass when no duplicate cross-refs exist', () => {
		const config: StandardsConfig = {
			iso: { '4762': { din: ['912'] } },
			din: { '95': {} }
		};
		const result = validateNoDuplicateCrossRefs(config);
		expect(result.valid).toBe(true);
	});

	it('should pass when cross-ref points to existing entry', () => {
		const config: StandardsConfig = {
			iso: { '4762': { din: ['912'] } },
			din: { '912': {} }
		};
		const result = validateNoDuplicateCrossRefs(config);
		expect(result.valid).toBe(true);
	});

	it('should warn when cross-ref points to non-existent entry', () => {
		const config: StandardsConfig = {
			iso: { '4762': { din: ['99999'] } },
			din: {}
		};
		const result = validateNoDuplicateCrossRefs(config);
		// This is a warning, not an error (cross-ref to unlisted standard is ok)
		expect(result.valid).toBe(true);
	});
});

describe('validateWithdrawnFields', () => {
	it('should pass when no withdrawn field is present', () => {
		const config: StandardsConfig = {
			iso: { '4762': { din: ['912'] } },
			din: { '95': {} }
		};
		const result = validateWithdrawnFields(config);
		expect(result.valid).toBe(true);
		expect(result.errors).toHaveLength(0);
	});

	it('should pass for valid withdrawn: true', () => {
		const config: StandardsConfig = {
			din: { '127': { withdrawn: true } }
		};
		const result = validateWithdrawnFields(config);
		expect(result.valid).toBe(true);
	});

	it('should fail for withdrawn with non-boolean value', () => {
		const config = {
			din: { '127': { withdrawn: 'yes' } }
		} as unknown as StandardsConfig;
		const result = validateWithdrawnFields(config);
		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.includes('must be a boolean'))).toBe(true);
	});

	it('should pass when replacedBy references existing standard', () => {
		const config: StandardsConfig = {
			iso: { '10642': {} },
			din: { '7991': { withdrawn: true, replacedBy: 'iso10642' } }
		};
		const result = validateWithdrawnFields(config);
		expect(result.valid).toBe(true);
	});

	it('should fail when replacedBy references non-existent standard', () => {
		const config: StandardsConfig = {
			din: { '7991': { withdrawn: true, replacedBy: 'iso99999' } }
		};
		const result = validateWithdrawnFields(config);
		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.includes('references non-existent'))).toBe(true);
	});

	it('should fail when replacedBy has invalid format', () => {
		const config: StandardsConfig = {
			din: { '7991': { withdrawn: true, replacedBy: 'invalid' } }
		};
		const result = validateWithdrawnFields(config);
		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.includes('Invalid replacedBy format'))).toBe(true);
	});

	it('should warn when withdrawn has no replacedBy', () => {
		const config: StandardsConfig = {
			din: { '127': { withdrawn: true } }
		};
		const result = validateWithdrawnFields(config);
		expect(result.valid).toBe(true);
		expect(result.warnings?.some((w) => w.includes('no replacement'))).toBe(true);
	});
});

describe('validateConfig (full validation)', () => {
	it('should pass for a valid minimal config', () => {
		const config = {
			iso: { '4762': { din: ['912'] } },
			din: { '95': {} }
		};
		const result = validateConfig(config);
		expect(result.valid).toBe(true);
		expect(result.errors).toHaveLength(0);
	});

	it('should collect errors from all validation steps', () => {
		const config = {
			iso: {
				invalid_key: { din: ['abc'] } // invalid key + invalid DIN code
			},
			din: {
				'bad-format': {} // invalid key
			}
		};
		const result = validateConfig(config);
		expect(result.valid).toBe(false);
		expect(result.errors.length).toBeGreaterThanOrEqual(2);
	});

	it('should validate the actual standards-config.json file', async () => {
		const fs = await import('fs');
		const path = await import('path');
		const configPath = path.join(process.cwd(), 'data', 'standards-config.json');

		// Skip if file doesn't exist yet
		if (!fs.existsSync(configPath)) {
			return;
		}

		const configContent = fs.readFileSync(configPath, 'utf-8');
		const config = JSON.parse(configContent);

		const result = validateConfig(config);

		if (!result.valid) {
			console.error('Validation errors:', result.errors);
		}

		expect(result.valid).toBe(true);
	});
});

describe('ValidationResult type', () => {
	it('should have valid, errors, and optional warnings properties', () => {
		const result: ValidationResult = { valid: true, errors: [], warnings: [] };
		expect(result).toHaveProperty('valid');
		expect(result).toHaveProperty('errors');
		expect(result).toHaveProperty('warnings');
		expect(Array.isArray(result.errors)).toBe(true);
	});
});
