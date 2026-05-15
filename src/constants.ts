/**
 * IT8951 USB Display Controller Constants
 *
 * Based on the IT8951 V0.2.4.3 datasheet, 7.8inch e-Paper Specification,
 * and E-paper Mode Declaration documents.
 * Enhanced with comprehensive documentation and type safety.
 */

// =============================================================================
// USB Identification
// =============================================================================

/** USB Vendor ID for ITE Tech. Inc. */
export const USB_VENDOR_ID = 0x048d;

/** USB Product ID for IT8951 */
export const USB_PRODUCT_ID = 0x8951;

// =============================================================================
// Display Size Presets
// =============================================================================

/**
 * Display size presets for common e-paper displays
 *
 * Note: Width is horizontal (H), Height is vertical (V)
 */
export const DISPLAY_PRESETS = {
  /** Waveshare 6-inch display (800x600) */
  WAVESHARE_6INCH: { width: 800, height: 600 },
  /** Waveshare 6-inch HD display (1448x1072) */
  WAVESHARE_6INCH_HD: { width: 1448, height: 1072 },
  /** Waveshare 7.8-inch display (1872x1404) */
  WAVESHARE_7_8INCH: { width: 1872, height: 1404 },
  /** Waveshare 9.7-inch display (1200x825) */
  WAVESHARE_9_7INCH: { width: 1200, height: 825 },
  /** Waveshare 10.3-inch display (1872x1404) */
  WAVESHARE_10_3INCH: { width: 1872, height: 1404 },
  /** Waveshare 13.3-inch display (1600x1200) */
  WAVESHARE_13_3INCH: { width: 1600, height: 1200 },
} as const;

// =============================================================================
// SCSI Command Codes (CDB[6] values)
// =============================================================================

/**
 * SCSI command codes for IT8951 USB communication
 *
 * These are the values used in CDB[6] for custom SCSI commands
 */
export enum SCSICommands {
  /** Get system information (returns 112 bytes) */
  GET_SYS = 0x80,
  /** Read device memory */
  READ_MEM = 0x81,
  /** Write device memory */
  WRITE_MEM = 0x82,
  /** Load image area to frame buffer */
  LD_IMG_AREA = 0xa2,
  /** End image loading */
  LD_IMG_END = 0x22,
  /** Display area update */
  DPY_AREA = 0x94,
  /** Display buffer area (index mode) */
  DPY_BUF_AREA = 0x97,
  /** PMIC control (power and VCOM) */
  PMIC_CTRL = 0xa3,
  /** Fast write memory (up to 30MB/s) */
  FAST_WRITE_MEM = 0xa5,
  /** Automatic controller reset */
  AUTO_RESET = 0xa7,
  /** SCSI INQUIRY - device identification */
  INQUIRY = 0x12,
}

// =============================================================================
// Command Codes
// =============================================================================

/**
 * IT8951 Command codes for USB SCSI communication
 *
 * These commands control various aspects of the display controller
 */
export enum Commands {
  /** System run command */
  SYS_RUN = 0x0001,
  /** Enter standby mode */
  STANDBY = 0x0002,
  /** Enter sleep mode */
  SLEEP = 0x0003,
  /** Register read */
  REG_RD = 0x0010,
  /** Register write */
  REG_WR = 0x0011,
  /** Memory burst read (target) */
  MEM_BST_RD_T = 0x0012,
  /** Memory burst read (source) */
  MEM_BST_RD_S = 0x0013,
  /** Memory burst write */
  MEM_BST_WR = 0x0014,
  /** Memory burst end */
  MEM_BST_END = 0x0015,
  /** Load image data */
  LD_IMG = 0x0020,
  /** Load image data for specific area */
  LD_IMG_AREA = 0x0021,
  /** End image loading */
  LD_IMG_END = 0x0022,

  // User-defined commands from Waveshare
  /** Display area update */
  DPY_AREA = 0x0034,
  /** Get device information */
  GET_DEV_INFO = 0x0302,
  /** Display buffer area */
  DPY_BUF_AREA = 0x0037,
  /** VCOM voltage control */
  VCOM = 0x0039,
}

