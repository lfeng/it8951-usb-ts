/**
 * EPD (Electronic Paper Display) Controller
 *
 * High-level interface for controlling IT8951 e-paper displays via USB SCSI.
 * Provides image loading, display updates, and power management functionality.
 *
 * @example
 * ```typescript
 * const epd = new EPD({ vcom: -2.0 });
 * await epd.init();
 * await epd.clear();
 * await epd.display(imageBuffer, DisplayModes.GC16);
 * await epd.close();
 * ```
 */

import { USBInterface, DeviceInfo, IdentifyResult } from "./usb-interface.js";
import {
  DisplayModes,
  Rotate,
  VCOM_PRESETS,
  RefreshRateError,
  EndianTypes,
  VCOMOutOfRangeError,
  VCOM_RANGE,
  isValidVCOM,
  MODE_REFRESH_TIMES,
  DISPLAY_PRESETS,
} from "./constants.js";

// =============================================================================
// Type Definitions
// =============================================================================

/**
 * VCOM preset names for common e-paper displays
 */
export type VCOMPreset = keyof typeof VCOM_PRESETS;

/**
 * Configuration options for EPD controller
 */
export interface EPDConfig {
  /**
   * VCOM voltage in volts (typically -1.5 to -2.5)
   * Can also use preset name: 'WAVESHARE_6INCH', 'WAVESHARE_7_8INCH', 'WAVESHARE_10_3INCH', 'DEFAULT'
   */
  readonly vcom?: number | VCOMPreset;
  /** USB timeout in milliseconds (default: 5000) */
  readonly timeout?: number;
  /** Minimum refresh interval in milliseconds to prevent display damage (default: 1000) */
  readonly minRefreshInterval?: number;
  /** VCOM byte order for USB communication (default: BIG endian, matching the USB programming guide) */
  readonly vcomEndian?: EndianTypes;
}

/**
 * Image area specification for partial updates
 */
export interface ImageArea {
  /** X coordinate (horizontal position) */
  readonly x: number;
  /** Y coordinate (vertical position) */
  readonly y: number;
  /** Width in pixels */
  readonly width: number;
  /** Height in pixels */
  readonly height: number;
}

/**
 * Options for loading image data
 */
export interface LoadImageOptions {
  /** X coordinate (default: 0) */
  readonly x?: number;
  /** Y coordinate (default: 0) */
  readonly y?: number;
  /** Source image width (auto-calculated if not specified) */
  readonly width?: number;
  /** Source image height (auto-calculated if not specified) */
  readonly height?: number;
  /** Rotation mode (default: NONE) */
  readonly rotate?: Rotate;
}

/**
 * Options for indexed buffer operations
 */
export interface IndexedBufferOptions extends LoadImageOptions {
  /** Buffer index (0-15) for indexed mode operations */
  readonly index: number;
}

// =============================================================================
// EPD Controller Class
// =============================================================================

/**
 * Main EPD controller class for IT8951 e-paper displays
 *
 * This class provides a high-level interface for:
 * - Device initialization and configuration
 * - Image loading and display updates
 * - Partial refresh support
 * - Power management
 * - Refresh rate protection
 */
export class EPD {
  private readonly usb: USBInterface;
  private vcom: number;
  private readonly minRefreshInterval: number;
  private lastRefreshTime: number = 0;

  // Device info (populated after init)
  private _width: number | null = null;
  private _height: number | null = null;
  private _imageBufferAddress: number | null = null;
  private _firmwareVersion: string | null = null;
  private _lutVersion: string | null = null;
  private _numBuffers: number = 1;
  private _temperatureNo: number = 0;
  private _modeNo: number = 0;
  private _identifyResult: IdentifyResult | null = null;

  /**
   * Number of image buffers supported by device (v0.3+)
   */
  get numBuffers(): number {
    return this._numBuffers;
  }

  /**
   * Number of temperature segments
   */
  get temperatureNo(): number {
    return this._temperatureNo;
  }

  /**
   * Number of display modes supported
   */
  get modeNo(): number {
    return this._modeNo;
  }

