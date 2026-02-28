/**
 * IT8951 USB Display Controller Constants
 * 
 * Based on the pyit8951 Python driver and IT8951 datasheet
 */

/** USB Vendor and Product IDs for IT8951 */
export const USB_VENDOR_ID = 0x0416;  // Winbond Electronics Corp
export const USB_PRODUCT_ID = 0x5020; // IT8951

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
  CW = 1,    // 90° clockwise
  FLIP = 2,  // 180° rotation
  CCW = 3,   // 90° counter-clockwise
}

/** Pixel formats (bits per pixel) */
export enum PixelModes {
  M_2BPP = 0,
  M_3BPP = 1,
  M_4BPP = 2,
  M_8BPP = 3,
}

/** Display waveform modes */
export enum DisplayModes {
  INIT = 0,   // Initialization mode (full screen flash)
  DU = 1,     // Direct Update (fast, grayscale)
  GC16 = 2,   // Grayscale 16 (high quality)
  GL16 = 3,   // Grayscale 16 (optimized)
  GLR16 = 4,  // Grayscale 16 with remap
  GLD16 = 5,  // Grayscale 16 with dither
  A2 = 6,     // Animation mode 2 (fast)
  DU4 = 7,    // Direct Update 4 (fast, 4-level)
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
  
  LUT0EWHR = 0x1000,  // LUT0 engine width height
  LUT0XYR = 0x1040,   // LUT0 XY
  LUT0BADDR = 0x1080, // LUT0 base address
  LUT0MFN = 0x10C0,   // LUT0 mode and frame number
  LUT01AF = 0x1114,   // LUT0/LUT1 active flag
  
  UP0SR = 0x1134,  // Update parameter0 setting
  UP1SR = 0x1138,  // Update parameter1 setting
  LUT0ABFRV = 0x113C, // LUT0 alpha blend and fill rectangle value
  UPBBADDR = 0x117C, // Update buffer base address
  LUT0IMXY = 0x1180, // LUT0 image buffer X/Y offset
  LUTAFSR = 0x1224,  // LUT status (status of all LUT engines)
  
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
