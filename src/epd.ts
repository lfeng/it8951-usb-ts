/**
 * EPD (Electronic Paper Display) Interface
 *
 * High-level interface for controlling IT8951 e-paper displays via USB SCSI
 */

import { USBInterface } from "./usb-interface.js";
import { DisplayModes, Rotate } from "./constants.js";

/** Configuration for EPD */
export interface EPDConfig {
  /** VCOM voltage (typically -1.5 to -2.5) */
  vcom?: number;
  /** USB timeout in milliseconds */
  timeout?: number;
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

  // Device info (populated after init)
  private _width: number | null = null;
  private _height: number | null = null;
  private _imageBufferAddress: number | null = null;
  private _firmwareVersion: string | null = null;
  private _lutVersion: string | null = null;

  constructor(config: EPDConfig = {}) {
    this.vcom = config.vcom ?? -2.06;
    this.usb = new USBInterface({ timeout: config.timeout });
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
   */
  async displayArea(
    x: number,
    y: number,
    width: number,
    height: number,
    mode: DisplayModes,
  ): Promise<void> {
    await this.usb.displayArea(x, y, width, height, mode, true);
  }

  /**
   * Set VCOM voltage
   * @param vcom - VCOM voltage (typically -1.5 to -2.5)
   */
  async setVCOM(vcom: number): Promise<void> {
    this.validateVCOM(vcom);
    const vcomInt = Math.round(-1000 * vcom);
    await this.usb.setPowerVcom(vcomInt, true);
    this.vcom = vcom;
  }

  /**
   * Get current VCOM voltage
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
   * Validate VCOM voltage range
   */
  private validateVCOM(vcom: number): void {
    if (vcom >= 0 || vcom <= -5) {
      throw new Error("VCOM must be between -5 and 0 (typically -1.5 to -2.5)");
    }
  }
}
