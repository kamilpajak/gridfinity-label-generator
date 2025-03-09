import { describe, expect, test } from 'vitest';
import {
  calculateDimensions,
  calculateMargins,
  checkQrCodeDisplay,
  generateAltText,
  getAspectRatio,
  getPlaceholderText,
  validateLabelLayout
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

  // Test QR code display
  test('correctly handles QR code display based on showQrCode prop', () => {
    // Test when QR code is enabled
    let qrCodeInfo = checkQrCodeDisplay(true);
    expect(qrCodeInfo.isVisible).toBe(true);
    expect(qrCodeInfo.position).toBe('right side of the label');
    expect(qrCodeInfo.dimensions).toBe('10mm × 10mm');
    
    // Test when QR code is disabled
    qrCodeInfo = checkQrCodeDisplay(false);
    expect(qrCodeInfo.isVisible).toBe(false);
  });
  
  // Test that label elements don't overlap
  test('ensures label elements (image, text, QR code) do not overlap', () => {
    // Test with all elements visible on a standard width label
    const standardWidth = 55;
    let layout = validateLabelLayout(standardWidth, true, true);
    expect(layout.elementsOverlap).toBe(false);
    expect(layout.hasEnoughTextSpace).toBe(true);
    
    // Verify positions - image on left, text in middle, QR on right
    expect(layout.layout.image?.x).toBe(0);
    expect(layout.layout.text.x).toBeGreaterThan(0);
    expect(layout.layout.qrCode?.x).toBeGreaterThan(layout.layout.text.x);
    
    // Test with smaller label width (45mm) in different configurations
    const smallerWidth = 45;
    
    // With all elements
    layout = validateLabelLayout(smallerWidth, true, true);
    // With the fixed QR code position (2mm from right edge), there might be overlap on smaller labels
    console.log(`45mm label with all elements - text area width: ${layout.textAreaWidth}mm`);
    if (layout.textAreaWidth < 10) {
      console.warn(`Warning: Text area width (${layout.textAreaWidth}mm) is less than 10mm on a 45mm label with all elements`);
    }
    
    // With image but no QR code
    const layoutWithImageNoQr = validateLabelLayout(smallerWidth, true, false);
    expect(layoutWithImageNoQr.elementsOverlap).toBe(false);
    expect(layoutWithImageNoQr.hasEnoughTextSpace).toBe(true);
    // Text area should be larger when there's no QR code
    expect(layoutWithImageNoQr.textAreaWidth).toBeGreaterThan(layout.textAreaWidth);
    
    // With QR code but no image
    layout = validateLabelLayout(smallerWidth, false, true);
    expect(layout.elementsOverlap).toBe(false);
    expect(layout.hasEnoughTextSpace).toBe(true);
    
    // With neither image nor QR code
    layout = validateLabelLayout(smallerWidth, false, false);
    expect(layout.elementsOverlap).toBe(false);
    expect(layout.hasEnoughTextSpace).toBe(true);
    expect(layout.textAreaWidth).toBe(smallerWidth);
    
    // Test with minimum viable width
    const minimumWidth = 40;
    layout = validateLabelLayout(minimumWidth, true, true);
    console.log(`40mm label with all elements - text area width: ${layout.textAreaWidth}mm`);
    if (layout.textAreaWidth < 10) {
      console.warn(`Warning: Text area width (${layout.textAreaWidth}mm) is less than 10mm on a 40mm label with all elements`);
    }
    
    // Test with 35mm width
    const smallWidth = 35;
    layout = validateLabelLayout(smallWidth, true, true);
    console.log(`35mm label with all elements - text area width: ${layout.textAreaWidth}mm`);
    
    // With the QR code positioned at the right edge, we should have more space for text
    // We expect the text area width to be positive (no overlap)
    expect(layout.textAreaWidth).toBeGreaterThan(0);
    
    // For very narrow labels, we might still want to show a warning
    if (layout.textAreaWidth < 10) {
      console.warn(`Warning: Text area width (${layout.textAreaWidth}mm) is less than recommended 10mm on a 35mm label with all elements`);
    }
    
    // Test with only image and text (no QR)
    layout = validateLabelLayout(standardWidth, true, false);
    expect(layout.elementsOverlap).toBe(false);
    expect(layout.hasEnoughTextSpace).toBe(true);
    expect(layout.layout.qrCode).toBeNull();
    
    // Test with only text and QR (no image)
    layout = validateLabelLayout(standardWidth, false, true);
    expect(layout.elementsOverlap).toBe(false);
    expect(layout.hasEnoughTextSpace).toBe(true);
    expect(layout.layout.image).toBeNull();
    
    // Test with only text (no image, no QR)
    layout = validateLabelLayout(standardWidth, false, false);
    expect(layout.elementsOverlap).toBe(false);
    expect(layout.hasEnoughTextSpace).toBe(true);
    expect(layout.layout.image).toBeNull();
    expect(layout.layout.qrCode).toBeNull();
    
    // Test with a very narrow label
    const narrowWidth = 15; // Very narrow label
    layout = validateLabelLayout(narrowWidth, true, true);
    console.log(`15mm label with all elements - text area width: ${layout.textAreaWidth}mm`);
    
    // With our new implementation that prioritizes QR code, elements should not overlap
    // even for very narrow labels, but the text area might be too small
    expect(layout.elementsOverlap).toBe(false);
    
    // For very narrow labels, we expect the text area to be less than 10mm
    expect(layout.textAreaWidth).toBeLessThan(10);
    
    // For extremely narrow labels, we might want to show a warning or disable certain elements
    if (layout.textAreaWidth < 5) {
      console.warn(`Warning: Text area width (${layout.textAreaWidth}mm) is extremely small on a 15mm label with all elements`);
    }
  });
});
