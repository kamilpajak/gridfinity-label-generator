/**
 * Shared utilities for modal components.
 */

/**
 * Create a keydown handler that closes modal on Escape.
 */
export function createEscapeHandler(onClose: () => void) {
	return (e: KeyboardEvent) => {
		if (e.key === 'Escape') {
			onClose();
		}
	};
}

/**
 * Create a backdrop click handler that closes modal when clicking outside.
 */
export function createBackdropClickHandler(onClose: () => void) {
	return (e: MouseEvent) => {
		if (e.target === e.currentTarget) {
			onClose();
		}
	};
}
