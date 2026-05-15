/**
 * Constants Test Suite
 * Tests for verifying IT8951 constants and utility functions
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
  VCOM_PRESETS,
  VCOM_RANGE,
  SCSIStatus,
  EPDError,
  VCOMOutOfRangeError,
  SCSIError,
  DeviceNotFoundError,
  RefreshRateError,
  USBTransferError,
  ImageOutOfBoundsError,
  alignRowLength,
  padBuffer,
  isValidVCOM,
  rotationToDegrees,
  degreesToRotation,
  clamp,
  isInBounds,
  intersectRectangles,
  SCSICommands,
  MODE_REFRESH_TIMES,
  DISPLAY_PRESETS,
  grayscaleToPixelState,
  quantizeTo4Levels,
} from "../constants.js";

describe("Constants", () => {
  describe("USB IDs", () => {
    it("should have correct vendor ID", () => {
      expect(USB_VENDOR_ID).toBe(0x048d);
    });

    it("should have correct product ID", () => {
      expect(USB_PRODUCT_ID).toBe(0x8951);
    });
  });

  describe("Commands", () => {
    it("should have correct command codes", () => {
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

  describe("Rotate", () => {
    it("should have correct rotation modes", () => {
      expect(Rotate.NONE).toBe(0);
      expect(Rotate.CW).toBe(1);
      expect(Rotate.FLIP).toBe(2);
      expect(Rotate.CCW).toBe(3);
    });
  });

  describe("PixelModes", () => {
    it("should have correct pixel format modes", () => {
      expect(PixelModes.M_2BPP).toBe(0);
      expect(PixelModes.M_3BPP).toBe(1);
      expect(PixelModes.M_4BPP).toBe(2);
      expect(PixelModes.M_8BPP).toBe(3);
    });
  });

  describe("DisplayModes", () => {
    it("should have correct display modes", () => {
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

  describe("LOW_BPP_MODES", () => {
    it("should contain low bpp display modes", () => {
      expect(LOW_BPP_MODES.has(DisplayModes.INIT)).toBe(true);
      expect(LOW_BPP_MODES.has(DisplayModes.DU)).toBe(true);
      expect(LOW_BPP_MODES.has(DisplayModes.DU4)).toBe(true);
      expect(LOW_BPP_MODES.has(DisplayModes.A2)).toBe(true);
    });

    it("should not contain high bpp modes", () => {
      expect(LOW_BPP_MODES.has(DisplayModes.GC16)).toBe(false);
      expect(LOW_BPP_MODES.has(DisplayModes.GL16)).toBe(false);
      expect(LOW_BPP_MODES.has(DisplayModes.GLR16)).toBe(false);
      expect(LOW_BPP_MODES.has(DisplayModes.GLD16)).toBe(false);
    });
  });

  describe("EndianTypes", () => {
    it("should have correct endian types", () => {
      expect(EndianTypes.LITTLE).toBe(0);
      expect(EndianTypes.BIG).toBe(1);
    });
  });

  describe("Registers", () => {
    it("should have correct register addresses", () => {
      expect(Registers.DBASE).toBe(0x1000);
      expect(Registers.LUT0EWHR).toBe(0x1000);
      expect(Registers.LUT0XYR).toBe(0x1040);
      expect(Registers.LUT0BADDR).toBe(0x1080);
      expect(Registers.LUT0MFN).toBe(0x10c0);
      expect(Registers.LUTAFSR).toBe(0x1224);
      expect(Registers.BGVR).toBe(0x1250);
      expect(Registers.I80CPCR).toBe(0x0004);
      expect(Registers.MBASE).toBe(0x200);
      expect(Registers.MCSR).toBe(0x200);
      expect(Registers.LISAR).toBe(0x208);
    });
  });

  describe("DEFAULT_DISPLAY_MODES", () => {
    it("should have correct default modes", () => {
      expect(DEFAULT_DISPLAY_MODES.FAST).toBe(DisplayModes.DU);
      expect(DEFAULT_DISPLAY_MODES.HIGH_QUALITY).toBe(DisplayModes.GC16);
      expect(DEFAULT_DISPLAY_MODES.ANIMATION).toBe(DisplayModes.A2);
      expect(DEFAULT_DISPLAY_MODES.FULL_REFRESH).toBe(DisplayModes.INIT);
    });
  });

  describe("VCOM_PRESETS", () => {
    it("should have correct VCOM presets", () => {
      expect(VCOM_PRESETS.WAVESHARE_6INCH).toBe(-1.5);
      expect(VCOM_PRESETS.WAVESHARE_7_8INCH).toBe(-2.3);
      expect(VCOM_PRESETS.WAVESHARE_10_3INCH).toBe(-2.0);
      expect(VCOM_PRESETS.DEFAULT).toBe(-2.0);
    });
  });

  describe("VCOM_RANGE", () => {
    it("should have correct VCOM range for 7.8-inch display", () => {
      // Updated based on 7.8inch e-Paper Specification
      expect(VCOM_RANGE.MIN).toBe(-4.0);
      expect(VCOM_RANGE.MAX).toBe(-0.3);
    });
  });

  describe("SCSICommands", () => {
    it("should have correct SCSI command codes", () => {
      expect(SCSICommands.GET_SYS).toBe(0x80);
      expect(SCSICommands.READ_MEM).toBe(0x81);
      expect(SCSICommands.WRITE_MEM).toBe(0x82);
      expect(SCSICommands.LD_IMG_AREA).toBe(0xa2);
      expect(SCSICommands.LD_IMG_END).toBe(0x22);
      expect(SCSICommands.DPY_AREA).toBe(0x94);
      expect(SCSICommands.DPY_BUF_AREA).toBe(0x97);
      expect(SCSICommands.PMIC_CTRL).toBe(0xa3);
      expect(SCSICommands.FAST_WRITE_MEM).toBe(0xa5);
      expect(SCSICommands.AUTO_RESET).toBe(0xa7);
      expect(SCSICommands.INQUIRY).toBe(0x12);
    });
  });

  describe("MODE_REFRESH_TIMES", () => {
    it("should have correct refresh times for each mode", () => {
      expect(MODE_REFRESH_TIMES[DisplayModes.INIT]).toBe(2000);
      expect(MODE_REFRESH_TIMES[DisplayModes.DU]).toBe(260);
      expect(MODE_REFRESH_TIMES[DisplayModes.GC16]).toBe(450);
      expect(MODE_REFRESH_TIMES[DisplayModes.GL16]).toBe(450);
      expect(MODE_REFRESH_TIMES[DisplayModes.A2]).toBe(120);
      expect(MODE_REFRESH_TIMES[DisplayModes.DU4]).toBe(290);
    });
  });

  describe("DISPLAY_PRESETS", () => {
    it("should have correct dimensions for 7.8-inch display", () => {
      expect(DISPLAY_PRESETS.WAVESHARE_7_8INCH.width).toBe(1872);
      expect(DISPLAY_PRESETS.WAVESHARE_7_8INCH.height).toBe(1404);
    });

    it("should have correct dimensions for 6-inch display", () => {
      expect(DISPLAY_PRESETS.WAVESHARE_6INCH.width).toBe(800);
      expect(DISPLAY_PRESETS.WAVESHARE_6INCH.height).toBe(600);
    });

    it("should have correct dimensions for 6-inch HD display", () => {
      expect(DISPLAY_PRESETS.WAVESHARE_6INCH_HD.width).toBe(1448);
      expect(DISPLAY_PRESETS.WAVESHARE_6INCH_HD.height).toBe(1072);
    });

    it("should have correct dimensions for 9.7-inch display", () => {
      expect(DISPLAY_PRESETS.WAVESHARE_9_7INCH.width).toBe(1200);
      expect(DISPLAY_PRESETS.WAVESHARE_9_7INCH.height).toBe(825);
    });

    it("should have correct dimensions for 10.3-inch display", () => {
      expect(DISPLAY_PRESETS.WAVESHARE_10_3INCH.width).toBe(1872);
      expect(DISPLAY_PRESETS.WAVESHARE_10_3INCH.height).toBe(1404);
    });

    it("should have correct dimensions for 13.3-inch display", () => {
      expect(DISPLAY_PRESETS.WAVESHARE_13_3INCH.width).toBe(1600);
      expect(DISPLAY_PRESETS.WAVESHARE_13_3INCH.height).toBe(1200);
    });
  });

  describe("SCSIStatus", () => {
    it("should have correct SCSI status codes", () => {
      expect(SCSIStatus.GOOD).toBe(0x00);
      expect(SCSIStatus.CHECK_CONDITION).toBe(0x02);
      expect(SCSIStatus.CONDITION_MET).toBe(0x04);
      expect(SCSIStatus.BUSY).toBe(0x08);
    });
  });
});

describe("Error Classes", () => {
  describe("EPDError", () => {
    it("should create error with code and details", () => {
      const error = new EPDError("Test error", "DEVICE_NOT_FOUND", { vid: 0x048d });
      expect(error.message).toBe("Test error");
      expect(error.code).toBe("DEVICE_NOT_FOUND");
      expect(error.details).toEqual({ vid: 0x048d });
      expect(error.name).toBe("EPDError");
    });
  });

  describe("VCOMOutOfRangeError", () => {
    it("should create error with correct message", () => {
      const error = new VCOMOutOfRangeError(-6.0, -5.0, -0.1);
      expect(error.message).toContain("-6");
      expect(error.message).toContain("out of range");
      expect(error.code).toBe("VCOM_OUT_OF_RANGE");
      expect(error.name).toBe("VCOMOutOfRangeError");
    });

    it("should include value details", () => {
      const error = new VCOMOutOfRangeError(1.5, -5.0, -0.1);
      expect(error.details).toEqual({ value: 1.5, min: -5.0, max: -0.1 });
    });
  });

  describe("SCSIError", () => {
    it("should create error with status code", () => {
      const error = new SCSIError(0x02);
      expect(error.message).toContain("0x2");
      expect(error.code).toBe("SCSI_COMMAND_FAILED");
      expect(error.name).toBe("SCSIError");
    });

    it("should accept custom message", () => {
      const error = new SCSIError(0x02, "Custom SCSI error");
      expect(error.message).toBe("Custom SCSI error");
    });
  });

  describe("DeviceNotFoundError", () => {
    it("should create error with vendor and product IDs", () => {
      const error = new DeviceNotFoundError(0x048d, 0x8951);
      expect(error.message).toContain("0x48d");
      expect(error.message).toContain("0x8951");
      expect(error.code).toBe("DEVICE_NOT_FOUND");
      expect(error.name).toBe("DeviceNotFoundError");
    });
  });

  describe("RefreshRateError", () => {
    it("should create error with interval information", () => {
      const error = new RefreshRateError(500, 1000);
      expect(error.message).toContain("500ms");
      expect(error.message).toContain("1000ms");
      expect(error.code).toBe("REFRESH_RATE_TOO_HIGH");
      expect(error.name).toBe("RefreshRateError");
    });
  });

  describe("USBTransferError", () => {
    it("should create error with message", () => {
      const error = new USBTransferError("Transfer failed");
      expect(error.message).toContain("USB transfer error");
      expect(error.message).toContain("Transfer failed");
      expect(error.code).toBe("USB_TRANSFER_ERROR");
      expect(error.name).toBe("USBTransferError");
    });
  });

  describe("ImageOutOfBoundsError", () => {
    it("should create error with bounds information", () => {
      const error = new ImageOutOfBoundsError(100, 100, 200, 200, 800, 600);
      expect(error.message).toContain("100");
      expect(error.message).toContain("200x200");
      expect(error.message).toContain("800x600");
      expect(error.code).toBe("IMAGE_OUT_OF_BOUNDS");
      expect(error.name).toBe("ImageOutOfBoundsError");
    });
  });
});

describe("Utility Functions", () => {
  describe("alignRowLength", () => {
    it("should calculate correct alignment for 8bpp", () => {
      expect(alignRowLength(100, 8)).toBe(100); // Already aligned
      expect(alignRowLength(101, 8)).toBe(104); // Align to 4 bytes
    });

    it("should calculate correct alignment for 4bpp", () => {
      expect(alignRowLength(100, 4)).toBe(52); // 50 bytes + 2 padding
      expect(alignRowLength(200, 4)).toBe(100); // Exactly 100 bytes
    });

    it("should calculate correct alignment for 2bpp", () => {
      expect(alignRowLength(100, 2)).toBe(28); // 25 bytes + 3 padding
      expect(alignRowLength(64, 2)).toBe(16); // Exactly 16 bytes
    });

    it("should throw for invalid bpp", () => {
      expect(() => alignRowLength(100, 1 as 2)).toThrow(RangeError);
      expect(() => alignRowLength(100, 16 as 8)).toThrow(RangeError);
    });
  });

  describe("padBuffer", () => {
    it("should return same buffer if no padding needed", () => {
      const buffer = new Uint8Array(100);
      const result = padBuffer(buffer, 100, 8);
      expect(result).toBe(buffer);
    });

    it("should pad buffer correctly", () => {
      const buffer = new Uint8Array(50).fill(0xaa);
      const result = padBuffer(buffer, 100, 4);
      expect(result.length).toBeGreaterThan(50);
    });

    it("should throw for invalid buffer size", () => {
      const buffer = new Uint8Array(100);
      expect(() => padBuffer(buffer, 30, 8)).toThrow(RangeError);
    });
  });

  describe("isValidVCOM", () => {
    it("should return true for valid VCOM values", () => {
      expect(isValidVCOM(-1.5)).toBe(true);
      expect(isValidVCOM(-2.0)).toBe(true);
      expect(isValidVCOM(-2.3)).toBe(true); // 7.8-inch recommended
      expect(isValidVCOM(-3.9)).toBe(true);
    });

    it("should return false for invalid VCOM values", () => {
      expect(isValidVCOM(0)).toBe(false);
      expect(isValidVCOM(1.5)).toBe(false);
      expect(isValidVCOM(-4.0)).toBe(false); // At boundary (exclusive)
      expect(isValidVCOM(-0.3)).toBe(false); // At boundary (exclusive)
      expect(isValidVCOM(-5.0)).toBe(false);
    });
  });

  describe("grayscaleToPixelState", () => {
    it("should map 16 grayscale levels to even pixel states", () => {
      expect(grayscaleToPixelState(0)).toBe(0); // Black
      expect(grayscaleToPixelState(8)).toBe(16); // Mid-gray
      expect(grayscaleToPixelState(15)).toBe(30); // White
    });

    it("should clamp values to valid range", () => {
      expect(grayscaleToPixelState(-1)).toBe(0); // Clamped to 0
      expect(grayscaleToPixelState(20)).toBe(30); // Clamped to 30
    });
  });

  describe("quantizeTo4Levels", () => {
    it("should quantize to 4 grayscale levels for DU4 mode", () => {
      expect(quantizeTo4Levels(0)).toBe(0); // Black
      expect(quantizeTo4Levels(63)).toBe(0); // Still black
      expect(quantizeTo4Levels(64)).toBe(85); // Dark gray
      expect(quantizeTo4Levels(127)).toBe(85); // Still dark gray
      expect(quantizeTo4Levels(128)).toBe(170); // Light gray
      expect(quantizeTo4Levels(191)).toBe(170); // Still light gray
      expect(quantizeTo4Levels(192)).toBe(255); // White
      expect(quantizeTo4Levels(255)).toBe(255); // Still white
    });
  });

  describe("rotationToDegrees", () => {
    it("should convert rotation enum to degrees", () => {
      expect(rotationToDegrees(Rotate.NONE)).toBe(0);
      expect(rotationToDegrees(Rotate.CW)).toBe(90);
      expect(rotationToDegrees(Rotate.FLIP)).toBe(180);
      expect(rotationToDegrees(Rotate.CCW)).toBe(270);
    });

    it("should return 0 for unknown rotation", () => {
      expect(rotationToDegrees(99 as Rotate)).toBe(0);
    });
  });

  describe("degreesToRotation", () => {
    it("should convert degrees to rotation enum", () => {
      expect(degreesToRotation(0)).toBe(Rotate.NONE);
      expect(degreesToRotation(90)).toBe(Rotate.CW);
      expect(degreesToRotation(180)).toBe(Rotate.FLIP);
      expect(degreesToRotation(270)).toBe(Rotate.CCW);
    });

    it("should throw for invalid degrees", () => {
      expect(() => degreesToRotation(45)).toThrow(RangeError);
      expect(() => degreesToRotation(360)).toThrow(RangeError);
    });
  });

  describe("clamp", () => {
    it("should clamp values to range", () => {
      expect(clamp(5, 0, 10)).toBe(5);
      expect(clamp(-5, 0, 10)).toBe(0);
      expect(clamp(15, 0, 10)).toBe(10);
    });

    it("should handle negative ranges", () => {
      expect(clamp(-3, -5, -1)).toBe(-3);
      expect(clamp(-10, -5, -1)).toBe(-5);
    });
  });

  describe("isInBounds", () => {
    it("should return true for rectangles within bounds", () => {
      expect(isInBounds(0, 0, 100, 100, 800, 600)).toBe(true);
      expect(isInBounds(700, 500, 100, 100, 800, 600)).toBe(true);
    });

    it("should return true for partially overlapping rectangles", () => {
      expect(isInBounds(750, 550, 100, 100, 800, 600)).toBe(true);
      expect(isInBounds(-50, -50, 100, 100, 800, 600)).toBe(true);
    });

    it("should return false for rectangles outside bounds", () => {
      expect(isInBounds(900, 0, 100, 100, 800, 600)).toBe(false);
      expect(isInBounds(0, 700, 100, 100, 800, 600)).toBe(false);
      expect(isInBounds(-200, 0, 100, 100, 800, 600)).toBe(false);
    });
  });

  describe("intersectRectangles", () => {
    it("should calculate intersection of two rectangles", () => {
      const result = intersectRectangles(0, 0, 100, 100, 50, 50, 100, 100);
      expect(result).toEqual([50, 50, 50, 50]);
    });

    it("should return null for non-intersecting rectangles", () => {
      const result = intersectRectangles(0, 0, 50, 50, 100, 100, 50, 50);
      expect(result).toBeNull();
    });

    it("should handle complete containment", () => {
      const result = intersectRectangles(0, 0, 200, 200, 50, 50, 50, 50);
      expect(result).toEqual([50, 50, 50, 50]);
    });
  });
});
