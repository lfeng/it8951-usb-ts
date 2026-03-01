/**
 * EPD (Electronic Paper Display) Interface
 *
 * High-level interface for controlling IT8951 e-paper displays via USB SCSI
 */

import { USBInterface } from "./usb-interface.js";
import { DisplayModes, Rotate, VCOM_PRESETS, RefreshRateError, EndianTypes, VCOMOutOfRangeError } from "./constants.js";

/** Configuration for EPD */
export interface EPDConfig {
  /** VCOM voltage (typically -1.5 to -2.5) or use preset name */
  vcom?: number | keyof typeof VCOM_PRESETS;
  /** USB timeout in milliseconds */
  timeout?: number;
  /** Minimum refresh interval in milliseconds (default: 1000ms) */
  minRefreshInterval?: number;
  /** VCOM byte order (default: LITTLE endian) */
  vcomEndian?: EndianTypes;
}

/** Image area specification */
export interface ImageArea {
  /** X coordinate */
  x: number;
  /** Y coordinate */
  y: number;
  /** Width */
  width: number;
  /** Height */
  height: number;
}

/**
 * Main EPD controller class
 */
export class EPD {
  private usb: USBInterface;
  private vcom: number;
  private minRefreshInterval: number;
  private lastRefreshTime: number = 0;

  // Device info (populated after init)
  private _width: number | null = null;
  private _height: number | null = null;
  private _imageBufferAddress: number | null = null;
  private _firmwareVersion: string | null = null;
  private _lutVersion: string | null = null;

  constructor(config: EPDConfig = {}) {
    // Handle VCOM preset or direct value
    if (typeof config.vcom === 'string') {
      this.vcom = VCOM_PRESETS[config.vcom] ?? VCOM_PRESETS.DEFAULT;
    } else {
      this.vcom = config.vcom ?? VCOM_PRESETS.DEFAULT;
    }
    this.minRefreshInterval = config.minRefreshInterval ?? 1000;
    this.usb = new USBInterface({ 
      timeout: config.timeout,
      vcomEndian: config.vcomEndian ?? EndianTypes.LITTLE,
    });
  }

  /** Display width in pixels */
  get width(): number {
    if (this._width === null) {
      throw new Error("Device not initialized. Call init() first.");
    }
    return this._width;
  }

  /** Display height in pixels */
  get height(): number {
    if (this._height === null) {
      throw new Error("Device not initialized. Call init() first.");
    }
    return this._height;
  }

  /** Image buffer address in device memory */
  get imageBufferAddress(): number {
    if (this._imageBufferAddress === null) {
      throw new Error("Device not initialized. Call init() first.");
    }
    return this._imageBufferAddress;
  }

  /** Firmware version string */
  get firmwareVersion(): string {
    if (this._firmwareVersion === null) {
      throw new Error("Device not initialized. Call init() first.");
    }
    return this._firmwareVersion;
  }

  /** LUT version string */
  get lutVersion(): string {
    if (this._lutVersion === null) {
      throw new Error("Device not initialized. Call init() first.");
    }
    return this._lutVersion;
  }

  /**
   * Initialize the display
   */
  async init(): Promise<void> {
    await this.usb.open();

    // Get device information
    const info = await this.usb.getDeviceInfo();
    this._width = info.width;
    this._height = info.height;
    this._imageBufferAddress = info.imageBufferAddress;
    this._firmwareVersion = info.firmwareVersion;
    this._lutVersion = info.lutVersion;

    // Set VCOM voltage and power on
    await this.setVCOM(this.vcom);
  }

  /**
   * Close the connection to the display
   */
  close(): void {
    this.usb.close();
  }

  /**
   * Load image data to device memory and optionally display it
   * @param buffer - Pixel data (1 byte per pixel, values 0-255 grayscale)
   * @param options - Optional area and rotation settings
   */
  async loadImageArea(
    buffer: Uint8Array,
    options: {
      x?: number;
      y?: number;
      width?: number;
      height?: number;
      rotate?: Rotate;
    } = {},
  ): Promise<void> {
    const x = options.x ?? 0;
    const y = options.y ?? 0;
    const width = options.width ?? this.width;
    const height = options.height ?? this.height;

    // Convert Uint8Array to Buffer
    const imageData = Buffer.from(buffer);

    await this.usb.loadImageArea(x, y, width, height, imageData);
  }

  /**
   * Display a region of the image buffer
   * @param x - X coordinate
   * @param y - Y coordinate
   * @param width - Width of region
   * @param height - Height of region
   * @param mode - Display mode
   * @throws {RefreshRateError} If refresh interval is too short
   */
  async displayArea(
    x: number,
    y: number,
    width: number,
    height: number,
    mode: DisplayModes,
  ): Promise<void> {
    // Check refresh rate - only apply if lastRefreshTime is set
    if (this.lastRefreshTime > 0) {
      const now = Date.now();
      const interval = now - this.lastRefreshTime;
      if (interval < this.minRefreshInterval) {
        throw new RefreshRateError(interval, this.minRefreshInterval);
      }
    }
    this.lastRefreshTime = Date.now();
    
    await this.usb.displayArea(x, y, width, height, mode, true);
  }

