/**
 * Constants Test Suite
 * Tests for verifying IT8951 constants are correctly defined
 */

import {
  USB_VENDOR_ID,
  USB_PRODUCT_ID,
  Commands,
  Rotate,
  PixelModes,
  DisplayModes,
  LOW_BPP_MODES,
  EndianTypes,
  Registers,
  DEFAULT_DISPLAY_MODES,
} from '../constants.js';

describe('Constants', () => {
  describe('USB IDs', () => {
    it('should have correct vendor ID', () => {
      expect(USB_VENDOR_ID).toBe(0x0416);
    });

    it('should have correct product ID', () => {
      expect(USB_PRODUCT_ID).toBe(0x5020);
    });
  });

  describe('Commands', () => {
    it('should have correct command codes', () => {
      expect(Commands.SYS_RUN).toBe(0x0001);
      expect(Commands.STANDBY).toBe(0x0002);
      expect(Commands.SLEEP).toBe(0x0003);
      expect(Commands.REG_RD).toBe(0x0010);
      expect(Commands.REG_WR).toBe(0x0011);
      expect(Commands.LD_IMG).toBe(0x0020);
      expect(Commands.LD_IMG_AREA).toBe(0x0021);
      expect(Commands.LD_IMG_END).toBe(0x0022);
      expect(Commands.DPY_AREA).toBe(0x0034);
      expect(Commands.GET_DEV_INFO).toBe(0x0302);
      expect(Commands.VCOM).toBe(0x0039);
    });
  });

  describe('Rotate', () => {
    it('should have correct rotation modes', () => {
      expect(Rotate.NONE).toBe(0);
      expect(Rotate.CW).toBe(1);
      expect(Rotate.FLIP).toBe(2);
      expect(Rotate.CCW).toBe(3);
    });
  });

  describe('PixelModes', () => {
    it('should have correct pixel format modes', () => {
      expect(PixelModes.M_2BPP).toBe(0);
      expect(PixelModes.M_4BPP).toBe(1);
      expect(PixelModes.M_4BPP).toBe(2);
      expect(PixelModes.M_8BPP).toBe(3);
    });
  });

  describe('DisplayModes', () => {
    it('should have correct display modes', () => {
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

  describe('LOW_BPP_MODES', () => {
    it('should contain low bpp display modes', () => {
      expect(LOW_BPP_MODES.has(DisplayModes.INIT)).toBe(true);
      expect(LOW_BPP_MODES.has(DisplayModes.DU)).toBe(true);
      expect(LOW_BPP_MODES.has(DisplayModes.DU4)).toBe(true);
      expect(LOW_BPP_MODES.has(DisplayModes.A2)).toBe(true);
    });

    it('should not contain high bpp modes', () => {
      expect(LOW_BPP_MODES.has(DisplayModes.GC16)).toBe(false);
      expect(LOW_BPP_MODES.has(DisplayModes.GL16)).toBe(false);
      expect(LOW_BPP_MODES.has(DisplayModes.GLR16)).toBe(false);
      expect(LOW_BPP_MODES.has(DisplayModes.GLD16)).toBe(false);
    });
  });

  describe('EndianTypes', () => {
    it('should have correct endian types', () => {
      expect(EndianTypes.LITTLE).toBe(0);
      expect(EndianTypes.BIG).toBe(1);
    });
  });

  describe('Registers', () => {
    it('should have correct register addresses', () => {
      expect(Registers.DBASE).toBe(0x1000);
      expect(Registers.LUT0EWHR).toBe(0x1000);
      expect(Registers.LUT0XYR).toBe(0x1040);
      expect(Registers.LUT0BADDR).toBe(0x1080);
      expect(Registers.LUT0MFN).toBe(0x10C0);
      expect(Registers.LUTAFSR).toBe(0x1224);
      expect(Registers.BGVR).toBe(0x1250);
      expect(Registers.I80CPCR).toBe(0x0004);
      expect(Registers.MBASE).toBe(0x200);
      expect(Registers.MCSR).toBe(0x200);
      expect(Registers.LISAR).toBe(0x208);
    });
  });

  describe('DEFAULT_DISPLAY_MODES', () => {
    it('should have correct default modes', () => {
      expect(DEFAULT_DISPLAY_MODES.FAST).toBe(DisplayModes.DU);
      expect(DEFAULT_DISPLAY_MODES.HIGH_QUALITY).toBe(DisplayModes.GC16);
      expect(DEFAULT_DISPLAY_MODES.ANIMATION).toBe(DisplayModes.A2);
      expect(DEFAULT_DISPLAY_MODES.FULL_REFRESH).toBe(DisplayModes.INIT);
    });
  });
});