  /**
   * Creates a new EPD controller instance
   *
   * @param config - Configuration options
   */
  constructor(config: EPDConfig = {}) {
    // Handle VCOM preset or direct value
    if (typeof config.vcom === "string") {
      this.vcom = VCOM_PRESETS[config.vcom] ?? VCOM_PRESETS.DEFAULT;
    } else {
      this.vcom = config.vcom ?? VCOM_PRESETS.DEFAULT;
    }
    this.minRefreshInterval = config.minRefreshInterval ?? 1000;
    this.usb = new USBInterface({
      timeout: config.timeout,
      vcomEndian: config.vcomEndian ?? EndianTypes.BIG, // IT8951 uses BIG endian for VCOM
    });
  }

  // =============================================================================
  // Property Getters
  // =============================================================================

  /**
   * Display width in pixels
   *
   * @throws {Error} If device has not been initialized
   */
  get width(): number {
    this.ensureInitialized();
    return this._width!;
  }

  /**
   * Display height in pixels
   *
   * @throws {Error} If device has not been initialized
   */
  get height(): number {
    this.ensureInitialized();
    return this._height!;
  }

  /**
   * Image buffer address in device memory
   *
   * @throws {Error} If device has not been initialized
   */
  get imageBufferAddress(): number {
    this.ensureInitialized();
    return this._imageBufferAddress!;
  }

  /**
   * Firmware version string
   *
   * @throws {Error} If device has not been initialized
   */
  get firmwareVersion(): string {
    this.ensureInitialized();
    return this._firmwareVersion!;
  }

  /**
   * LUT version string
   *
   * @throws {Error} If device has not been initialized
   */
  get lutVersion(): string {
    this.ensureInitialized();
    return this._lutVersion!;
  }

  /**
   * Current VCOM voltage setting
   */
  get currentVCOM(): number {
    return this.vcom;
  }

  // =============================================================================
  // Initialization
  // =============================================================================