// =============================================================================
// Display Rotation
// =============================================================================

/**
 * Display rotation modes
 *
 * Controls how the image data is oriented on the display
 */
export enum Rotate {
  /** No rotation (0 degrees) */
  NONE = 0,
  /** Clockwise rotation (90 degrees) */
  CW = 1,
  /** Flip rotation (180 degrees) */
  FLIP = 2,
  /** Counter-clockwise rotation (270 degrees) */
  CCW = 3,
}

// =============================================================================
// Pixel Formats
// =============================================================================

/**
 * Pixel formats (bits per pixel)
 *
 * Defines the color depth for image data
 */
export enum PixelModes {
  /** 2 bits per pixel (4 grayscale levels) */
  M_2BPP = 0,
  /** 3 bits per pixel (8 grayscale levels) */
  M_3BPP = 1,
  /** 4 bits per pixel (16 grayscale levels) */
  M_4BPP = 2,
  /** 8 bits per pixel (256 grayscale levels) */
  M_8BPP = 3,
}

// =============================================================================
// Display Waveform Modes
// =============================================================================

/**
 * Display waveform modes
 *
 * Different display modes optimized for various use cases.
 * Based on E-paper Mode Declaration document (AF waveform).
 */
export enum DisplayModes {
  /** Initialization mode - full screen flash for clearing (~2000ms) */
  INIT = 0,
  /** Direct Update - fast updates for text/line drawings (~260ms) */
  DU = 1,
  /** Grayscale 16 - high quality image display (~450ms) */
  GC16 = 2,
  /** Grayscale 16 optimized - white background text, reduced flash (~450ms) */
  GL16 = 3,
  /** Grayscale 16 with remap - reduced artifacts with preprocessing (~450ms) */
  GLR16 = 4,
  /** Grayscale 16 with dither - best quality with preprocessing (~450ms) */
  GLD16 = 5,
  /** Animation mode 2 - fastest updates, black/white only (~120ms) */
  A2 = 6,
  /** Direct Update 4 - fast 4-level grayscale (~290ms) */
  DU4 = 7,
}

/**
 * Display mode refresh times in milliseconds (@25°C, 85Hz)
 *
 * Based on E-paper Mode Declaration document.
 */
export const MODE_REFRESH_TIMES: Readonly<Record<DisplayModes, number>> = {
  [DisplayModes.INIT]: 2000,
  [DisplayModes.DU]: 260,
  [DisplayModes.GC16]: 450,
  [DisplayModes.GL16]: 450,
  [DisplayModes.GLR16]: 450,
  [DisplayModes.GLD16]: 450,
  [DisplayModes.A2]: 120,
  [DisplayModes.DU4]: 290,
};

/**
 * Display modes that only require 2bpp pixel data
 *
 * These modes can work with lower bit-depth image data for efficiency
 */
export const LOW_BPP_MODES: ReadonlySet<DisplayModes> = new Set([
  DisplayModes.INIT,
  DisplayModes.DU,
  DisplayModes.DU4,
  DisplayModes.A2,
]);

// =============================================================================
// Endian Types
// =============================================================================

/**
 * Endian types for data transmission
 *
 * Controls byte order for multi-byte values in USB communication
 */
export enum EndianTypes {
  /** Little endian (least significant byte first) */
  LITTLE = 0,
  /** Big endian (most significant byte first) */
  BIG = 1,
}

// =============================================================================
// Device Registers
// =============================================================================

/**
 * Device register addresses
 *
 * Memory-mapped registers for controlling the IT8951 hardware
 */
export enum Registers {
  /** Base address for register R/W access (I80 only) */
  DBASE = 0x1000,

  /** LUT0 engine width height register */
  LUT0EWHR = 0x1000,
  /** LUT0 XY coordinates register */
  LUT0XYR = 0x1040,
  /** LUT0 base address register */
  LUT0BADDR = 0x1080,
  /** LUT0 mode and frame number register */
  LUT0MFN = 0x10c0,
  /** LUT0/LUT1 active flag register */
  LUT01AF = 0x1114,

