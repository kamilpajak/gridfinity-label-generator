import { describe, it, expect } from 'vitest';
import {
  calculateWidthForPrinting,
  calculateExpectedPrintedWidth,
  calculateScalingFactor
} from './printCalibration';

describe('Print Calibration Utilities', () => {
  describe('calculateWidthForPrinting', () => {
    it('should calculate the correct width to set for desired printed width', () => {
      // Test with default scaling factor (1.074)
      expect(calculateWidthForPrinting(54)).toBeCloseTo(50.28, 2);
      expect(calculateWidthForPrinting(100)).toBeCloseTo(93.11, 2);
      
      // Test with custom scaling factor
      expect(calculateWidthForPrinting(54, 1.1)).toBeCloseTo(49.09, 2);
      expect(calculateWidthForPrinting(100, 1.2)).toBeCloseTo(83.33, 2);
    });
    
    it('should handle edge cases', () => {
      // Zero width
      expect(calculateWidthForPrinting(0)).toBe(0);
      
      // Very small width
      expect(calculateWidthForPrinting(1)).toBeCloseTo(0.93, 2);
      
      // Very large width
      expect(calculateWidthForPrinting(1000)).toBeCloseTo(931.1, 1);
    });
  });
  
  describe('calculateExpectedPrintedWidth', () => {
    it('should calculate the expected printed width based on set width', () => {
      // Test with default scaling factor (1.074)
      expect(calculateExpectedPrintedWidth(50.28)).toBeCloseTo(54, 2);
      expect(calculateExpectedPrintedWidth(93.11)).toBeCloseTo(100, 2);
      
      // Test with custom scaling factor
      expect(calculateExpectedPrintedWidth(49.09, 1.1)).toBeCloseTo(54, 2);
      expect(calculateExpectedPrintedWidth(83.33, 1.2)).toBeCloseTo(100, 2);
    });
    
    it('should handle edge cases', () => {
      // Zero width
      expect(calculateExpectedPrintedWidth(0)).toBe(0);
      
      // Very small width
      expect(calculateExpectedPrintedWidth(0.93)).toBeCloseTo(1, 2);
      
      // Very large width
      expect(calculateExpectedPrintedWidth(931.1)).toBeCloseTo(1000, 1);
    });
  });
  
  describe('calculateScalingFactor', () => {
    it('should calculate the correct scaling factor', () => {
      expect(calculateScalingFactor(54, 58)).toBeCloseTo(1.074, 3);
      expect(calculateScalingFactor(100, 110)).toBeCloseTo(1.1, 3);
    });
    
    it('should handle edge cases', () => {
      // Equal values
      expect(calculateScalingFactor(50, 50)).toBe(1);
      
      // Zero set width should throw or return Infinity
      expect(() => calculateScalingFactor(0, 50)).not.toThrow();
      expect(calculateScalingFactor(0, 50)).toBe(Infinity);
    });
  });
  
  describe('Relationship between functions', () => {
    it('should maintain consistency between functions', () => {
      // If we calculate width to set for a desired printed width,
      // then calculate expected printed width from that result,
      // we should get back the original desired width
      
      const desiredWidth = 54;
      const widthToSet = calculateWidthForPrinting(desiredWidth);
      const expectedPrintedWidth = calculateExpectedPrintedWidth(widthToSet);
      
      expect(expectedPrintedWidth).toBeCloseTo(desiredWidth, 5);
      
      // Similarly, if we calculate a scaling factor and use it in both functions,
      // they should be consistent
      
      const setWidth = 50;
      const actualPrintedWidth = 55;
      const scalingFactor = calculateScalingFactor(setWidth, actualPrintedWidth);
      
      expect(calculateExpectedPrintedWidth(setWidth, scalingFactor)).toBeCloseTo(actualPrintedWidth, 5);
      expect(calculateWidthForPrinting(actualPrintedWidth, scalingFactor)).toBeCloseTo(setWidth, 5);
    });
  });
});