  /**
   * Set VCOM voltage
   * @param vcom - VCOM voltage (typically -1.5 to -2.5)
   * @throws {VCOMOutOfRangeError} If VCOM voltage is outside the valid range
   */
  async setVCOM(vcom: number): Promise<void> {
    this.validateVCOM(vcom);
    const vcomInt = Math.round(-1000 * vcom);
    await this.usb.setPowerVcom(vcomInt, true);
    this.vcom = vcom;
  }

  /**
   * Get current VCOM voltage
   * @returns Current VCOM voltage value
   * @remarks USB SCSI interface does not support reading VCOM from device, returns the last set value
   */
  async getVCOM(): Promise<number> {
    // VCOM reading not directly available via SCSI
    return this.vcom;
  }

  /**
   * Put device in standby mode (power off display)
   */
  async standby(): Promise<void> {
    await this.usb.setPowerVcom(null, false);
  }

  /**
   * Put device in sleep mode
   */
  async sleep(): Promise<void> {
    await this.usb.setPowerVcom(null, false);
  }

  /**
   * Wake up / run system
   */
  async run(): Promise<void> {
    await this.usb.setPowerVcom(null, true);
  }

  /**
   * Wait for display to be ready
   * Note: With USB SCSI, the displayArea command waits internally
   */
  async waitDisplayReady(): Promise<void> {
    // USB SCSI displayArea with waitReady=true handles this
    return;
  }

  /**
   * Clear the display (fill with white)
   */
  async clear(): Promise<void> {
    // Fill buffer with white (0xFF)
    const bufferSize = this.width * this.height;
    const whiteBuffer = new Uint8Array(bufferSize).fill(0xff);

    await this.loadImageArea(whiteBuffer);
    await this.displayArea(0, 0, this.width, this.height, DisplayModes.INIT);
  }

  /**
   * Display a full image on the screen
   * @param buffer - Image data (grayscale, 1 byte per pixel)
   * @param mode - Display mode (default: GC16 for best quality)
   */
  async display(buffer: Uint8Array, mode: DisplayModes = DisplayModes.GC16): Promise<void> {
    await this.loadImageArea(buffer);
    await this.displayArea(0, 0, this.width, this.height, mode);
  }

  /**
   * Display a partial update
   * @param buffer - Image data for the region
   * @param x - X coordinate
   * @param y - Y coordinate
   * @param width - Width
   * @param height - Height
   * @param mode - Display mode (default: DU for fast update)
   */
  async displayPartial(
    buffer: Uint8Array,
    x: number,
    y: number,
    width: number,
    height: number,
    mode: DisplayModes = DisplayModes.DU,
  ): Promise<void> {
    await this.loadImageArea(buffer, { x, y, width, height });
    await this.displayArea(x, y, width, height, mode);
  }

  /**
   * Load image data to an indexed buffer location in device memory
   * @param index - Buffer index (0-15)
   * @param buffer - Pixel data (1 byte per pixel, values 0-255 grayscale)
   * @param options - Optional area and rotation settings
   * @remarks Index Mode allows up to 16 separate image buffers
   */
  async loadImageAreaIndexed(
    index: number,
    buffer: Uint8Array,
    options: {
      x?: number;
      y?: number;
      width?: number;
      height?: number;
      rotate?: Rotate;
    } = {},
  ): Promise<void> {
    const x = options.x ?? 0;
    const y = options.y ?? 0;
    const width = options.width ?? this.width;
    const height = options.height ?? this.height;

    // Convert Uint8Array to Buffer
    const imageData = Buffer.from(buffer);

    await this.usb.loadImageAreaIndexed(index, x, y, width, height, imageData);
  }

  /**
   * Display a region from an indexed buffer location
   * @param index - Buffer index (0-15)
   * @param x - X coordinate
   * @param y - Y coordinate
   * @param width - Width of region
   * @param height - Height of region
   * @param mode - Display mode
   * @throws {RefreshRateError} If refresh interval is too short
   * @remarks Index Mode allows displaying from up to 16 separate image buffers
   */
  async displayAreaIndexed(
    index: number,
    x: number,
    y: number,
    width: number,
    height: number,
    mode: DisplayModes,
  ): Promise<void> {
    // Check refresh rate - only apply if lastRefreshTime is set
    if (this.lastRefreshTime > 0) {
      const now = Date.now();
      const interval = now - this.lastRefreshTime;
      if (interval < this.minRefreshInterval) {
        throw new RefreshRateError(interval, this.minRefreshInterval);
      }
    }
    this.lastRefreshTime = Date.now();
    
    await this.usb.displayAreaIndexed(index, x, y, width, height, mode, true);
  }

  /**
   * Validate VCOM voltage range
   */
  private validateVCOM(vcom: number): void {
    if (vcom >= 0 || vcom <= -5) {
      throw new VCOMOutOfRangeError(vcom, -5, 0);
    }
  }
}
