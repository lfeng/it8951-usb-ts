/**
 * Integration Test Suite
 * Integration tests for the IT8951 driver
 */

import { EPD } from '../epd.js';
import { AutoEPDDisplay, AutoDisplay } from '../auto-display.js';
import { USBInterface } from '../usb-interface.js';
import {
  DisplayModes,
  Rotate,
  PixelModes,
  EndianTypes,
  Commands,
  Registers,
  VCOM_PRESETS,
  DEFAULT_DISPLAY_MODES,
  LOW_BPP_MODES,
  EPDError,
  VCOMOutOfRangeError,
  SCSIError,
  DeviceNotFoundError,
  RefreshRateError,
  USBTransferError,
  alignRowLength,
  padBuffer,
  isValidVCOM,
  rotationToDegrees,
  degreesToRotation,
} from '../constants.js';

describe('Integration Tests', () => {
  describe('Module Integration', () => {
    it('should import all modules successfully', () => {
      expect(EPD).toBeDefined();
      expect(AutoEPDDisplay).toBeDefined();
      expect(AutoDisplay).toBeDefined();
      expect(USBInterface).toBeDefined();
    });

    it('should create EPD instance', () => {
      const epd = new EPD();
      expect(epd).toBeInstanceOf(EPD);
    });

    it('should create USBInterface instance', () => {
      const usb = new USBInterface();
      expect(usb).toBeInstanceOf(USBInterface);
    });
  });

  describe('Constants Integration', () => {
    it('should have all display modes', () => {
      expect(DisplayModes.INIT).toBe(0);
      expect(DisplayModes.DU).toBe(1);
      expect(DisplayModes.GC16).toBe(2);
      expect(DisplayModes.GL16).toBe(3);
      expect(DisplayModes.GLR16).toBe(4);
      expect(DisplayModes.GLD16).toBe(5);
      expect(DisplayModes.A2).toBe(6);
      expect(DisplayModes.DU4).toBe(7);
    });

    it('should have all rotation modes', () => {
      expect(Rotate.NONE).toBe(0);
      expect(Rotate.CW).toBe(1);
      expect(Rotate.FLIP).toBe(2);
      expect(Rotate.CCW).toBe(3);
    });

    it('should have all pixel modes', () => {
      expect(PixelModes.M_2BPP).toBe(0);
      expect(PixelModes.M_3BPP).toBe(1);
      expect(PixelModes.M_4BPP).toBe(2);
      expect(PixelModes.M_8BPP).toBe(3);
    });

    it('should have all endian types', () => {
      expect(EndianTypes.LITTLE).toBe(0);
      expect(EndianTypes.BIG).toBe(1);
    });

    it('should have all commands', () => {
      expect(Commands.SYS_RUN).toBe(0x0001);
      expect(Commands.STANDBY).toBe(0x0002);
      expect(Commands.SLEEP).toBe(0x0003);
      expect(Commands.REG_RD).toBe(0x0010);
      expect(Commands.REG_WR).toBe(0x0011);
      expect(Commands.LD_IMG).toBe(0x0020);
      expect(Commands.LD_IMG_AREA).toBe(0x0021);
      expect(Commands.DPY_AREA).toBe(0x0034);
      expect(Commands.GET_DEV_INFO).toBe(0x0302);
      expect(Commands.VCOM).toBe(0x0039);
    });

    it('should have all registers', () => {
      expect(Registers.DBASE).toBe(0x1000);
      expect(Registers.LUT0EWHR).toBe(0x1000);
      expect(Registers.LUT0XYR).toBe(0x1040);
      expect(Registers.LUTAFSR).toBe(0x1224);
    });

    it('should have VCOM presets', () => {
      expect(VCOM_PRESETS.WAVESHARE_6INCH).toBe(-1.5);
      expect(VCOM_PRESETS.WAVESHARE_7_8INCH).toBe(-2.3);
      expect(VCOM_PRESETS.WAVESHARE_10_3INCH).toBe(-2.0);
      expect(VCOM_PRESETS.DEFAULT).toBe(-2.0);
    });

    it('should have default display modes', () => {
      expect(DEFAULT_DISPLAY_MODES.FAST).toBe(DisplayModes.DU);
      expect(DEFAULT_DISPLAY_MODES.HIGH_QUALITY).toBe(DisplayModes.GC16);
      expect(DEFAULT_DISPLAY_MODES.ANIMATION).toBe(DisplayModes.A2);
      expect(DEFAULT_DISPLAY_MODES.FULL_REFRESH).toBe(DisplayModes.INIT);
    });

    it('should have correct LOW_BPP_MODES', () => {
      expect(LOW_BPP_MODES.has(DisplayModes.INIT)).toBe(true);
      expect(LOW_BPP_MODES.has(DisplayModes.DU)).toBe(true);
      expect(LOW_BPP_MODES.has(DisplayModes.DU4)).toBe(true);
      expect(LOW_BPP_MODES.has(DisplayModes.A2)).toBe(true);
      expect(LOW_BPP_MODES.has(DisplayModes.GC16)).toBe(false);
    });
  });

  describe('Error Classes Integration', () => {
    it('should create all error types', () => {
      const epdError = new EPDError('Test', 'DEVICE_NOT_FOUND');
      const vcomError = new VCOMOutOfRangeError(-6, -5, -0.1);
      const scsiError = new SCSIError(0x02);
      const deviceError = new DeviceNotFoundError(0x048d, 0x8951);
      const refreshError = new RefreshRateError(500, 1000);
      const usbError = new USBTransferError('Transfer failed');

      expect(epdError).toBeInstanceOf(Error);
      expect(vcomError).toBeInstanceOf(EPDError);
      expect(scsiError).toBeInstanceOf(EPDError);
      expect(deviceError).toBeInstanceOf(EPDError);
      expect(refreshError).toBeInstanceOf(EPDError);
      expect(usbError).toBeInstanceOf(EPDError);
    });
  });

  describe('Utility Functions Integration', () => {
    it('should align row length correctly', () => {
      expect(alignRowLength(100, 8)).toBe(100);
      expect(alignRowLength(101, 8)).toBe(104);
    });

    it('should pad buffer correctly', () => {
      const buffer = new Uint8Array(50).fill(0xAA);
      const padded = padBuffer(buffer, 100, 4);
      expect(padded.length).toBeGreaterThan(50);
    });

    it('should validate VCOM correctly', () => {
      expect(isValidVCOM(-1.5)).toBe(true);
      expect(isValidVCOM(-2.0)).toBe(true);
      expect(isValidVCOM(0)).toBe(false);
      expect(isValidVCOM(-5.0)).toBe(false);
    });

    it('should convert rotation correctly', () => {
      expect(rotationToDegrees(Rotate.NONE)).toBe(0);
      expect(rotationToDegrees(Rotate.CW)).toBe(90);
      expect(rotationToDegrees(Rotate.FLIP)).toBe(180);
      expect(rotationToDegrees(Rotate.CCW)).toBe(270);

      expect(degreesToRotation(0)).toBe(Rotate.NONE);
      expect(degreesToRotation(90)).toBe(Rotate.CW);
      expect(degreesToRotation(180)).toBe(Rotate.FLIP);
      expect(degreesToRotation(270)).toBe(Rotate.CCW);
    });
  });

  describe('EPD Configuration Integration', () => {
    it('should accept various configuration options', () => {
      const epd1 = new EPD({ vcom: -1.5 });
      const epd2 = new EPD({ vcom: 'WAVESHARE_6INCH' });
      const epd3 = new EPD({ timeout: 10000 });
      const epd4 = new EPD({ minRefreshInterval: 2000 });
      const epd5 = new EPD({ vcomEndian: EndianTypes.BIG });

      expect(epd1).toBeInstanceOf(EPD);
      expect(epd2).toBeInstanceOf(EPD);
      expect(epd3).toBeInstanceOf(EPD);
      expect(epd4).toBeInstanceOf(EPD);
      expect(epd5).toBeInstanceOf(EPD);
    });
  });
});
