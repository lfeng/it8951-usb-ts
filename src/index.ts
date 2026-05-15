/**
 * IT8951 USB Display Driver
 *
 * Node.js + TypeScript driver for IT8951 e-paper display controllers
 *
 * @packageDocumentation
 * @module it8951-usb-ts
 */

// =============================================================================
// Constants and Enums
// =============================================================================

export {
  // USB IDs
  USB_VENDOR_ID,
  USB_PRODUCT_ID,

  // Command codes
  Commands,
  SCSICommands,

  // Display settings
  Rotate,
  PixelModes,
  DisplayModes,
  EndianTypes,
  Registers,

  // Configuration
  LOW_BPP_MODES,
  DEFAULT_DISPLAY_MODES,
  VCOM_PRESETS,
  VCOM_RANGE,
  DISPLAY_PRESETS,
  MODE_REFRESH_TIMES,

  // SCSI status
  SCSIStatus,

  // Error classes
  EPDError,
  VCOMOutOfRangeError,
  SCSIError,
  DeviceNotFoundError,
  RefreshRateError,
  USBTransferError,
  ImageOutOfBoundsError,

  // Utility functions
  alignRowLength,
  padBuffer,
  isValidVCOM,
  rotationToDegrees,
  degreesToRotation,
  clamp,
  isInBounds,
  intersectRectangles,
  grayscaleToPixelState,
  quantizeTo4Levels,
} from "./constants.js";

// =============================================================================
// Type Definitions
// =============================================================================

export type {
  // USB Interface types
  DeviceInfo,
  USBInterfaceOptions,
  IdentifyResult,
  SystemInfo,

  // EPD types
  EPDConfig,
  ImageArea,
  LoadImageOptions,
  IndexedBufferOptions,
  VCOMPreset,

  // Auto Display types
  AutoDisplayOptions,
  BoundingBox,
  RotationDirection,
  MemoryUsage,

  // General types
  BitsPerPixel,
  GrayscaleValue,
  Point,
  Dimensions,
  Region,
  EPDErrorCode,
  EPDErrorDetails,
  PaddingOptions,
  ValidationResult,
  Result,
  AsyncResult,
  ProgressCallback,
  BufferConfig,
  PerformanceStats,
  OrientationConfig,
  RefreshConfig,
  ImageProcessingOptions,
} from "./types.js";

// =============================================================================
// Classes
// =============================================================================

export { USBInterface } from "./usb-interface.js";
export { EPD } from "./epd.js";
export { AutoDisplay, AutoEPDDisplay } from "./auto-display.js";
