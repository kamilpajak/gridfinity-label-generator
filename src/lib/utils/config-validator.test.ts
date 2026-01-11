/**
 * Standards Config Validator Tests (TDD)
 *
 * Phase 2 of standards validation pipeline.
 * Tests for validating standards-config.json structure and content.
 */

import { describe, it, expect } from 'vitest';
import {
	validateConfigStructure,
	validateIdFormat,
	validateNoDuplicates,
	validateCrossReferences,
	validateStatusFields,
	validateConfig,
	type ValidationResult,
	type StandardsConfig
} from './config-validator';

describe('validateConfigStructure', () => {
	it('should pass for valid config with crossref and dinOnly sections', () => {
		const config = {
			crossref: { iso4762: { din: ['912'] } },
			dinOnly: { din912: { description: 'Test' } }
		};
		const result = validateConfigStructure(config);
		expect(result.valid).toBe(true);
		expect(result.errors).toHaveLength(0);
	});

	it('should fail if crossref section is missing', () => {
		const config = { dinOnly: {} };
		const result = validateConfigStructure(config);
		expect(result.valid).toBe(false);
		expect(result.errors).toContain('Missing required section: crossref');
	});

	it('should fail if dinOnly section is missing', () => {
		const config = { crossref: {} };
		const result = validateConfigStructure(config);
		expect(result.valid).toBe(false);
		expect(result.errors).toContain('Missing required section: dinOnly');
	});

	it('should fail if crossref is not an object', () => {
		const config = { crossref: [], dinOnly: {} };
		const result = validateConfigStructure(config);
		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.includes('crossref must be an object'))).toBe(true);
	});

	it('should fail if dinOnly is not an object', () => {
		const config = { crossref: {}, dinOnly: 'invalid' };
		const result = validateConfigStructure(config);
		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.includes('dinOnly must be an object'))).toBe(true);
	});
});

describe('validateIdFormat', () => {
	it('should pass for valid ISO ID format (iso followed by numbers)', () => {
		expect(validateIdFormat('iso4762').valid).toBe(true);
		expect(validateIdFormat('iso1234').valid).toBe(true);
		expect(validateIdFormat('iso10642').valid).toBe(true);
	});

	it('should pass for valid DIN ID format (din followed by numbers)', () => {
		expect(validateIdFormat('din912').valid).toBe(true);
		expect(validateIdFormat('din7991').valid).toBe(true);
		expect(validateIdFormat('din125').valid).toBe(true);
	});

	it('should fail for ID without iso/din prefix', () => {
		const result = validateIdFormat('4762');
		expect(result.valid).toBe(false);
		expect(result.errors[0]).toContain('Invalid ID format');
	});

	it('should fail for ID with invalid prefix', () => {
		const result = validateIdFormat('ansi123');
		expect(result.valid).toBe(false);
	});

	it('should fail for ID with non-numeric suffix', () => {
		const result = validateIdFormat('iso123abc');
		expect(result.valid).toBe(false);
	});

	it('should fail for empty ID', () => {
		const result = validateIdFormat('');
		expect(result.valid).toBe(false);
	});

	it('should fail for ID with spaces', () => {
		const result = validateIdFormat('iso 4762');
		expect(result.valid).toBe(false);
	});
});

describe('validateNoDuplicates', () => {
	it('should pass when no duplicates exist', () => {
		const config = {
			crossref: { iso4762: { din: ['912'] }, iso1234: { din: ['84'] } },
			dinOnly: { din125: { description: 'Washer' } }
		};
		const result = validateNoDuplicates(config);
		expect(result.valid).toBe(true);
		expect(result.errors).toHaveLength(0);
	});

	it('should fail when same ID appears in both crossref and dinOnly', () => {
		const config = {
			crossref: { din912: { din: ['912'] } },
			dinOnly: { din912: { description: 'Duplicate' } }
		};
		const result = validateNoDuplicates(config);
		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.includes('din912'))).toBe(true);
	});

	it('should detect multiple duplicates', () => {
		const config = {
			crossref: { iso4762: { din: ['912'] }, din125: { din: ['125'] } },
			dinOnly: { iso4762: { description: 'Dup1' }, din125: { description: 'Dup2' } }
		};
		const result = validateNoDuplicates(config);
		expect(result.valid).toBe(false);
		expect(result.errors.length).toBeGreaterThanOrEqual(2);
	});
});

describe('validateCrossReferences', () => {
	it('should pass for valid cross-references with numeric DIN codes', () => {
		const config = {
			crossref: {
				iso4762: { din: ['912'] },
				iso7380: { din: ['9427'] }
			},
			dinOnly: {}
		};
		const result = validateCrossReferences(config);
		expect(result.valid).toBe(true);
	});

	it('should pass for cross-reference with multiple DIN codes', () => {
		const config = {
			crossref: {
				iso4018: { din: ['558', '561'] }
			},
			dinOnly: {}
		};
		const result = validateCrossReferences(config);
		expect(result.valid).toBe(true);
	});

	it('should pass for cross-reference with empty DIN array', () => {
		const config = {
			crossref: {
				iso10509: { din: [] }
			},
			dinOnly: {}
		};
		const result = validateCrossReferences(config);
		expect(result.valid).toBe(true);
	});

	it('should fail for non-numeric DIN code', () => {
		const config = {
			crossref: {
				iso4762: { din: ['abc'] }
			},
			dinOnly: {}
		};
		const result = validateCrossReferences(config);
		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.includes('Invalid DIN code'))).toBe(true);
	});

	it('should fail if din property is not an array', () => {
		// Intentionally invalid data for testing validation
		const config = {
			crossref: {
				iso4762: { din: '912' }
			},
			dinOnly: {}
		} as unknown as StandardsConfig;
		const result = validateCrossReferences(config);
		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.includes('must be an array'))).toBe(true);
	});

	it('should fail if din property is missing', () => {
		// Intentionally invalid data for testing validation
		const config = {
			crossref: {
				iso4762: {}
			},
			dinOnly: {}
		} as unknown as StandardsConfig;
		const result = validateCrossReferences(config);
		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.includes('missing din property'))).toBe(true);
	});
});

