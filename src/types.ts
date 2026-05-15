/**
 * IT8951 USB Display Driver - Type Definitions
 *
 * Centralized type definitions for the IT8951 e-paper display driver.
 * Based on IT8951 V0.2.4.3 datasheet and 7.8inch e-Paper Specification.
 */

// =============================================================================
// Re-exports from other modules for convenience
// =============================================================================

export type {
  DeviceInfo,
  USBInterfaceOptions,
  IdentifyResult,
  SystemInfo,
} from "./usb-interface.js";
export type {
  EPDConfig,
  ImageArea,
  LoadImageOptions,
  IndexedBufferOptions,
  VCOMPreset,
} from "./epd.js";
export type {
  AutoDisplayOptions,
  BoundingBox,
  RotationDirection,
  MemoryUsage,
} from "./auto-display.js";

// =============================================================================
// Image Processing Types
// =============================================================================

/**
 * Grayscale value (0-255)
 */
export type GrayscaleValue = number;

/**
 * Pixel coordinate
 */
export interface Point {
  /** X coordinate */
  readonly x: number;
  /** Y coordinate */
  readonly y: number;
}

/**
 * Rectangle dimensions
 */
export interface Dimensions {
  /** Width in pixels */
  readonly width: number;
  /** Height in pixels */
  readonly height: number;
}

/**
 * Region of interest (point + dimensions)
 */
export interface Region extends Point, Dimensions {}

// =============================================================================
// Error Types
// =============================================================================

/**
 * Error code types for EPD errors
 */
export type EPDErrorCode =
  | "VCOM_OUT_OF_RANGE"
  | "SCSI_COMMAND_FAILED"
  | "DEVICE_NOT_FOUND"
  | "REFRESH_RATE_TOO_HIGH"
  | "DEVICE_NOT_INITIALIZED"
  | "INVALID_BUFFER_INDEX"
  | "USB_TRANSFER_ERROR"
  | "IMAGE_OUT_OF_BOUNDS";

/**
 * Error details structure
 */
export interface EPDErrorDetails {
  readonly [key: string]: unknown;
}

// =============================================================================
// Utility Types
// =============================================================================

/**
 * Bits per pixel supported by IT8951
 */
export type BitsPerPixel = 2 | 4 | 8;

/**
 * Buffer padding options
 */
export interface PaddingOptions {
  /** Target alignment in bytes (default: 4) */
  readonly alignment?: number;
  /** Fill value for padding (default: 0) */
  readonly fillValue?: number;
}

/**
 * Validation result for parameter checking
 */
export interface ValidationResult {
  /** Whether validation passed */
  readonly isValid: boolean;
  /** Error message if validation failed */
  readonly errorMessage?: string;
  /** Additional validation details */
  readonly details?: Readonly<Record<string, unknown>>;
}

/**
 * Generic result type for operations that may fail
 */
export type Result<T> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: Error };

/**
 * Async result type for promise-based operations
 */
export type AsyncResult<T> = Promise<Result<T>>;

/**
 * Progress callback for long-running operations
 */
export type ProgressCallback = (progress: number, message?: string) => void;

/**
 * Configuration for buffer management
 */
export interface BufferConfig {
  /** Maximum number of buffers to maintain */
  readonly maxBuffers?: number;
  /** Buffer size in bytes */
  readonly bufferSize?: number;
  /** Whether to reuse buffers */
  readonly reuseBuffers?: boolean;
}

/**
 * Statistics for performance monitoring
 */
export interface PerformanceStats {
  /** Total operations performed */
  readonly totalOperations: number;
  /** Successful operations */
  readonly successfulOperations: number;
  /** Failed operations */
  readonly failedOperations: number;
  /** Average operation time in milliseconds */
  readonly averageTime: number;
  /** Peak memory usage in bytes */
  readonly peakMemory: number;
}

// =============================================================================
// Display Configuration Types
// =============================================================================

/**
 * Display orientation settings
 */
export interface OrientationConfig {
  /** Rotation angle in degrees (0, 90, 180, 270) */
  readonly rotation?: 0 | 90 | 180 | 270;
  /** Mirror horizontally */
  readonly mirrorX?: boolean;
  /** Mirror vertically */
  readonly mirrorY?: boolean;
}

/**
 * Refresh rate configuration
 */
export interface RefreshConfig {
  /** Minimum interval between refreshes in milliseconds */
  readonly minInterval?: number;
  /** Enable automatic refresh rate limiting */
  readonly enableLimiting?: boolean;
}

/**
 * Image processing options
 */
export interface ImageProcessingOptions {
  /** Target bits per pixel */
  readonly targetBpp?: BitsPerPixel;
  /** Enable dithering */
  readonly dithering?: boolean;
  /** Contrast adjustment (-100 to 100) */
  readonly contrast?: number;
  /** Brightness adjustment (-100 to 100) */
  readonly brightness?: number;
}
