import { describe, expect, test } from 'vitest';
import {
  calculateDimensions,
  calculateMargins,
  generateAltText,
  getAspectRatio,
  getPlaceholderText
} from './LabelPreview.test.helpers';

describe('LabelPreview Component', () => {
  // Test the dimensions calculations
  test('calculates correct dimensions for tape size and printable area', () => {
    const labelWidth = 55;
    const dimensions = calculateDimensions(labelWidth);
    
    // Check tape size dimensions
    expect(dimensions.tapeSize.width).toBe(labelWidth);
    expect(dimensions.tapeSize.height).toBe(12);
    expect(dimensions.tapeSize.text).toContain(`${labelWidth}mm × 12mm`);
    expect(dimensions.tapeSize.text).toContain('tape size');
    
    // Check printable area dimensions
    expect(dimensions.printableArea.width).toBe(labelWidth - 4);
    expect(dimensions.printableArea.height).toBe(10);
    expect(dimensions.printableArea.text).toContain(`${labelWidth - 4}mm × 10mm`);
    expect(dimensions.printableArea.text).toContain('printable area');
  });

  // Test the margin calculations
  test('calculates correct margin percentages', () => {
    const labelWidth = 55;
    const margins = calculateMargins(labelWidth);
    
    // Calculate expected margin percentages
    const expectedTopBottomMargin = (1 / 12) * 100; // 8.33%
    const expectedLeftRightMargin = (2 / labelWidth) * 100; // ~3.64%
    
    // Test that our calculations match what we expect
    expect(margins.top).toBeCloseTo(expectedTopBottomMargin);
    expect(margins.bottom).toBeCloseTo(expectedTopBottomMargin);
    expect(margins.left).toBeCloseTo(expectedLeftRightMargin);
    expect(margins.right).toBeCloseTo(expectedLeftRightMargin);
  });

  // Test the placeholder text
  test('returns correct placeholder text', () => {
    const placeholder = getPlaceholderText();
    expect(placeholder).toBe('Fill out the form to generate a label');
  });

  // Test the image alt text
  test('generates correct alt text with dimensions', () => {
    const labelWidth = 55;
    const altText = generateAltText(labelWidth);
    
    expect(altText).toBe(`Generated label with dimensions ${labelWidth - 4}mm × 10mm`);
  });

  // Test the aspect ratio
  test('calculates correct aspect ratio for tape container', () => {
    const labelWidth = 55;
    const aspectRatio = getAspectRatio(labelWidth);
    
    expect(aspectRatio).toBe(`${labelWidth} / 12`);
  });
});
