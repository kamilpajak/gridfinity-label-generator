import { describe, it, expect, vi } from 'vitest';
import { createEscapeHandler, createBackdropClickHandler } from './modal-utils';

describe('modal-utils', () => {
	describe('createEscapeHandler', () => {
		it('should call onClose when Escape is pressed', () => {
			const onClose = vi.fn();
			const handler = createEscapeHandler(onClose);

			handler({ key: 'Escape' } as KeyboardEvent);

			expect(onClose).toHaveBeenCalledOnce();
		});

		it('should not call onClose for other keys', () => {
			const onClose = vi.fn();
			const handler = createEscapeHandler(onClose);

			handler({ key: 'Enter' } as KeyboardEvent);
			handler({ key: 'Tab' } as KeyboardEvent);
			handler({ key: 'a' } as KeyboardEvent);

			expect(onClose).not.toHaveBeenCalled();
		});
	});

	describe('createBackdropClickHandler', () => {
		it('should call onClose when clicking on backdrop itself', () => {
			const onClose = vi.fn();
			const handler = createBackdropClickHandler(onClose);
			const sameElement = {};

			handler({ target: sameElement, currentTarget: sameElement } as unknown as MouseEvent);

			expect(onClose).toHaveBeenCalledOnce();
		});

		it('should not call onClose when clicking on child element', () => {
			const onClose = vi.fn();
			const handler = createBackdropClickHandler(onClose);
			const backdrop = {};
			const modal = {};

			handler({ target: modal, currentTarget: backdrop } as unknown as MouseEvent);

			expect(onClose).not.toHaveBeenCalled();
		});
	});
});
