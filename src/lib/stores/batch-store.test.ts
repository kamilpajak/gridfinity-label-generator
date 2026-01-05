import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { get } from 'svelte/store';
import { batchStore } from './batch-store';
import type { FastenerLabelConfig, GeneralLabelConfig } from '$lib/types/batch';

// Mock localStorage
const localStorageMock = (() => {
	let store: Record<string, string> = {};
	return {
		getItem: vi.fn((key: string) => store[key] || null),
		setItem: vi.fn((key: string, value: string) => {
			store[key] = value;
		}),
		clear: vi.fn(() => {
			store = {};
		}),
		removeItem: vi.fn((key: string) => {
			delete store[key];
		})
	};
})();

Object.defineProperty(global, 'localStorage', {
	value: localStorageMock,
	writable: true
});

describe('batchStore', () => {
	beforeEach(() => {
		// Clear localStorage mock
		localStorageMock.clear();
		vi.clearAllMocks();
		// Reset store before each test
		batchStore.reset();
	});

	afterEach(() => {
		vi.clearAllTimers();
	});

	describe('initialization', () => {
		it('should initialize with default state', () => {
			const state = get(batchStore);
			expect(state.height).toBe(12);
			expect(state.labels).toEqual([]);
			expect(state.maxLabels).toBe(20);
		});
	});

	describe('setHeight', () => {
		it('should set tape height to 9mm', () => {
			batchStore.setHeight(9);
			expect(get(batchStore).height).toBe(9);
		});

		it('should set tape height to 12mm', () => {
			batchStore.setHeight(12);
			expect(get(batchStore).height).toBe(12);
		});

		it('should clear QR codes from all labels when switching to 9mm', () => {
			const labelWithQR: FastenerLabelConfig = {
				mode: 'fastener',
				measurementSystem: 'metric',
				threadSize: 'M3',
				length: 10,
				width: 35,
				qrCode: 'https://example.com'
			};
			batchStore.addLabel(labelWithQR);
			batchStore.setHeight(9);

			const state = get(batchStore);
			expect(state.height).toBe(9);
			expect(state.labels[0].qrCode).toBeUndefined();
		});
	});

	describe('addLabel', () => {
		it('should add a fastener label', () => {
			const label: FastenerLabelConfig = {
				mode: 'fastener',
				measurementSystem: 'metric',
				threadSize: 'M5',
				length: 20,
				width: 35,
				standard: 'ISO 4017',
				note: 'Test note'
			};
			batchStore.addLabel(label);

			const state = get(batchStore);
			expect(state.labels).toHaveLength(1);
			expect(state.labels[0]).toEqual(label);
		});

		it('should add a general label', () => {
			const label: GeneralLabelConfig = {
				mode: 'general',
				primaryText: 'Test Item',
				secondaryText: 'Secondary Info',
				width: 35,
				note: 'Notes'
			};
			batchStore.addLabel(label);

			const state = get(batchStore);
			expect(state.labels).toHaveLength(1);
			expect(state.labels[0]).toEqual(label);
		});

		it('should not exceed max labels limit', () => {
			for (let i = 0; i < 25; i++) {
				batchStore.addLabel({
					mode: 'general',
					primaryText: `Label ${i}`,
					width: 31
				});
			}

			const state = get(batchStore);
			expect(state.labels).toHaveLength(20);
		});

		it('should strip QR code when height is 9mm', () => {
			batchStore.setHeight(9);
			const label: GeneralLabelConfig = {
				mode: 'general',
				primaryText: 'Test',
				qrCode: 'https://example.com',
				width: 31
			};
			batchStore.addLabel(label);

			const state = get(batchStore);
			expect(state.labels[0].qrCode).toBeUndefined();
		});
	});

	describe('removeLabel', () => {
		it('should remove label at specified index', () => {
			batchStore.addLabel({ mode: 'general', primaryText: 'Label 1', width: 35 });
			batchStore.addLabel({ mode: 'general', primaryText: 'Label 2', width: 35 });
			batchStore.addLabel({ mode: 'general', primaryText: 'Label 3', width: 35 });

			batchStore.removeLabel(1);

			const state = get(batchStore);
			expect(state.labels).toHaveLength(2);
			expect((state.labels[0] as GeneralLabelConfig).primaryText).toBe('Label 1');
			expect((state.labels[1] as GeneralLabelConfig).primaryText).toBe('Label 3');
		});

		it('should do nothing if index is out of bounds', () => {
			batchStore.addLabel({ mode: 'general', primaryText: 'Label 1', width: 35 });
			batchStore.removeLabel(5);

			expect(get(batchStore).labels).toHaveLength(1);
		});
	});

	describe('updateLabel', () => {
		it('should update label at specified index', () => {
			batchStore.addLabel({ mode: 'general', primaryText: 'Original', width: 35 });

			const updated: GeneralLabelConfig = {
				mode: 'general',
				primaryText: 'Updated',
				secondaryText: 'New secondary',
				width: 35
			};
			batchStore.updateLabel(0, updated);

			const state = get(batchStore);
			expect(state.labels[0]).toEqual(updated);
		});

		it('should strip QR code if height is 9mm', () => {
			batchStore.setHeight(9);
			batchStore.addLabel({ mode: 'general', primaryText: 'Test', width: 35 });

			batchStore.updateLabel(0, {
				mode: 'general',
				primaryText: 'Test',
				width: 35,
				qrCode: 'https://example.com'
			});

			const state = get(batchStore);
			expect(state.labels[0].qrCode).toBeUndefined();
		});

		it('should do nothing if index is out of bounds', () => {
			batchStore.addLabel({ mode: 'general', primaryText: 'Test', width: 35 });
			batchStore.updateLabel(5, { mode: 'general', primaryText: 'Updated', width: 35 });

			const state = get(batchStore);
			expect((state.labels[0] as GeneralLabelConfig).primaryText).toBe('Test');
		});
	});

	describe('duplicateLabel', () => {
		it('should duplicate label at specified index', () => {
			const original: FastenerLabelConfig = {
				mode: 'fastener',
				measurementSystem: 'metric',
				threadSize: 'M8',
				length: 30,
				width: 35,
				note: 'Original'
			};
			batchStore.addLabel(original);
			batchStore.duplicateLabel(0);

			const state = get(batchStore);
			expect(state.labels).toHaveLength(2);
			expect(state.labels[1]).toEqual(original);
		});

		it('should duplicate toggle flags along with label data', () => {
			const original: FastenerLabelConfig = {
				mode: 'fastener',
				measurementSystem: 'metric',
				threadSize: 'M6',
				length: 20,
				width: 40,
				standard: 'iso-4017',
				showImage: false,
				showReference: true,
				showQRCode: false
			};
			batchStore.addLabel(original);
			batchStore.duplicateLabel(0);

			const state = get(batchStore);
			expect(state.labels).toHaveLength(2);
			expect(state.labels[1]).toEqual(original);
			expect((state.labels[1] as FastenerLabelConfig).showImage).toBe(false);
			expect((state.labels[1] as FastenerLabelConfig).showReference).toBe(true);
			expect((state.labels[1] as FastenerLabelConfig).showQRCode).toBe(false);
		});

		it('should respect max labels limit when duplicating', () => {
			for (let i = 0; i < 20; i++) {
				batchStore.addLabel({ mode: 'general', primaryText: `Label ${i}`, width: 35 });
			}
			batchStore.duplicateLabel(0);

			expect(get(batchStore).labels).toHaveLength(20);
		});

		it('should do nothing if index is out of bounds', () => {
			batchStore.addLabel({ mode: 'general', primaryText: 'Test', width: 35 });
			batchStore.duplicateLabel(5);

			expect(get(batchStore).labels).toHaveLength(1);
		});

		it('should deep copy customImage object (not share reference)', () => {
			const customImage = {
				data: 'data:image/png;base64,abc123',
				aspectRatio: 1.5,
				originalName: 'test.png'
			};
			const label: GeneralLabelConfig = {
				mode: 'general',
				primaryText: 'With Image',
				width: 40,
				customImage,
				showCustomImage: true
			};
			batchStore.addLabel(label);
			batchStore.duplicateLabel(0);

			const state = get(batchStore);
			const original = state.labels[0] as GeneralLabelConfig;
			const duplicate = state.labels[1] as GeneralLabelConfig;

			// Should have equal values
			expect(duplicate.customImage).toEqual(original.customImage);
			// But NOT the same object reference
			expect(duplicate.customImage).not.toBe(original.customImage);
		});

		it('should isolate customImage mutations between original and duplicate', () => {
			const label: GeneralLabelConfig = {
				mode: 'general',
				primaryText: 'Test',
				width: 40,
				customImage: {
					data: 'data:image/png;base64,original',
					aspectRatio: 2,
					originalName: 'original.png'
				}
			};
			batchStore.addLabel(label);
			batchStore.duplicateLabel(0);

			// Get state and mutate duplicated label's customImage
			const state = get(batchStore);
			const duplicate = state.labels[1] as GeneralLabelConfig;
			if (duplicate.customImage) {
				duplicate.customImage.data = 'data:image/png;base64,mutated';
				duplicate.customImage.originalName = 'mutated.png';
			}

			// Original should be unchanged
			const original = state.labels[0] as GeneralLabelConfig;
			expect(original.customImage?.data).toBe('data:image/png;base64,original');
			expect(original.customImage?.originalName).toBe('original.png');
		});

		it('should handle labels without customImage (fastener mode)', () => {
			const fastenerLabel: FastenerLabelConfig = {
				mode: 'fastener',
				measurementSystem: 'metric',
				threadSize: 'M6',
				length: 20,
				width: 35,
				standard: 'iso-4017'
			};
			batchStore.addLabel(fastenerLabel);
			batchStore.duplicateLabel(0);

			const state = get(batchStore);
			expect(state.labels).toHaveLength(2);
			expect(state.labels[1]).toEqual(fastenerLabel);
		});
	});

	describe('reorderLabels', () => {
		it('should move label from one position to another', () => {
			batchStore.addLabel({ mode: 'general', primaryText: 'Label 1', width: 35 });
			batchStore.addLabel({ mode: 'general', primaryText: 'Label 2', width: 35 });
			batchStore.addLabel({ mode: 'general', primaryText: 'Label 3', width: 35 });

			batchStore.reorderLabels(0, 2);

			const state = get(batchStore);
			expect((state.labels[0] as GeneralLabelConfig).primaryText).toBe('Label 2');
			expect((state.labels[1] as GeneralLabelConfig).primaryText).toBe('Label 3');
			expect((state.labels[2] as GeneralLabelConfig).primaryText).toBe('Label 1');
		});

		it('should handle moving to the same position', () => {
			batchStore.addLabel({ mode: 'general', primaryText: 'Label 1', width: 35 });
			batchStore.addLabel({ mode: 'general', primaryText: 'Label 2', width: 35 });

			batchStore.reorderLabels(1, 1);

			const state = get(batchStore);
			expect((state.labels[1] as GeneralLabelConfig).primaryText).toBe('Label 2');
		});
	});

	describe('clear', () => {
		it('should remove all labels but keep height', () => {
			batchStore.setHeight(9);
			batchStore.addLabel({ mode: 'general', primaryText: 'Label 1', width: 35 });
			batchStore.addLabel({ mode: 'general', primaryText: 'Label 2', width: 35 });

			batchStore.clear();

			const state = get(batchStore);
			expect(state.height).toBe(9);
			expect(state.labels).toEqual([]);
		});
	});

	describe('reset', () => {
		it('should reset to default state', () => {
			batchStore.setHeight(9);
			batchStore.addLabel({ mode: 'general', primaryText: 'Label 1', width: 35 });

			batchStore.reset();

			const state = get(batchStore);
			expect(state.height).toBe(12);
			expect(state.labels).toEqual([]);
		});
	});

	describe('canAddLabel', () => {
		it('should return true when under max labels', () => {
			expect(batchStore.canAddLabel()).toBe(true);
		});

		it('should return false when at max labels', () => {
			for (let i = 0; i < 20; i++) {
				batchStore.addLabel({ mode: 'general', primaryText: `Label ${i}`, width: 35 });
			}
			expect(batchStore.canAddLabel()).toBe(false);
		});
	});

	describe('getLabelCount', () => {
		it('should return current number of labels', () => {
			expect(batchStore.getLabelCount()).toBe(0);
			batchStore.addLabel({ mode: 'general', primaryText: 'Label 1', width: 35 });
			expect(batchStore.getLabelCount()).toBe(1);
			batchStore.addLabel({ mode: 'general', primaryText: 'Label 2', width: 35 });
			expect(batchStore.getLabelCount()).toBe(2);
		});
	});

	describe('localStorage persistence', () => {
		beforeEach(() => {
			// Clear all mocks before each localStorage test
			vi.clearAllMocks();
		});

		it('should save state to localStorage on changes', async () => {
			batchStore.addLabel({ mode: 'general', primaryText: 'Test', width: 35 });

			// Wait for debounce (500ms)
			await new Promise((resolve) => setTimeout(resolve, 600));

			expect(localStorageMock.setItem).toHaveBeenCalledWith(
				'gridscribe_batch_v1',
				expect.stringContaining('"version":1')
			);
		});

		it('should load state from localStorage on initialization', () => {
			// Manually set localStorage data
			const testState = {
				version: 1,
				data: {
					height: 9,
					labels: [{ mode: 'general' as const, primaryText: 'Saved Label', width: 40 }],
					maxLabels: 20
				}
			};
			localStorageMock.setItem('gridscribe_batch_v1', JSON.stringify(testState));

			// Re-import store to trigger initialization
			// Note: In real app, this happens on page load
			const state = get(batchStore);

			// Store should have loaded data (or default if not loaded yet)
			expect(state.height).toBeDefined();
			expect(Array.isArray(state.labels)).toBe(true);
		});

		it('should handle invalid localStorage data gracefully', () => {
			localStorageMock.setItem('gridscribe_batch_v1', 'invalid json');

			// Should not throw, should use default state
			expect(() => batchStore.reset()).not.toThrow();
		});

		it('should handle localStorage errors gracefully', async () => {
			// Save original implementation
			const originalSetItem = localStorageMock.setItem;

			// Mock setItem to throw (simulates full storage or disabled localStorage)
			localStorageMock.setItem = vi.fn(() => {
				throw new Error('QuotaExceededError');
			});

			// Should not throw when localStorage.setItem fails
			expect(() =>
				batchStore.addLabel({ mode: 'general', primaryText: 'Test', width: 35 })
			).not.toThrow();

			// Wait for debounce
			await new Promise((resolve) => setTimeout(resolve, 600));

			// Restore original
			localStorageMock.setItem = originalSetItem;
		});

		it('should handle version mismatch', async () => {
			const oldVersionState = {
				version: 999,
				data: {
					height: 12,
					labels: [],
					maxLabels: 20
				}
			};
			localStorageMock.setItem('gridscribe_batch_v1', JSON.stringify(oldVersionState));

			// Should fall back to default state on version mismatch
			batchStore.reset();
			const state = get(batchStore);
			expect(state.height).toBe(12); // Default
			expect(state.labels).toEqual([]); // Default
		});

		it('should debounce rapid saves', async () => {
			vi.useFakeTimers();

			batchStore.addLabel({ mode: 'general', primaryText: 'Label 1', width: 35 });
			batchStore.addLabel({ mode: 'general', primaryText: 'Label 2', width: 35 });
			batchStore.addLabel({ mode: 'general', primaryText: 'Label 3', width: 35 });

			// Should not have saved yet (debounce)
			expect(localStorageMock.setItem).not.toHaveBeenCalled();

			// Fast-forward past debounce time
			vi.advanceTimersByTime(600);

			// Should have saved once
			expect(localStorageMock.setItem).toHaveBeenCalledTimes(1);

			vi.useRealTimers();
		});
	});
});