  /** Update parameter0 setting register */
  UP0SR = 0x1134,
  /** Update parameter1 setting register */
  UP1SR = 0x1138,
  /** LUT0 alpha blend and fill rectangle value register */
  LUT0ABFRV = 0x113c,
  /** Update buffer base address register */
  UPBBADDR = 0x117c,
  /** LUT0 image buffer X/Y offset register */
  LUT0IMXY = 0x1180,
  /** LUT status register (status of all LUT engines) */
  LUTAFSR = 0x1224,

  /** Bitmap (1bpp) image color table register */
  BGVR = 0x1250,

  /** I80 control parameter register */
  I80CPCR = 0x0004,

  /** Memory base address */
  MBASE = 0x200,
  /** Memory control/status register */
  MCSR = 0x200,
  /** Line interrupt status and address register */
  LISAR = 0x208,
}

// =============================================================================
// Default Configurations
// =============================================================================

/**
 * Default display modes for common use cases
 *
 * Pre-configured mode selections for typical applications
 */
export const DEFAULT_DISPLAY_MODES = {
  /** Fast update for text and line drawings */
  FAST: DisplayModes.DU,
  /** High quality for photographic images */
  HIGH_QUALITY: DisplayModes.GC16,
  /** Animation and video content */
  ANIMATION: DisplayModes.A2,
  /** Full refresh to eliminate ghosting artifacts */
  FULL_REFRESH: DisplayModes.INIT,
} as const;

/**
 * VCOM voltage presets for common e-paper displays
 *
 * Recommended VCOM values for popular display modules
 */
export const VCOM_PRESETS = {
  /** Waveshare 6-inch display */
  WAVESHARE_6INCH: -1.5,
  /** Waveshare 7.8-inch display */
  WAVESHARE_7_8INCH: -2.3,
  /** Waveshare 10.3-inch display */
  WAVESHARE_10_3INCH: -2.0,
  /** Default fallback value */
  DEFAULT: -2.0,
} as const;

/**
 * Valid range for VCOM voltage values
 *
 * Based on 7.8inch e-Paper Specification: -4V to -0.3V (adjustable)
 */
export const VCOM_RANGE = {
  /** Minimum valid VCOM voltage */
  MIN: -4.0,
  /** Maximum valid VCOM voltage (must be negative) */
  MAX: -0.3,
} as const;

// =============================================================================
// SCSI Status Codes
// =============================================================================

/**
 * SCSI status codes for USB communication
 *
 * Standard SCSI status responses from the device
 */
export enum SCSIStatus {
  /** Command completed successfully */
  GOOD = 0x00,
  /** Check condition - error occurred */
  CHECK_CONDITION = 0x02,
  /** Condition met - successful completion */
  CONDITION_MET = 0x04,
  /** Device is busy processing previous command */
  BUSY = 0x08,
  /** Intermediate status */
  INTERMEDIATE = 0x10,
  /** Intermediate condition met */
  INTERMEDIATE_CONDITION_MET = 0x14,
  /** Reservation conflict */
  RESERVATION_CONFLICT = 0x18,
}

// =============================================================================
// Error Classes
// =============================================================================

/** Valid error codes for EPD errors */
export type EPDErrorCode =
  | "VCOM_OUT_OF_RANGE"
  | "SCSI_COMMAND_FAILED"
  | "DEVICE_NOT_FOUND"
  | "REFRESH_RATE_TOO_HIGH"
  | "DEVICE_NOT_INITIALIZED"
  | "INVALID_BUFFER_INDEX"
  | "USB_TRANSFER_ERROR"
  | "IMAGE_OUT_OF_BOUNDS";

/** Additional error details */
export interface EPDErrorDetails {
  readonly [key: string]: unknown;
}

/**
 * Base error class for all EPD-related errors
 *
 * Provides consistent error handling across the driver
 */
