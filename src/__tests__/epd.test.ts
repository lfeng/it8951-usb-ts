/**
 * EPD Test Suite
 * Tests for Electronic Paper Display controller
 */

import { EPD } from '../epd.js';
import { PixelModes } from '../constants.js';

describe('EPD', () => {
  let epd: EPD;

  beforeEach(() => {
    epd = new EPD({ vcom: -2.06, timeout: 5000 });
  });

  describe('constructor', () => {
    it('should create with default config', () => {
      const defaultEpd = new EPD();
      expect(defaultEpd).toBeInstanceOf(EPD);
    });

    it('should create with custom vcom', () => {
      const customEpd = new EPD({ vcom: -1.5 });
      expect(customEpd).toBeInstanceOf(EPD);
    });

    it('should create with custom timeout', () => {
      const customEpd = new EPD({ timeout: 10000 });
      expect(customEpd).toBeInstanceOf(EPD);
    });
  });

  describe('property getters before init', () => {
    it('should throw error when accessing width before init', () => {
      expect(() => epd.width).toThrow('Device not initialized');
    });

    it('should throw error when accessing height before init', () => {
      expect(() => epd.height).toThrow('Device not initialized');
    });

    it('should throw error when accessing imageBufferAddress before init', () => {
      expect(() => epd.imageBufferAddress).toThrow('Device not initialized');
    });

    it('should throw error when accessing firmwareVersion before init', () => {
      expect(() => epd.firmwareVersion).toThrow('Device not initialized');
    });

    it('should throw error when accessing lutVersion before init', () => {
      expect(() => epd.lutVersion).toThrow('Device not initialized');
    });
  });

  describe('validateVCOM', () => {
    it('should throw error for positive VCOM', async () => {
      // Access private method via any
      try {
        await (epd as any).validateVCOM(1.5);
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.message).toContain('VCOM must be between');
      }
    });

    it('should throw error for VCOM <= -5', async () => {
      try {
        await (epd as any).validateVCOM(-5.0);
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.message).toContain('VCOM must be between');
      }
    });

    it('should accept valid VCOM', async () => {
      expect(() => (epd as any).validateVCOM(-2.06)).not.toThrow();
    });
  });

  describe('getBppValue', () => {
    it('should return correct bits per pixel', () => {
      expect((epd as any).getBppValue(PixelModes.M_2BPP)).toBe(2);
      expect((epd as any).getBppValue(PixelModes.M_4BPP)).toBe(3);
      expect((epd as any).getBppValue(PixelModes.M_4BPP)).toBe(4);
      expect((epd as any).getBppValue(PixelModes.M_8BPP)).toBe(8);
    });
  });

  describe('sleepMs', () => {
    it('should sleep for specified milliseconds', async () => {
      const start = Date.now();
      await (epd as any).sleepMs(10);
      const end = Date.now();
      expect(end - start).toBeGreaterThanOrEqual(9);
    });
  });
});
