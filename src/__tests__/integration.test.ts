/**
 * Integration Test Suite
 * Basic integration tests for the IT8951 driver
 */

import { EPD } from '../epd.js';
import { AutoEPDDisplay } from '../auto-display.js';
import { DisplayModes } from '../constants.js';

describe('Integration Tests', () => {
  describe('Module Integration', () => {
    it('should import all modules successfully', () => {
      expect(EPD).toBeDefined();
      expect(AutoEPDDisplay).toBeDefined();
    });

    it('should create EPD instance', () => {
      const epd = new EPD();
      expect(epd).toBeInstanceOf(EPD);
    });

    it('should handle EPD creation failure gracefully', () => {
      const epd = new EPD({ vcom: -2.0, timeout: 5000 });
      expect(epd).toBeInstanceOf(EPD);
    });
  });

  describe('Error Handling', () => {
    it('should handle device not connected', async () => {
      const epd = new EPD();
      try {
        await epd.init();
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.message).toContain('not found');
      } finally {
        epd.close();
      }
    });

    it('should handle close without init', () => {
      const epd = new EPD();
      expect(() => epd.close()).not.toThrow();
    });
  });

  describe('Display Modes', () => {
    it('should have all display modes defined', () => {
      expect(DisplayModes.INIT).toBe(0);
      expect(DisplayModes.DU).toBe(1);
      expect(DisplayModes.GC16).toBe(2);
      expect(DisplayModes.GL16).toBe(3);
      expect(DisplayModes.GLR16).toBe(4);
      expect(DisplayModes.GLD16).toBe(5);
      expect(DisplayModes.A2).toBe(6);
      expect(DisplayModes.DU4).toBe(7);
    });
  });
});