export class EPDError extends Error {
  /** Error code identifier */
  public readonly code: EPDErrorCode;
  /** Additional error details */
  public readonly details?: EPDErrorDetails;

  constructor(message: string, code: EPDErrorCode, details?: EPDErrorDetails) {
    super(message);
    this.name = "EPDError";
    this.code = code;
    this.details = details;

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, EPDError);
    }
  }
}

/**
 * Error for VCOM voltage values outside valid range
 */
export class VCOMOutOfRangeError extends EPDError {
  constructor(value: number, min: number, max: number) {
    super(`VCOM ${value}V out of range [${min}V, ${max}V]`, "VCOM_OUT_OF_RANGE", {
      value,
      min,
      max,
    });
    this.name = "VCOMOutOfRangeError";
  }
}

/**
 * Error for SCSI command failures
 */
export class SCSIError extends EPDError {
  constructor(status: number, message?: string) {
    super(
      message ?? `SCSI command failed with status 0x${status.toString(16)}`,
      "SCSI_COMMAND_FAILED",
      { status },
    );
    this.name = "SCSIError";
  }
}

/**
 * Error when IT8951 device is not found
 */
export class DeviceNotFoundError extends EPDError {
  constructor(vendorId: number, productId: number) {
    super(
      `IT8951 device not found (VID: 0x${vendorId.toString(16)}, PID: 0x${productId.toString(16)})`,
      "DEVICE_NOT_FOUND",
      { vendorId, productId },
    );
    this.name = "DeviceNotFoundError";
  }
}

/**
 * Error for refresh rate violations
 */
export class RefreshRateError extends EPDError {
  constructor(interval: number, minInterval: number) {
    super(
      `Refresh interval ${interval}ms too short (minimum: ${minInterval}ms)`,
      "REFRESH_RATE_TOO_HIGH",
      { interval, minInterval },
    );
    this.name = "RefreshRateError";
  }
}

/**
 * Error for USB transfer failures
 */
export class USBTransferError extends EPDError {
  constructor(message: string) {
    super(`USB transfer error: ${message}`, "USB_TRANSFER_ERROR", { message });
    this.name = "USBTransferError";
  }
}

/**
 * Error for image operations out of bounds
 */
export class ImageOutOfBoundsError extends EPDError {
  constructor(
    x: number,
    y: number,
    width: number,
    height: number,
    maxWidth: number,
    maxHeight: number,
  ) {
    super(
      `Image area (${x}, ${y}, ${width}x${height}) exceeds display bounds (${maxWidth}x${maxHeight})`,
      "IMAGE_OUT_OF_BOUNDS",
      { x, y, width, height, maxWidth, maxHeight },
    );
    this.name = "ImageOutOfBoundsError";
  }
}

// =============================================================================
// Utility Functions
// =============================================================================

/** Valid bits per pixel values */
export type BitsPerPixel = 2 | 4 | 8;

/**
 * Calculate aligned row length for IT8951 buffer
 *
 * IT8951 requires 4-byte alignment for each row to ensure proper memory access
 *
 * @param width - Image width in pixels
 * @param bpp - Bits per pixel (2, 4, or 8)
 * @returns Aligned row length in bytes
 * @throws {RangeError} If invalid bpp value is provided
 */
export function alignRowLength(width: number, bpp: BitsPerPixel): number {
  if (bpp !== 2 && bpp !== 4 && bpp !== 8) {
    throw new RangeError(`Invalid bits per pixel: ${bpp}. Must be 2, 4, or 8.`);
  }

  const pixelsPerByte = 8 / bpp;
  const rowBytes = Math.ceil(width / pixelsPerByte);
  // 4-byte alignment requirement
  return Math.ceil(rowBytes / 4) * 4;
}

/**
 * Pad buffer to aligned row length
 *
 * Ensures image data meets IT8951's memory alignment requirements
 *
 * @param buffer - Original pixel buffer
 * @param width - Image width in pixels
 * @param bpp - Bits per pixel
 * @returns Padded buffer with proper alignment
 * @throws {RangeError} If buffer size doesn't match expected dimensions
 */
