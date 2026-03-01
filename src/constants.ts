/**
 * IT8951 USB Display Controller Constants
 *
 * Based on the pyit8951 Python driver and IT8951 datasheet
 */

/** USB Vendor and Product IDs for IT8951 */
export const USB_VENDOR_ID = 0x048d; // ITE Tech. Inc.
export const USB_PRODUCT_ID = 0x8951; // IT8951

/** Command codes */
export enum Commands {
  SYS_RUN = 0x0001,
  STANDBY = 0x0002,
  SLEEP = 0x0003,
  REG_RD = 0x0010,
  REG_WR = 0x0011,
  MEM_BST_RD_T = 0x0012,
  MEM_BST_RD_S = 0x0013,
  MEM_BST_WR = 0x0014,
  MEM_BST_END = 0x0015,
  LD_IMG = 0x0020,
  LD_IMG_AREA = 0x0021,
  LD_IMG_END = 0x0022,

  // User-defined commands from Waveshare
  DPY_AREA = 0x0034,
  GET_DEV_INFO = 0x0302,
  DPY_BUF_AREA = 0x0037,
  VCOM = 0x0039,
}

/** Rotation modes */
export enum Rotate {
  NONE = 0,
  CW = 1, // 90° clockwise
  FLIP = 2, // 180° rotation
  CCW = 3, // 90° counter-clockwise
}

/** Pixel formats (bits per pixel) - Removed non-standard 3bpp */
export enum PixelModes {
  M_2BPP = 0,
  M_4BPP = 1,
  M_8BPP = 2,
}

/** Display waveform modes */
export enum DisplayModes {
  INIT = 0, // Initialization mode (full screen flash)
  DU = 1, // Direct Update (fast, grayscale)
  GC16 = 2, // Grayscale 16 (high quality)
  GL16 = 3, // Grayscale 16 (optimized)
  GLR16 = 4, // Grayscale 16 with remap
  GLD16 = 5, // Grayscale 16 with dither
  A2 = 6, // Animation mode 2 (fast)
  DU4 = 7, // Direct Update 4 (fast, 4-level)
}

/** Display modes that only require 2bpp */
export const LOW_BPP_MODES: Set<DisplayModes> = new Set([
  DisplayModes.INIT,
  DisplayModes.DU,
  DisplayModes.DU4,
  DisplayModes.A2,
]);

/** Endian types */
export enum EndianTypes {
  LITTLE = 0,
  BIG = 1,
}

/** Device registers */
export enum Registers {
  DBASE = 0x1000, // Base address for register R/W access (I80 only)

  LUT0EWHR = 0x1000, // LUT0 engine width height
  LUT0XYR = 0x1040, // LUT0 XY
  LUT0BADDR = 0x1080, // LUT0 base address
  LUT0MFN = 0x10c0, // LUT0 mode and frame number
  LUT01AF = 0x1114, // LUT0/LUT1 active flag

  UP0SR = 0x1134, // Update parameter0 setting
  UP1SR = 0x1138, // Update parameter1 setting
  LUT0ABFRV = 0x113c, // LUT0 alpha blend and fill rectangle value
  UPBBADDR = 0x117c, // Update buffer base address
  LUT0IMXY = 0x1180, // LUT0 image buffer X/Y offset
  LUTAFSR = 0x1224, // LUT status (status of all LUT engines)

  BGVR = 0x1250, // Bitmap (1bpp) image color table

  I80CPCR = 0x0004,

  MBASE = 0x200,
  MCSR = 0x200,
  LISAR = 0x208,
}

/** Default display modes for common use cases */
export const DEFAULT_DISPLAY_MODES = {
  /** Fast update for text/line drawings */
  FAST: DisplayModes.DU,
  /** High quality for images */
  HIGH_QUALITY: DisplayModes.GC16,
  /** Animation/video */
  ANIMATION: DisplayModes.A2,
  /** Full refresh to clear ghosting */
  FULL_REFRESH: DisplayModes.INIT,
} as const;

/**
 * VCOM voltage presets for common e-paper displays
 */
export const VCOM_PRESETS = {
  WAVESHARE_6INCH: -1.5,
  WAVESHARE_7_8INCH: -2.3,
  WAVESHARE_10_3INCH: -2.0,
  DEFAULT: -2.0,
} as const;

/** SCSI status codes */
export enum SCSIStatus {
  GOOD = 0x00,
  CHECK_CONDITION = 0x02,
  CONDITION_MET = 0x04,
  BUSY = 0x08,
  INTERMEDIATE = 0x10,
  INTERMEDIATE_CONDITION_MET = 0x14,
  RESERVATION_CONFLICT = 0x18,
}

/** EPD error classes */
export class EPDError extends Error {
  public code: string;
  public details?: any;
  constructor(message: string, code: string, details?: any) {
    super(message);
    this.name = 'EPDError';
    this.code = code;
    this.details = details;
  }
}

export class VCOMOutOfRangeError extends EPDError {
  constructor(value: number, min: number, max: number) {
    super(`VCOM ${value}V out of range [${min}V, ${max}V]`, 'VCOM_OUT_OF_RANGE', { value, min, max });
    this.name = 'VCOMOutOfRangeError';
  }
}

export class SCSIError extends EPDError {
  constructor(status: number, senseData?: any) {
    super(`SCSI command failed with status 0x${status.toString(16)}`, 'SCSI_COMMAND_FAILED', { status, senseData });
    this.name = 'SCSIError';
  }
}

export class DeviceNotFoundError extends EPDError {
  constructor(vendorId: number, productId: number) {
    super(`IT8951 device not found (VID: 0x${vendorId.toString(16)}, PID: 0x${productId.toString(16)})`, 'DEVICE_NOT_FOUND', { vendorId, productId });
    this.name = 'DeviceNotFoundError';
  }
}

export class RefreshRateError extends EPDError {
  constructor(interval: number, minInterval: number) {
    super(`Refresh interval ${interval}ms too short (minimum: ${minInterval}ms)`, 'REFRESH_RATE_TOO_HIGH', { interval, minInterval });
    this.name = 'RefreshRateError';
  }
}

/**
 * Calculate aligned row length for IT8951 buffer
 * IT8951 requires 4-byte alignment for each row
 * @param width - Image width in pixels
 * @param bpp - Bits per pixel (2, 4, or 8)
 * @returns Aligned row length in bytes
 */
export function alignRowLength(width: number, bpp: number): number {
  const pixelsPerByte = 8 / bpp;
  const rowBytes = Math.ceil(width / pixelsPerByte);
  // 4-byte alignment
  return Math.ceil(rowBytes / 4) * 4;
}

/**
 * Pad buffer to aligned row length
 * @param buffer - Original pixel buffer
 * @param width - Image width in pixels
 * @param bpp - Bits per pixel
 * @returns Padded buffer
 */
export function padBuffer(buffer: Uint8Array, width: number, bpp: number): Uint8Array {
  const alignedWidth = alignRowLength(width, bpp);
  const pixelsPerByte = 8 / bpp;
  const originalRowBytes = Math.ceil(width / pixelsPerByte);
  
  if (alignedWidth === originalRowBytes) {
    return buffer;
  }
  
  const height = buffer.length / originalRowBytes;
  const padded = new Uint8Array(alignedWidth * height);
  
  for (let y = 0; y < height; y++) {
    const srcOffset = y * originalRowBytes;
    const dstOffset = y * alignedWidth;
    padded.set(buffer.subarray(srcOffset, srcOffset + originalRowBytes), dstOffset);
  }
  
  return padded;
}