describe('validateConfig (full validation)', () => {
	it('should pass for a valid minimal config', () => {
		const config = {
			crossref: {
				iso4762: { din: ['912'] }
			},
			dinOnly: {
				din125: { description: 'Flat washers' }
			}
		};
		const result = validateConfig(config);
		expect(result.valid).toBe(true);
		expect(result.errors).toHaveLength(0);
	});

	it('should collect errors from all validation steps', () => {
		const config = {
			crossref: {
				invalid_id: { din: ['abc'] } // invalid ID format + invalid DIN code
			},
			dinOnly: {
				bad_format: { description: 'Test' } // invalid ID format
			}
		};
		const result = validateConfig(config);
		expect(result.valid).toBe(false);
		// Should have errors from ID format (2) and cross-ref validation (1)
		expect(result.errors.length).toBeGreaterThanOrEqual(3);
	});

	it('should validate the actual standards-config.json file', async () => {
		const fs = await import('fs');
		const path = await import('path');
		const configPath = path.join(process.cwd(), 'data', 'standards-config.json');
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
	it('should have valid and errors properties', () => {
		const result: ValidationResult = { valid: true, errors: [] };
		expect(result).toHaveProperty('valid');
		expect(result).toHaveProperty('errors');
		expect(Array.isArray(result.errors)).toBe(true);
	});
});

describe('validateStatusFields (Phase 4: Semantic Status)', () => {
	it('should pass when no status field is present', () => {
		const config: StandardsConfig = {
			crossref: { iso4762: { din: ['912'] } },
			dinOnly: { din125: { description: 'Flat washers' } }
		};
		const result = validateStatusFields(config);
		expect(result.valid).toBe(true);
		expect(result.errors).toHaveLength(0);
	});

	it('should pass for valid status CURRENT', () => {
		const config: StandardsConfig = {
			crossref: {},
			dinOnly: {
				din125: { description: 'Flat washers', status: 'CURRENT' }
			}
		};
		const result = validateStatusFields(config);
		expect(result.valid).toBe(true);
	});

	it('should pass for valid status WITHDRAWN', () => {
		const config: StandardsConfig = {
			crossref: {},
			dinOnly: {
				din127: { description: 'Spring lock washers', status: 'WITHDRAWN' }
			}
		};
		const result = validateStatusFields(config);
		expect(result.valid).toBe(true);
	});

	it('should fail for invalid status value', () => {
		const config = {
			crossref: {},
			dinOnly: {
				din127: { description: 'Test', status: 'INVALID' }
			}
		} as unknown as StandardsConfig;
		const result = validateStatusFields(config);
		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.includes('Invalid status'))).toBe(true);
	});

	it('should pass when replacedBy references existing standard in crossref', () => {
		const config: StandardsConfig = {
			crossref: { iso7090: { din: ['125'] } },
			dinOnly: {
				din127: { description: 'Spring lock washers', status: 'WITHDRAWN', replacedBy: 'iso7090' }
			}
		};
		const result = validateStatusFields(config);
		expect(result.valid).toBe(true);
	});

	it('should pass when replacedBy references existing standard in dinOnly', () => {
		const config: StandardsConfig = {
			crossref: {},
			dinOnly: {
				din127: { description: 'Old washers', status: 'WITHDRAWN', replacedBy: 'din128' },
				din128: { description: 'New washers' }
			}
		};
		const result = validateStatusFields(config);
		expect(result.valid).toBe(true);
	});

	it('should fail when replacedBy references non-existent standard', () => {
		const config: StandardsConfig = {
			crossref: {},
			dinOnly: {
				din127: { description: 'Test', status: 'WITHDRAWN', replacedBy: 'iso99999' }
			}
		};
		const result = validateStatusFields(config);
		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.includes('references non-existent'))).toBe(true);
	});

	it('should warn when WITHDRAWN status has no replacedBy', () => {
		const config: StandardsConfig = {
			crossref: {},
			dinOnly: {
				din935: { description: 'Castle nuts', status: 'WITHDRAWN' }
			}
		};
		const result = validateStatusFields(config);
		// This should pass but generate a warning (not an error)
		expect(result.valid).toBe(true);
		expect(result.warnings).toBeDefined();
		expect(result.warnings?.some((w) => w.includes('no replacement'))).toBe(true);
	});

	it('should validate status in crossref entries too', () => {
		const config = {
			crossref: {
				iso4762: { din: ['912'], status: 'INVALID' }
			},
			dinOnly: {}
		} as unknown as StandardsConfig;
		const result = validateStatusFields(config);
		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.includes('Invalid status'))).toBe(true);
	});
});