export function padBuffer(buffer: Uint8Array, width: number, bpp: BitsPerPixel): Uint8Array {
  const alignedWidth = alignRowLength(width, bpp);
  const pixelsPerByte = 8 / bpp;
  const originalRowBytes = Math.ceil(width / pixelsPerByte);

  if (alignedWidth === originalRowBytes) {
    return buffer;
  }

  const height = Math.floor(buffer.length / originalRowBytes);
  if (height * originalRowBytes !== buffer.length) {
    throw new RangeError(
      `Buffer size ${buffer.length} doesn't match expected dimensions ` +
        `(${width}x${Math.floor(buffer.length / originalRowBytes)} at ${bpp}bpp)`,
    );
  }

  const padded = new Uint8Array(alignedWidth * height);

  for (let y = 0; y < height; y++) {
    const srcOffset = y * originalRowBytes;
    const dstOffset = y * alignedWidth;
    padded.set(buffer.subarray(srcOffset, srcOffset + originalRowBytes), dstOffset);
  }

  return padded;
}

/**
 * Validate VCOM voltage value
 *
 * Checks if the provided VCOM voltage is within acceptable range
 *
 * @param vcom - VCOM voltage in volts (typically negative)
 * @returns True if valid, false otherwise
 */
export function isValidVCOM(vcom: number): boolean {
  return vcom > VCOM_RANGE.MIN && vcom < VCOM_RANGE.MAX;
}

/**
 * Convert rotation enum to degrees
 *
 * @param rotate - Rotation enum value
 * @returns Rotation angle in degrees (0, 90, 180, or 270)
 */
export function rotationToDegrees(rotate: Rotate): number {
  switch (rotate) {
    case Rotate.NONE:
      return 0;
    case Rotate.CW:
      return 90;
    case Rotate.FLIP:
      return 180;
    case Rotate.CCW:
      return 270;
    default:
      return 0;
  }
}

/**
 * Convert degrees to rotation enum
 *
 * @param degrees - Rotation angle in degrees (0, 90, 180, 270)
 * @returns Corresponding Rotate enum value
 * @throws {RangeError} If invalid degree value is provided
 */
export function degreesToRotation(degrees: number): Rotate {
  switch (degrees) {
    case 0:
      return Rotate.NONE;
    case 90:
      return Rotate.CW;
    case 180:
      return Rotate.FLIP;
    case 270:
      return Rotate.CCW;
    default:
      throw new RangeError(
        `Invalid rotation angle: ${degrees} degrees. Must be 0, 90, 180, or 270.`,
      );
  }
}

/**
 * Clamp a value to a specified range
 *
 * @param value - The value to clamp
 * @param min - Minimum allowed value
 * @param max - Maximum allowed value
 * @returns Clamped value
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Check if a rectangle intersects with display bounds
 *
 * @param x - Rectangle X coordinate
 * @param y - Rectangle Y coordinate
 * @param width - Rectangle width
 * @param height - Rectangle height
 * @param displayWidth - Display width
 * @param displayHeight - Display height
 * @returns True if the rectangle is at least partially within bounds
 */
export function isInBounds(
  x: number,
  y: number,
  width: number,
  height: number,
  displayWidth: number,
  displayHeight: number,
): boolean {
  return x < displayWidth && y < displayHeight && x + width > 0 && y + height > 0;
}

/**
 * Calculate the intersection of two rectangles
 *
 * @param x1 - First rectangle X
 * @param y1 - First rectangle Y
 * @param w1 - First rectangle width
 * @param h1 - First rectangle height
 * @param x2 - Second rectangle X
 * @param y2 - Second rectangle Y
 * @param w2 - Second rectangle width
 * @param h2 - Second rectangle height
 * @returns Intersection rectangle [x, y, width, height] or null if no intersection
 */