  /**
   * Initialize the display
   *
   * Opens the USB connection, verifies device identity, retrieves device information,
   * and sets VCOM voltage.
   *
   * @throws {DeviceNotFoundError} If device is not found
   * @throws {USBTransferError} If USB communication fails
   * @throws {VCOMOutOfRangeError} If VCOM voltage is invalid
   * @throws {SCSIError} If device identity verification fails
   */
  async init(): Promise<void> {
    await this.usb.open();

    // Verify device identity using SCSI INQUIRY command
    this._identifyResult = await this.usb.identify();
    if (!this._identifyResult.isIT8951) {
      console.warn(
        `Warning: Device may not be IT8951 controller. ` +
          `Product: ${this._identifyResult.productId}, Vendor: ${this._identifyResult.vendorId}`,
      );
    }

    // Get device information
    const info = await this.usb.getDeviceInfo();
    this._width = info.width;
    this._height = info.height;
    this._imageBufferAddress = info.imageBufferAddress;
    this._firmwareVersion = info.firmwareVersion;
    this._lutVersion = info.lutVersion;
    this._numBuffers = info.numImgBuf ?? 1;
    this._temperatureNo = info.temperatureNo ?? 0;
    this._modeNo = info.modeNo ?? 0;

    // Log device dimensions for debugging (7.8inch/10.3inch: 1872×1404)
    const preset7_8 = DISPLAY_PRESETS.WAVESHARE_7_8INCH;
    if (this._width === preset7_8.width && this._height === preset7_8.height) {
      console.log(`Detected 7.8-inch display: ${this._width}×${this._height}`);
    } else {
      console.log(`Display resolution: ${this._width}×${this._height}`);
    }

    // Set VCOM voltage and power on
    await this.setVCOM(this.vcom);

    // Wait for device to initialize after VCOM setting
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  /**
   * Close the connection to the display
   *
   * Releases USB resources. Safe to call multiple times.
   */
  close(): void {
    this.usb.close();
  }

  // =============================================================================
  // Image Loading
  // =============================================================================

  /**
   * Load image data to device memory
   *
   * Automatically crops the image to fit within display bounds and handles
   * images positioned partially outside the visible area.
   *
   * @param buffer - Pixel data (1 byte per pixel, values 0-255 grayscale). Can be Buffer or Uint8Array.
   * @param options - Optional area and rotation settings
   * @throws {USBTransferError} If USB transfer fails
   */
  async loadImageArea(buffer: Buffer | Uint8Array, options: LoadImageOptions = {}): Promise<void> {
    this.ensureInitialized();

    // Fast path: Full screen image with no options - bypass prepareImageData
    const isFullScreen =
      options.x === undefined &&
      options.y === undefined &&
      options.width === undefined &&
      options.height === undefined &&
      buffer.length === this.width * this.height;

    if (isFullScreen) {
      // Direct path: use Buffer directly if already Buffer, otherwise convert
      const imageData = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
      await this.usb.loadImageArea(0, 0, this.width, this.height, imageData);
      return;
    }

    // Normal path: process through prepareImageData
    // prepareImageData expects Uint8Array
    const inputBuffer = Buffer.isBuffer(buffer) ? new Uint8Array(buffer) : buffer;
    const { x, y, width, height, croppedData } = this.prepareImageData(inputBuffer, options);

    // Skip if entirely outside device bounds
    if (croppedData.length === 0) {
      console.warn("Warning: Image is entirely outside the visible device area");
      return;
    }

    // Convert Uint8Array to Buffer for USB transfer
    const imageData = Buffer.from(croppedData);

    await this.usb.loadImageArea(x, y, width, height, imageData);
  }

  /**
   * Load image data to an indexed buffer location in device memory
   *
   * Indexed mode allows up to 16 separate image buffers (index 0-15).
   *
   * @param index - Buffer index (0-15)
   * @param buffer - Pixel data (1 byte per pixel, values 0-255 grayscale)
   * @param options - Optional area and rotation settings
   * @throws {RangeError} If buffer index is out of range (0-15)
   * @throws {USBTransferError} If USB transfer fails
   */
  async loadImageAreaIndexed(
    index: number,
    buffer: Uint8Array,
    options: Omit<LoadImageOptions, "rotate"> = {},
  ): Promise<void> {
    this.ensureInitialized();

    if (index < 0 || index > 15) {
      throw new RangeError(`Buffer index ${index} out of range (0-15)`);
    }

    const { x, y, width, height, croppedData } = this.prepareImageData(buffer, options);

    // Skip if entirely outside device bounds
    if (croppedData.length === 0) {
      console.warn("Warning: Image is entirely outside the visible device area");
      return;
    }

    // Convert Uint8Array to Buffer for USB transfer
    const imageData = Buffer.from(croppedData);

    await this.usb.loadImageAreaIndexed(index, x, y, width, height, imageData);
  }

  // =============================================================================
  // Display Updates
  // =============================================================================

  /**
   * Display a region of the image buffer
   *
   * @param x - X coordinate
   * @param y - Y coordinate
   * @param width - Width of region
   * @param height - Height of region
   * @param mode - Display mode
   * @throws {RefreshRateError} If refresh interval is too short
   * @throws {USBTransferError} If USB transfer fails
   */
  async displayArea(
    x: number,
    y: number,
    width: number,
    height: number,
    mode: DisplayModes,
  ): Promise<void> {
    this.ensureInitialized();
    this.checkRefreshRate();

    await this.usb.displayArea(x, y, width, height, mode, true);
  }

  /**
   * Display a region from an indexed buffer location
   *
   * @param index - Buffer index (0-15)
   * @param x - X coordinate
   * @param y - Y coordinate
   * @param width - Width of region
   * @param height - Height of region
   * @param mode - Display mode
   * @throws {RangeError} If buffer index is out of range (0-15)
   * @throws {RefreshRateError} If refresh interval is too short
   * @throws {USBTransferError} If USB transfer fails
   */
  async displayAreaIndexed(
    index: number,
    x: number,
    y: number,
    width: number,
    height: number,
    mode: DisplayModes,
  ): Promise<void> {
    this.ensureInitialized();

    if (index < 0 || index > 15) {
      throw new RangeError(`Buffer index ${index} out of range (0-15)`);
    }

    this.checkRefreshRate();

    await this.usb.displayAreaIndexed(index, x, y, width, height, mode, true);
  }

  /**
   * Display a full image on the screen
   *
   * @param buffer - Image data (grayscale, 1 byte per pixel)
   * @param mode - Display mode (default: GC16 for best quality)
   * @throws {RefreshRateError} If refresh interval is too short
   */
  async display(buffer: Uint8Array, mode: DisplayModes = DisplayModes.GC16): Promise<void> {
    this.ensureInitialized();

    // Validate buffer size
    const expectedSize = this.width * this.height;
    if (buffer.length !== expectedSize) {
      console.warn(
        `Buffer size (${buffer.length}) doesn't match display size (${expectedSize}). ` +
          "Image will be adjusted.",
      );
    }

    await this.loadImageArea(buffer);
    await this.displayArea(0, 0, this.width, this.height, mode);
  }

  /**
   * Display with automatic ghost removal for fast modes
   *
   * For modes that may cause ghosting (DU, A2, DU4), automatically performs
   * a second GC16 refresh to stabilize the display.
   *
   * @param buffer - Image data (grayscale, 1 byte per pixel)
   * @param mode - Display mode
   * @throws {RefreshRateError} If refresh interval is too short
   */
  async displayWithGhostRemoval(buffer: Uint8Array, mode: DisplayModes): Promise<void> {
    await this.display(buffer, mode);

    // For fast update modes, do a GC16 refresh to eliminate ghosting
    if (mode === DisplayModes.DU || mode === DisplayModes.A2 || mode === DisplayModes.DU4) {
      // Wait for mode-specific refresh time
      await this.waitForMode(mode);
      await this.displayArea(0, 0, this.width, this.height, DisplayModes.GC16);
    }
  }

  /**
   * Display a partial update
   *
   * @param buffer - Image data for the region
   * @param x - X coordinate
   * @param y - Y coordinate
   * @param width - Width
   * @param height - Height
   * @param mode - Display mode (default: DU for fast update)
   * @throws {RefreshRateError} If refresh interval is too short
   */
  async displayPartial(
    buffer: Uint8Array,
    x: number,
    y: number,
    width: number,
    height: number,
    mode: DisplayModes = DisplayModes.DU,
  ): Promise<void> {
    this.ensureInitialized();

    await this.loadImageArea(buffer, { x, y, width, height });
    await this.displayArea(x, y, width, height, mode);
  }

  // =============================================================================
  // A2 Animation Mode Methods
  // =============================================================================

  /**
   * Enter A2 animation mode
   *
   * According to E-paper Mode Declaration document, display a white image
   * using GC16 mode before entering A2 mode to reduce ghosting.
   *
   * @throws {RefreshRateError} If refresh interval is too short
   */
  async enterA2Mode(): Promise<void> {
    this.ensureInitialized();

    // Display white image with GC16 before switching to A2
    const whiteBuffer = new Uint8Array(this.width * this.height).fill(0xff);
    await this.loadImageArea(whiteBuffer);
    await this.displayArea(0, 0, this.width, this.height, DisplayModes.GC16);
    await this.waitForMode(DisplayModes.GC16);
  }

  /**
   * Exit A2 animation mode
   *
   * According to E-paper Mode Declaration document, display a white image
   * using GC16 mode after A2 sequence to reduce residual ghosting.
   *
   * @throws {RefreshRateError} If refresh interval is too short
   */
  async exitA2Mode(): Promise<void> {
    this.ensureInitialized();

    // Display white image with GC16 after A2 sequence
    const whiteBuffer = new Uint8Array(this.width * this.height).fill(0xff);
    await this.loadImageArea(whiteBuffer);
    await this.displayArea(0, 0, this.width, this.height, DisplayModes.GC16);
    await this.waitForMode(DisplayModes.GC16);
  }

  /**
   * Display a sequence of frames in A2 animation mode
   *
   * Automatically handles entering and exiting A2 mode with proper
   * transitions to minimize ghosting.
   *
   * @param frames - Array of frame buffers (each frame is full-screen grayscale)
   * @param frameDelay - Delay between frames in ms (default: 0, waits for A2 refresh only)
   * @throws {RefreshRateError} If refresh interval is too short
   */
  async displayA2Sequence(frames: Uint8Array[], frameDelay: number = 0): Promise<void> {
    this.ensureInitialized();

    if (frames.length === 0) return;

    // Enter A2 mode (display white with GC16)
    await this.enterA2Mode();

    // Display each frame with A2 mode (~120ms per frame)
    for (const frame of frames) {
      await this.loadImageArea(frame);
      await this.displayArea(0, 0, this.width, this.height, DisplayModes.A2);

      // Wait for A2 refresh (120ms) + optional additional delay
      const a2Time = this.getRefreshIntervalForMode(DisplayModes.A2);
      await new Promise((resolve) => setTimeout(resolve, a2Time + frameDelay));
    }

    // Exit A2 mode (display white with GC16)
    await this.exitA2Mode();
  }

  // =============================================================================
  // Fast Memory Write Methods
  // =============================================================================

  /**
   * Load image data using fast memory write (FAST_WRITE_MEM 0xa5)
   *
   * Achieves up to 30MB/s transfer speed. Best for large images or
   * frequent full-screen updates.
   *
   * @param buffer - Pixel data (1 byte per pixel, grayscale)
   * @param options - Optional area settings (x, y position)
   * @throws {USBTransferError} If USB transfer fails
   */
  async loadImageAreaFast(buffer: Uint8Array, options: LoadImageOptions = {}): Promise<void> {
    this.ensureInitialized();

    const x = options.x ?? 0;
    const y = options.y ?? 0;

    // Calculate memory address for the target area
    const address = this._imageBufferAddress! + y * this.width + x;
    const imageData = Buffer.from(buffer);

    await this.usb.fastWriteMemory(address, imageData);
  }

  // =============================================================================
  // Power Management
  // =============================================================================

  /**
   * Set VCOM voltage
   *
   * @param vcom - VCOM voltage (typically -1.5 to -2.5)
   * @throws {VCOMOutOfRangeError} If VCOM voltage is outside the valid range
   * @throws {USBTransferError} If USB transfer fails
   */
  async setVCOM(vcom: number): Promise<void> {
    this.validateVCOM(vcom);
    const vcomInt = Math.round(-1000 * vcom);
    await this.usb.setPowerVcom(vcomInt, true);
    this.vcom = vcom;
  }

  /**
   * Get current VCOM voltage
   *
   * @returns Current VCOM voltage value
   * @remarks USB SCSI interface does not support reading VCOM from device, returns the last set value
   */
  async getVCOM(): Promise<number> {
    return this.vcom;
  }

  /**
   * Put device in standby mode (power off display)
   *
   * @throws {USBTransferError} If USB transfer fails
   */
  async standby(): Promise<void> {
    await this.usb.setPowerVcom(null, false);
  }

  /**
   * Put device in sleep mode
   *
   * @throws {USBTransferError} If USB transfer fails
   */
  async sleep(): Promise<void> {
    await this.usb.setPowerVcom(null, false);
  }

  /**
   * Wake up / run system
   *
   * @throws {USBTransferError} If USB transfer fails
   */
  async run(): Promise<void> {
    await this.usb.setPowerVcom(null, true);
  }

  // =============================================================================
  // Utility Methods
  // =============================================================================

  /**
   * Wait for display to be ready
   *
   * Note: With USB SCSI, the displayArea command waits internally when waitReady=true
   */
  async waitDisplayReady(): Promise<void> {
    // USB SCSI displayArea with waitReady=true handles this
    return;
  }

  /**
   * Clear the display (fill with white)
   *
   * Uses a multi-stage refresh optimized for 16-grayscale displays:
   * 1. INIT mode - Complete panel reset (~2000ms)
   * 2. GC16 mode - Full quality refresh to stabilize
   *
   * @throws {RefreshRateError} If refresh interval is too short
   */
  async clear(): Promise<void> {
    this.ensureInitialized();

    // Fill buffer with white (0xFF = pixel state 30 = white)
    // Use Buffer.alloc directly for best compatibility
    const bufferSize = this.width * this.height;
    const whiteBuffer = Buffer.alloc(bufferSize, 0xff);

    // Stage 1: Load white data and do INIT refresh (complete panel reset)
    await this.usb.loadImageArea(0, 0, this.width, this.height, whiteBuffer);
    await this.displayArea(0, 0, this.width, this.height, DisplayModes.INIT);
    // Wait for INIT mode to complete (~2000ms according to spec)
    await this.waitForMode(DisplayModes.INIT);

    // Stage 2: GC16 refresh to stabilize and eliminate any remaining ghosting
    await this.displayArea(0, 0, this.width, this.height, DisplayModes.GC16);
    await this.waitForMode(DisplayModes.GC16);
  }

  /**
   * Get device information
   *
   * @returns Device information object
   * @throws {Error} If device has not been initialized
   */
  getDeviceInfo(): DeviceInfo {
    this.ensureInitialized();

    return {
      width: this._width!,
      height: this._height!,
      imageBufferAddress: this._imageBufferAddress!,
      firmwareVersion: this._firmwareVersion!,
      lutVersion: this._lutVersion!,
    };
  }

  // =============================================================================
  // Private Methods
  // =============================================================================

  /**
   * Ensure device is initialized
   *
   * @throws {Error} If device has not been initialized
   */
  private ensureInitialized(): void {
    if (this._width === null || this._height === null) {
      throw new Error("Device not initialized. Call init() first.");
    }
  }

  /**
   * Check refresh rate and update last refresh time
   *
   * @throws {RefreshRateError} If refresh interval is too short
   */
  private checkRefreshRate(): void {
    if (this.lastRefreshTime > 0) {
      const now = Date.now();
      const interval = now - this.lastRefreshTime;
      if (interval < this.minRefreshInterval) {
        throw new RefreshRateError(interval, this.minRefreshInterval);
      }
    }
    this.lastRefreshTime = Date.now();
  }

  /**
   * Get refresh interval for a specific display mode based on official specs
   *
   * @param mode - Display mode
   * @returns Refresh time in milliseconds
   */
  private getRefreshIntervalForMode(mode: DisplayModes): number {
    return MODE_REFRESH_TIMES[mode] ?? 500;
  }

  /**
   * Wait for a display mode refresh to complete
   *
   * @param mode - Display mode to wait for
   */
  private async waitForMode(mode: DisplayModes): Promise<void> {
    const interval = this.getRefreshIntervalForMode(mode);
    await new Promise((resolve) => setTimeout(resolve, interval + 50));
    // Reset lastRefreshTime after waiting - display is now ready for next refresh
    this.lastRefreshTime = 0;
  }

  /**
   * Validate VCOM voltage range
   *
   * @param vcom - VCOM voltage to validate
   * @throws {VCOMOutOfRangeError} If VCOM is outside valid range
   */
  private validateVCOM(vcom: number): void {
    if (!isValidVCOM(vcom)) {
      throw new VCOMOutOfRangeError(vcom, VCOM_RANGE.MIN, VCOM_RANGE.MAX);
    }
  }

  /**
   * Prepare image data for loading
   *
   * Calculates dimensions, crops to visible area, and extracts the relevant portion.
   *
   * @param buffer - Source pixel data
   * @param options - Loading options
   * @returns Processed image data and display coordinates
   */
  private prepareImageData(
    buffer: Uint8Array,
    options: LoadImageOptions,
  ): {
    x: number;
    y: number;
    width: number;
    height: number;
    croppedData: Uint8Array;
  } {
    const destX = options.x ?? 0;
    const destY = options.y ?? 0;

    // Determine source dimensions
    let sourceWidth: number;
    let sourceHeight: number;

    if (options.width !== undefined && options.height !== undefined) {
      sourceWidth = options.width;
      sourceHeight = options.height;
    } else if (options.width !== undefined) {
      sourceWidth = options.width;
      sourceHeight = Math.floor(buffer.length / sourceWidth);
    } else if (options.height !== undefined) {
      sourceHeight = options.height;
      sourceWidth = Math.floor(buffer.length / sourceHeight);
    } else {
      // Neither specified - use device dimensions as source
      sourceWidth = this.width;
      sourceHeight = this.height;

      if (buffer.length !== sourceWidth * sourceHeight) {
        console.warn(
          `Warning: Buffer size (${buffer.length}) differs from device size (${sourceWidth}x${sourceHeight}). ` +
            `Image will be ${buffer.length < sourceWidth * sourceHeight ? "clipped" : "partial"}. ` +
            `To avoid this, specify explicit width/height or use a ${sourceWidth}x${sourceHeight} buffer.`,
        );
      }
    }

    // Calculate actual display area (crop to fit device)
    const displayX = Math.max(0, destX);
    const displayY = Math.max(0, destY);
    const displayWidth = Math.min(sourceWidth - Math.max(0, -destX), this.width - displayX);
    const displayHeight = Math.min(sourceHeight - Math.max(0, -destY), this.height - displayY);

    // Return empty if entirely outside device bounds
    if (displayWidth <= 0 || displayHeight <= 0) {
      return { x: 0, y: 0, width: 0, height: 0, croppedData: new Uint8Array(0) };
    }

    // Extract visible portion from buffer
    const offsetX = Math.max(0, -destX);
    const offsetY = Math.max(0, -destY);
    const croppedData = new Uint8Array(displayWidth * displayHeight);

    for (let row = 0; row < displayHeight; row++) {
      const srcRow = offsetY + row;
      const srcOffset = srcRow * sourceWidth + offsetX;
      const dstOffset = row * displayWidth;
      croppedData.set(buffer.subarray(srcOffset, srcOffset + displayWidth), dstOffset);
    }

    return {
      x: displayX,
      y: displayY,
      width: displayWidth,
      height: displayHeight,
      croppedData,
    };
  }
}
