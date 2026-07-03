import { writable, get } from 'svelte/store';
import type { BatchState, BatchLabel, BatchLabelConfig, TapeHeight } from '$lib/types/batch';
import { DEFAULT_BATCH_STATE } from '$lib/types/batch';

/** Generate a stable unique id for a batch label. */
function newLabelId(): string {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID();
	}
	// Fallback for environments without crypto.randomUUID
	return `label-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
}

/** Strip the qrCode field from a label (used when tape height is 9mm). */
function stripQrCode<T extends { qrCode?: string }>(label: T): T {
	if (!label.qrCode) return label;
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const { qrCode: _qrCode, ...rest } = label;
	return rest as T;
}

const STORAGE_KEY = 'gridscribe_batch_v1';
const STORAGE_VERSION = 1;
const SAVE_DEBOUNCE_MS = 500;

interface StoredBatch {
	version: number;
	data: BatchState;
}

/**
 * Load batch state from localStorage
 */
function loadFromStorage(): BatchState {
	if (typeof localStorage === 'undefined') {
		return { ...DEFAULT_BATCH_STATE };
	}

	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (!stored) {
			return { ...DEFAULT_BATCH_STATE };
		}

		const parsed: StoredBatch = JSON.parse(stored);

		// Version check for future migrations
		if (parsed.version !== STORAGE_VERSION) {
			console.warn(`Batch storage version mismatch: ${parsed.version} !== ${STORAGE_VERSION}`);
			return { ...DEFAULT_BATCH_STATE };
		}

		// Validate data structure
		if (
			!parsed.data ||
			typeof parsed.data.height !== 'number' ||
			!Array.isArray(parsed.data.labels)
		) {
			console.warn('Invalid batch data structure in localStorage');
			return { ...DEFAULT_BATCH_STATE };
		}

		// Backfill ids for labels persisted before the id field existed, so old
		// data is upgraded in place instead of discarded.
		return {
			...parsed.data,
			labels: parsed.data.labels.map((label) => ({
				...label,
				id: label.id ?? newLabelId()
			}))
		};
	} catch (error) {
		console.warn('Failed to load batch from localStorage:', error);
		return { ...DEFAULT_BATCH_STATE };
	}
}

/**
 * Save batch state to localStorage with debouncing
 */
let saveTimeout: ReturnType<typeof setTimeout> | null = null;
function saveToStorage(state: BatchState): void {
	if (typeof localStorage === 'undefined') {
		return;
	}

	// Clear previous timeout
	if (saveTimeout) {
		clearTimeout(saveTimeout);
	}

	// Debounce save
	saveTimeout = setTimeout(() => {
		try {
			const toStore: StoredBatch = {
				version: STORAGE_VERSION,
				data: state
			};
			localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
		} catch (error) {
			// Silently fail - common causes: localStorage full, disabled, or quota exceeded
			console.warn('Failed to save batch to localStorage:', error);
		}
	}, SAVE_DEBOUNCE_MS);
}

function createBatchStore() {
	// Initialize with data from localStorage
	const { subscribe, set, update } = writable<BatchState>(loadFromStorage());

	// Subscribe to changes and save to localStorage
	let isInitialLoad = true;
	subscribe((state) => {
		if (isInitialLoad) {
			isInitialLoad = false;
			return;
		}
		saveToStorage(state);
	});

	return {
		subscribe,
		setHeight: (height: TapeHeight) => {
			update((state) => {
				const newState = { ...state, height };
				// Remove QR codes from all labels if switching to 9mm
				if (height === 9) {
					newState.labels = newState.labels.map((label) => stripQrCode(label));
				}
				return newState;
			});
		},
		addLabel: (label: BatchLabelConfig) => {
			update((state) => {
				if (state.labels.length >= state.maxLabels) {
					return state;
				}
				// Strip QR code if height is 9mm, then assign a fresh id.
				const cleaned = state.height === 9 ? stripQrCode(label) : label;
				const stored: BatchLabel = { ...cleaned, id: newLabelId() };
				return {
					...state,
					labels: [...state.labels, stored]
				};
			});
		},
		removeLabel: (index: number) => {
			update((state) => {
				if (index < 0 || index >= state.labels.length) {
					return state;
				}
				return {
					...state,
					labels: state.labels.filter((_, i) => i !== index)
				};
			});
		},
		removeLabelById: (id: string) => {
			update((state) => ({
				...state,
				labels: state.labels.filter((label) => label.id !== id)
			}));
		},
		updateLabel: (index: number, label: BatchLabelConfig) => {
			update((state) => {
				if (index < 0 || index >= state.labels.length) {
					return state;
				}
				// Strip QR code if height is 9mm; preserve the existing id.
				const cleaned = state.height === 9 ? stripQrCode(label) : label;
				const newLabels = [...state.labels];
				newLabels[index] = { ...cleaned, id: state.labels[index].id };
				return {
					...state,
					labels: newLabels
				};
			});
		},
		duplicateLabel: (index: number) => {
			update((state) => {
				if (index < 0 || index >= state.labels.length || state.labels.length >= state.maxLabels) {
					return state;
				}
				const labelToDuplicate = state.labels[index];

				// Deep copy for GeneralLabelConfig with customImage; always a fresh id.
				let duplicatedLabel: BatchLabel;
				if (labelToDuplicate.mode === 'general' && labelToDuplicate.customImage) {
					duplicatedLabel = {
						...labelToDuplicate,
						customImage: { ...labelToDuplicate.customImage },
						id: newLabelId()
					};
				} else {
					duplicatedLabel = { ...labelToDuplicate, id: newLabelId() };
				}

				return {
					...state,
					labels: [...state.labels, duplicatedLabel]
				};
			});
		},
		/** Replace the label order with a reordered array (same labels, e.g. from drag-and-drop). */
		reorder: (labels: BatchLabel[]) => {
			update((state) => ({ ...state, labels: [...labels] }));
		},
		reorderLabels: (fromIndex: number, toIndex: number) => {
			update((state) => {
				if (
					fromIndex < 0 ||
					fromIndex >= state.labels.length ||
					toIndex < 0 ||
					toIndex >= state.labels.length
				) {
					return state;
				}
				const newLabels = [...state.labels];
				const [movedLabel] = newLabels.splice(fromIndex, 1);
				newLabels.splice(toIndex, 0, movedLabel);
				return {
					...state,
					labels: newLabels
				};
			});
		},
		clear: () => {
			update((state) => ({
				...state,
				labels: []
			}));
		},
		reset: () => {
			set({ ...DEFAULT_BATCH_STATE });
		},
		canAddLabel: (): boolean => {
			const state = get(batchStore);
			return state.labels.length < state.maxLabels;
		},
		getLabelCount: (): number => {
			const state = get(batchStore);
			return state.labels.length;
		}
	};
}

export const batchStore = createBatchStore();