export function intersectRectangles(
  x1: number,
  y1: number,
  w1: number,
  h1: number,
  x2: number,
  y2: number,
  w2: number,
  h2: number,
): [number, number, number, number] | null {
  const x = Math.max(x1, x2);
  const y = Math.max(y1, y2);
  const width = Math.min(x1 + w1, x2 + w2) - x;
  const height = Math.min(y1 + h1, y2 + h2) - y;

  if (width <= 0 || height <= 0) {
    return null;
  }

  return [x, y, width, height];
}

// =============================================================================
// Pixel State Mapping (5-bit representation)
// =============================================================================

/**
 * Special pixel states for GLR16/GLD16 modes
 *
 * Based on E-paper Mode Declaration: states 29 and 31 invoke special transitions
 */
export const SPECIAL_PIXEL_STATES = {
  /** Special white transition state 29 */
  WHITE_TRANSITION_29: 29,
  /** Special white transition state 31 */
  WHITE_TRANSITION_31: 31,
} as const;

/**
 * Convert 16-level grayscale (0-15) to 5-bit pixel state (0, 2, 4, ... 30)
 *
 * Based on E-paper Mode Declaration:
 * - 16 graytones are assigned to even pixel states (0, 2, 4, ... 30)
 * - State 0 = black, State 30 = white
 *
 * @param gray16 - Grayscale level (0-15)
 * @returns Pixel state (0, 2, 4, ... 30)
 */
export function grayscaleToPixelState(gray16: number): number {
  return Math.min(30, Math.max(0, Math.floor(gray16)) * 2);
}

/**
 * Convert 5-bit pixel state to 16-level grayscale
 *
 * @param state - Pixel state (0-30, even values)
 * @returns Grayscale level (0-15)
 */
export function pixelStateToGrayscale(state: number): number {
  return Math.floor(state / 2);
}

/**
 * Convert 8-bit grayscale (0-255) to 5-bit pixel state
 *
 * @param gray8 - 8-bit grayscale value (0-255)
 * @returns Pixel state (0, 2, 4, ... 30)
 */
export function gray8ToPixelState(gray8: number): number {
  // Map 0-255 to 0-15, then to pixel state 0-30
  const gray16 = Math.floor(gray8 / 17); // 255/15 ≈ 17
  return grayscaleToPixelState(gray16);
}

/**
 * Quantize 8-bit grayscale to 4 levels for DU4 mode
 *
 * DU4 supports pixel states [0, 10, 20, 30] (4 gray levels)
 *
 * @param gray8 - 8-bit grayscale value (0-255)
 * @returns Quantized 8-bit value (0, 85, 170, or 255)
 */
export function quantizeTo4Levels(gray8: number): number {
  if (gray8 < 64) return 0; // Black (pixel state 0)
  if (gray8 < 128) return 85; // Dark gray (pixel state 10)
  if (gray8 < 192) return 170; // Light gray (pixel state 20)
  return 255; // White (pixel state 30)
}

/**
 * Quantize buffer to 4 levels for DU4 mode (in-place)
 *
 * @param buffer - Buffer to quantize
 */
export function quantizeBufferTo4Levels(buffer: Uint8Array): void {
  for (let i = 0; i < buffer.length; i++) {
    buffer[i] = quantizeTo4Levels(buffer[i]);
  }
}

/**
 * Binarize 8-bit grayscale for DU/A2 modes
 *
 * DU and A2 modes only support black (0) and white (255)
 *
 * @param gray8 - 8-bit grayscale value (0-255)
 * @param threshold - Threshold for binarization (default: 128)
 * @returns Binary value (0 or 255)
 */
export function binarize(gray8: number, threshold = 128): number {
  return gray8 < threshold ? 0 : 255;
}

/**
 * Binarize buffer for DU/A2 modes (in-place)
 *
 * @param buffer - Buffer to binarize
 * @param threshold - Threshold for binarization (default: 128)
 */
export function binarizeBuffer(buffer: Uint8Array, threshold = 128): void {
  for (let i = 0; i < buffer.length; i++) {
    buffer[i] = buffer[i] < threshold ? 0 : 255;
  }
}
