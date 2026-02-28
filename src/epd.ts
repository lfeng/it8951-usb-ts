/**
 * EPD (Electronic Paper Display) Interface
 * 
 * High-level interface for controlling IT8951 e-paper displays
 */

import { USBInterface } from './usb-interface.js';
import {
  Commands,
  Registers,
  PixelModes,
  DisplayModes,
  Rotate,
  EndianTypes,
} from './constants.js';

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
      throw new Error('Device not initialized. Call init() first.');
    }
    return this._width;
  }

  /** Display height in pixels */
  get height(): number {
    if (this._height === null) {
      throw new Error('Device not initialized. Call init() first.');
    }
    return this._height;
  }

  /** Image buffer address in device memory */
  get imageBufferAddress(): number {
    if (this._imageBufferAddress === null) {
      throw new Error('Device not initialized. Call init() first.');
    }
    return this._imageBufferAddress;
  }

  /** Firmware version string */
  get firmwareVersion(): string {
    if (this._firmwareVersion === null) {
      throw new Error('Device not initialized. Call init() first.');
    }
    return this._firmwareVersion;
  }

  /** LUT version string */
  get lutVersion(): string {
    if (this._lutVersion === null) {
      throw new Error('Device not initialized. Call init() first.');
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

    // Set image buffer base address
    await this.setImageBufferBaseAddress(this._imageBufferAddress);

    // Enable I80 packed mode
    await this.usb.writeRegister(Registers.I80CPCR, 0x1);

    // Set VCOM voltage
    await this.setVCOM(this.vcom);
  }

  /**
   * Close the connection to the display
   */
  close(): void {
    this.usb.close();
  }

  /**
   * Load image data to device memory
   * @param buffer - Pixel data (1 byte per pixel, values 0-255)
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
      pixelFormat?: PixelModes;
    } = {}
  ): Promise<void> {
    const endianType = EndianTypes.BIG;
    const pixelFormat = options.pixelFormat ?? PixelModes.M_4BPP;
    const rotate = options.rotate ?? Rotate.NONE;

    if (options.x !== undefined && options.y !== undefined) {
      await this.loadImageAreaStart(
        endianType,
        pixelFormat,
        rotate,
        { x: options.x, y: options.y, width: options.width!, height: options.height! }
      );
    } else {
      await this.loadImageStart(endianType, pixelFormat, rotate);
    }

    await this.packAndWritePixels(buffer, pixelFormat);
    await this.loadImageEnd();
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
    mode: DisplayModes
  ): Promise<void> {
    await this.usb.writeCommand(Commands.DPY_AREA, [x, y, width, height, mode]);
  }

  /**
   * Set VCOM voltage
   * @param vcom - VCOM voltage (typically -1.5 to -2.5)
   */
  async setVCOM(vcom: number): Promise<void> {
    this.validateVCOM(vcom);
    const vcomInt = Math.round(-1000 * vcom);
    await this.usb.writeCommand(Commands.VCOM, [1, vcomInt]);
    this.vcom = vcom;
  }

  /**
   * Get current VCOM voltage
   */
  async getVCOM(): Promise<number> {
    await this.usb.writeCommand(Commands.VCOM, [0]);
    const vcomInt = await this.usb.readInt();
    return -vcomInt / 1000;
  }

  /**
   * Put device in standby mode
   */
  async standby(): Promise<void> {
    await this.usb.writeCommand(Commands.STANDBY, []);
  }

  /**
   * Put device in sleep mode
   */
  async sleep(): Promise<void> {
    await this.usb.writeCommand(Commands.SLEEP, []);
  }

  /**
   * Run system command
   */
  async run(): Promise<void> {
    await this.usb.writeCommand(Commands.SYS_RUN, []);
  }

  /**
   * Wait for display to be ready
   */
  async waitDisplayReady(): Promise<void> {
    const maxAttempts = 500; // 5 seconds max
    for (let i = 0; i < maxAttempts; i++) {
      const status = await this.usb.readRegister(Registers.LUTAFSR);
      if (status === 0) {
        return;
      }
      await this.sleepMs(10);
    }
    throw new Error('Timeout waiting for display to be ready');
  }

  /**
   * Clear the display
   */
  async clear(): Promise<void> {
    // Fill buffer with white (0xFF)
    const bufferSize = this.width * this.height;
    const whiteBuffer = new Uint8Array(bufferSize).fill(0xFF);
    
    await this.loadImageArea(whiteBuffer);
    await this.displayArea(0, 0, this.width, this.height, DisplayModes.INIT);
    await this.waitDisplayReady();
  }

  /**
   * Read a register
   */
  async readRegister(address: Registers): Promise<number> {
    return await this.usb.readRegister(address);
  }

  /**
   * Write to a register
   */
  async writeRegister(address: Registers, value: number): Promise<void> {
    await this.usb.writeRegister(address, value);
  }

  /**
   * Validate VCOM voltage range
   */
  private validateVCOM(vcom: number): void {
    if (vcom >= 0 || vcom <= -5) {
      throw new Error('VCOM must be between -5 and 0 (typically -1.5 to -2.5)');
    }
  }

  /**
   * Set image buffer base address
   */
  private async setImageBufferBaseAddress(address: number): Promise<void> {
    const word0 = address >> 16;
    const word1 = address & 0xFFFF;
    await this.usb.writeRegister(Registers.LISAR + 2, word0);
    await this.usb.writeRegister(Registers.LISAR, word1);
  }

  /**
   * Start loading image (full screen)
   */
  private async loadImageStart(
    endianType: EndianTypes,
    pixelFormat: PixelModes,
    rotate: Rotate
  ): Promise<void> {
    const arg = (endianType << 8) | (pixelFormat << 4) | rotate;
    await this.usb.writeCommand(Commands.LD_IMG, [arg]);
  }

  /**
   * Start loading image to specific area
   */
  private async loadImageAreaStart(
    endianType: EndianTypes,
    pixelFormat: PixelModes,
    rotate: Rotate,
    area: ImageArea
  ): Promise<void> {
    const arg0 = (endianType << 8) | (pixelFormat << 4) | rotate;
    await this.usb.writeCommand(
      Commands.LD_IMG_AREA,
      [arg0, area.x, area.y, area.width, area.height]
    );
  }

  /**
   * End loading image
   */
  private async loadImageEnd(): Promise<void> {
    await this.usb.writeCommand(Commands.LD_IMG_END, []);
  }

  /**
   * Pack and write pixel data to device
   */
  private async packAndWritePixels(
    buffer: Uint8Array,
    bpp: PixelModes
  ): Promise<void> {
    const bitsPerPixel = this.getBppValue(bpp);
    const pixelsPerByte = Math.floor(8 / bitsPerPixel);
    
    // Pack pixels
    const packedData: number[] = [];
    let currentByte = 0;
    let pixelsInByte = 0;

    for (let i = 0; i < buffer.length; i++) {
      // Extract top bits based on bpp
      const pixelValue = buffer[i] >> (8 - bitsPerPixel);
      currentByte = (currentByte << bitsPerPixel) | pixelValue;
      pixelsInByte++;

      if (pixelsInByte === pixelsPerByte) {
        packedData.push(currentByte);
        currentByte = 0;
        pixelsInByte = 0;
      }
    }

    // Add remaining pixels
    if (pixelsInByte > 0) {
      currentByte <<= bitsPerPixel * (pixelsPerByte - pixelsInByte);
      packedData.push(currentByte);
    }

    // Write data in 16-bit chunks
    for (let i = 0; i < packedData.length; i += 2) {
      const word = i + 1 < packedData.length
        ? (packedData[i] << 8) | packedData[i + 1]
        : packedData[i] << 8;
      await this.usb.writeData([word]);
    }
  }

  /**
   * Get bits per pixel value for a pixel format
   */
  private getBppValue(mode: PixelModes): number {
    switch (mode) {
      case PixelModes.M_2BPP: return 2;
      case PixelModes.M_3BPP: return 3;
      case PixelModes.M_4BPP: return 4;
      case PixelModes.M_8BPP: return 8;
      default: return 4;
    }
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleepMs(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
