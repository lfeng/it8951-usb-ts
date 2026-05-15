/**
 * EPD Test Suite
 * Tests for Electronic Paper Display controller
 */

import { EPD } from '../epd.js';
import { VCOM_PRESETS } from '../constants.js';

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

    it('should create with VCOM preset', () => {
      const presetEpd = new EPD({ vcom: 'WAVESHARE_6INCH' });
      expect(presetEpd).toBeInstanceOf(EPD);
    });

    it('should use default VCOM for unknown preset', () => {
      const presetEpd = new EPD({ vcom: 'UNKNOWN_PRESET' as keyof typeof VCOM_PRESETS });
      expect(presetEpd).toBeInstanceOf(EPD);
    });

    it('should create with minRefreshInterval', () => {
      const customEpd = new EPD({ minRefreshInterval: 2000 });
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

  describe('currentVCOM', () => {
    it('should return current VCOM value', () => {
      expect(epd.currentVCOM).toBe(-2.06);
    });
  });

  describe('close', () => {
    it('should close device without error', () => {
      expect(() => epd.close()).not.toThrow();
    });
  });

  describe('waitDisplayReady', () => {
    it('should resolve immediately', async () => {
      await expect(epd.waitDisplayReady()).resolves.toBeUndefined();
    });
  });

  describe('getVCOM', () => {
    it('should return current VCOM', async () => {
      const vcom = await epd.getVCOM();
      expect(vcom).toBe(-2.06);
    });
  });
});
