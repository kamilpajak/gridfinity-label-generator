import '@testing-library/jest-dom';
import { afterEach, expect } from 'vitest';

// Automatically clean up after each test
afterEach(() => {
  // Qwik doesn't have a cleanup function like React Testing Library
  // We'll handle cleanup in individual tests if needed
});

// Extend expect with jest-dom matchers
expect.extend({
  // Add any custom matchers here if needed
});
