/**
 * USB Interface for IT8951 Display Controller
 *
 * Handles USB communication with the IT8951 device using SCSI over USB protocol.
 * Provides low-level commands for display control, image loading, and device management.
 *
 * @example
 * ```typescript
 * const usb = new USBInterface();
 * await usb.open();
 * const info = await usb.getDeviceInfo();
 * console.log(`Display: ${info.width}x${info.height}`);
 * await usb.close();
 * ```
 */

import { getDeviceList, Device, Interface, InEndpoint, OutEndpoint } from "usb";
import {
  USB_VENDOR_ID,
  USB_PRODUCT_ID,
  EndianTypes,
  EPDError,
  DeviceNotFoundError,
  SCSIError,
  USBTransferError,
  SCSICommands,
} from "./constants.js";
import {
  CSW_LENGTH,
  CSW_SIGNATURE_VALUE,
  GET_SYSTEM_INFO_LENGTH,
  MAX_USB_TRANSFER_SIZE,
  STANDARD_INQUIRY_LENGTH,
  buildCBW,
  buildDisplayAreaCommand,
  buildDisplayAreaPayload,
  buildGetSystemInfoCommand,
  buildInquiryCommand,
  buildLoadImageAreaCommand,
  buildLoadImageAreaPayload,
  buildMemoryCommand,
  buildNoArgumentCommand,
  buildPowerVcomCommand,
  formatCommandTableVersion,
  indexedBufferAddress,
  isIT8951Inquiry,
  parseInquiryResponse,
  parseSystemInfo,
  splitImageAreaRows,
  type ParsedSystemInfo,
  type TransferDirection,
} from "./protocol.js";

export type SystemInfo = ParsedSystemInfo;

/**
 * Device information returned by GET_SYS command
 */
export interface DeviceInfo {
  /** Display width in pixels */
  readonly width: number;
  /** Display height in pixels */
  readonly height: number;
  /** Image buffer base address in device memory */
  readonly imageBufferAddress: number;
  /** Firmware version string */
  readonly firmwareVersion: string;
  /** LUT (Lookup Table) version string */
  readonly lutVersion: string;
  /** Number of temperature segments */
  readonly temperatureNo?: number;
  /** Number of display modes */
  readonly modeNo?: number;
  /** Number of image buffers (v0.3+) */
  readonly numImgBuf?: number;
  /** Update buffer base address */
  readonly updateBufBase?: number;
}

/**
 * Result of SCSI INQUIRY command
 */
export interface IdentifyResult {
  /** Whether the device is an IT8951 controller */
  readonly isIT8951: boolean;
  /** Product identification string */
  readonly productId: string;
  /** Vendor identification string */
  readonly vendorId: string;
  /** Product revision level */
  readonly revision: string;
}

/**
 * Configuration options for USBInterface
 */
export interface USBInterfaceOptions {
  /** USB timeout in milliseconds (default: 5000) */
  readonly timeout?: number;
  /** Vendor ID (default: IT8951 vendor ID 0x048d) */
  readonly vendorId?: number;
  /** Product ID (default: IT8951 product ID 0x8951) */
  readonly productId?: number;
  /** VCOM byte order (default: BIG endian, matching the USB programming guide) */
  readonly vcomEndian?: EndianTypes;
  /** Maximum USB data phase length per command (default: 60 KiB per IT8951 USB guide) */
  readonly maxTransferBytes?: number;
}

/** Bulk transfer type */
const BULK_TRANSFER_TYPE = 2;

// =============================================================================
// USB Interface Class
// =============================================================================

/**
 * USB communication layer for IT8951 using SCSI over USB protocol.
 *
 * This class handles all low-level USB communication including:
 * - Device discovery and connection
 * - SCSI command transmission
 * - Image data transfer
 * - Power management
 */
export class USBInterface {
  private device: Device | null = null;
  private iface: Interface | null = null;
  private endpointOut: OutEndpoint | null = null;
  private endpointIn: InEndpoint | null = null;
  private readonly vendorId: number;
  private readonly productId: number;
  private readonly timeout: number;
  private readonly maxTransferBytes: number;
  private tag: number = 0;
  private _imageBufferAddress: number = 0;
  private readonly vcomEndian: EndianTypes;

  /**
   * Creates a new USBInterface instance
   *
   * @param options - Configuration options
   */
  constructor(options: USBInterfaceOptions = {}) {
    this.vendorId = options.vendorId ?? USB_VENDOR_ID;
    this.productId = options.productId ?? USB_PRODUCT_ID;
    this.timeout = options.timeout ?? 5000;
    this.vcomEndian = options.vcomEndian ?? EndianTypes.BIG;
    this.maxTransferBytes = options.maxTransferBytes ?? MAX_USB_TRANSFER_SIZE;
  }

  /**
   * Find and open the IT8951 USB device
   *
   * @throws {DeviceNotFoundError} If device is not found
   * @throws {USBTransferError} If USB communication fails
   */
  async open(): Promise<void> {
    const devices = getDeviceList();

    for (const device of devices) {
      if (
        device.deviceDescriptor.idVendor === this.vendorId &&
        device.deviceDescriptor.idProduct === this.productId
      ) {
        this.device = device;
        break;
      }
    }

    if (!this.device) {
      throw new DeviceNotFoundError(this.vendorId, this.productId);
    }

    try {
      this.device.open();

      // Find the interface
      const interfaces = this.device.interfaces;
      if (!interfaces || interfaces.length === 0) {
        throw new USBTransferError("No interfaces found on device");
      }

      this.iface = interfaces[0];

      if (this.iface.isKernelDriverActive?.()) {
        this.iface.detachKernelDriver();
      }
      this.iface.claim();

      // Find endpoints
      const endpoints = this.iface.endpoints;
      for (const ep of endpoints) {
        const endpoint = ep as InEndpoint | OutEndpoint;
        if (endpoint.direction === "in" && endpoint.transferType === BULK_TRANSFER_TYPE) {
          this.endpointIn = endpoint as InEndpoint;
        } else if (endpoint.direction === "out" && endpoint.transferType === BULK_TRANSFER_TYPE) {
          this.endpointOut = endpoint as OutEndpoint;
        }
      }

      if (!this.endpointIn || !this.endpointOut) {
        throw new USBTransferError("Required bulk endpoints not found");
      }

      // Set timeout
      this.endpointIn.timeout = this.timeout;
      this.endpointOut.timeout = this.timeout;
    } catch (error) {
      this.close();
      if (error instanceof EPDError) {
        throw error;
      }
      throw new USBTransferError(
        `Failed to open device: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Close USB connection and release resources
   *
   * This method is safe to call multiple times and will not throw.
   */
  close(): void {
    if (this.iface) {
      try {
        this.iface.release(true);
      } catch {
        // Ignore errors during cleanup
      }
      this.iface = null;
    }

    if (this.device) {
      try {
        this.device.close();
      } catch {
        // Ignore errors during cleanup
      }
      this.device = null;
    }

    this.endpointIn = null;
    this.endpointOut = null;
  }

  /**
   * Get device information from IT8951
   *
   * @returns Device information including dimensions and version strings
   * @throws {USBTransferError} If communication fails
   * @throws {SCSIError} If SCSI command fails or invalid device signature
   */
  async getDeviceInfo(): Promise<DeviceInfo> {
    const systemInfo = await this.getSystemInfo();
    const imageBufferAddress = systemInfo.imageBufBase;

    // USB GET_SYS exposes the command table version, not the SPI dev-info FW/LUT strings.
    const firmwareVersion = formatCommandTableVersion(systemInfo.version);
    const lutVersion = "N/A";

    this._imageBufferAddress = imageBufferAddress;

    return {
      width: systemInfo.width,
      height: systemInfo.height,
      imageBufferAddress,
      firmwareVersion,
      lutVersion,
      temperatureNo: systemInfo.temperatureNo,
      modeNo: systemInfo.modeNo,
      numImgBuf: systemInfo.numImgBuf,
      updateBufBase: systemInfo.updateBufBase,
    };
  }

  /**
   * Load image data to a specific area of the display buffer
   *
   * @param x - X coordinate (horizontal position)
   * @param y - Y coordinate (vertical position)
   * @param width - Width of the image area in pixels
   * @param height - Height of the image area in pixels
   * @param imageData - Raw pixel data (8-bit grayscale)
   * @throws {USBTransferError} If USB transfer fails
   * @throws {SCSIError} If SCSI command fails
   */
  async loadImageArea(
    x: number,
    y: number,
    width: number,
    height: number,
    imageData: Buffer,
  ): Promise<void> {
    const command = buildLoadImageAreaCommand();
    const chunks = splitImageAreaRows(
      { x, y, width, height },
      imageData,
      this.maxTransferBytes,
    );

    for (const chunk of chunks) {
      const payload = buildLoadImageAreaPayload(this._imageBufferAddress, chunk.area, chunk.data);
      await this.sendCommandWithData(command, payload);
    }
  }

  /**
   * Load image data to an indexed buffer location
   *
   * @param index - Buffer index (0-15)
   * @param x - X coordinate
   * @param y - Y coordinate
   * @param width - Width of the image area
   * @param height - Height of the image area
   * @param imageData - Raw pixel data
   * @throws {USBTransferError} If USB transfer fails
   * @throws {SCSIError} If SCSI command fails
   * @throws {RangeError} If buffer index is out of range (0-15)
   */
  async loadImageAreaIndexed(
    index: number,
    x: number,
    y: number,
    width: number,
    height: number,
    imageData: Buffer,
  ): Promise<void> {
    const address = indexedBufferAddress(index);
    const command = buildLoadImageAreaCommand();
    const chunks = splitImageAreaRows(
      { x, y, width, height },
      imageData,
      this.maxTransferBytes,
    );

    for (const chunk of chunks) {
      const payload = buildLoadImageAreaPayload(address, chunk.area, chunk.data);
      await this.sendCommandWithData(command, payload);
    }
  }

  /**
   * Send LD_IMG_END command to finalize image loading
   *
   * This is kept for low-level experiments with firmware that accepts the I80 LD_IMG_END
   * command through USB. The documented USB LD_IMG_AREA command does not require it.
   *
   * @throws {USBTransferError} If USB transfer fails
   * @throws {SCSIError} If SCSI command fails
   */
  async loadImageEnd(): Promise<void> {
    await this.sendCommandWithData(buildNoArgumentCommand(SCSICommands.LD_IMG_END), Buffer.alloc(0));
  }

  /**
   * Display a region of the image buffer on the screen
   *
   * @param x - X coordinate of the region
   * @param y - Y coordinate of the region
   * @param width - Width of the region
   * @param height - Height of the region
   * @param mode - Display mode (waveform mode)
   * @param waitReady - Whether to wait for display to be ready
   * @throws {USBTransferError} If USB transfer fails
   * @throws {SCSIError} If SCSI command fails
   */
  async displayArea(
    x: number,
    y: number,
    width: number,
    height: number,
    mode: number,
    waitReady: boolean = true,
  ): Promise<void> {
    const displayInfo = buildDisplayAreaPayload(
      this._imageBufferAddress,
      mode,
      { x, y, width, height },
      waitReady,
    );
    await this.sendCommandWithData(buildDisplayAreaCommand(), displayInfo);
  }

  /**
   * Display a region from an indexed buffer
   *
   * @param index - Buffer index (0-15)
   * @param x - X coordinate
   * @param y - Y coordinate
   * @param width - Width of the region
   * @param height - Height of the region
   * @param mode - Display mode
   * @param waitReady - Whether to wait for display to be ready
   * @throws {USBTransferError} If USB transfer fails
   * @throws {SCSIError} If SCSI command fails
   * @throws {RangeError} If buffer index is out of range (0-15)
   */
  async displayAreaIndexed(
    index: number,
    x: number,
    y: number,
    width: number,
    height: number,
    mode: number,
    waitReady: boolean = true,
  ): Promise<void> {
    const displayInfo = buildDisplayAreaPayload(
      indexedBufferAddress(index),
      mode,
      { x, y, width, height },
      waitReady,
    );
    await this.sendCommandWithData(buildDisplayAreaCommand(true), displayInfo);
  }

  /**
   * Set VCOM voltage and/or power state
   *
   * @param vcom - VCOM value (null to skip setting)
   * @param powerOn - Whether to power on the display
   * @throws {USBTransferError} If USB transfer fails
   * @throws {SCSIError} If SCSI command fails
   */
  async setPowerVcom(vcom: number | null, powerOn: boolean): Promise<void> {
    const command = buildPowerVcomCommand(vcom, powerOn, this.vcomEndian);
    await this.sendCommandWithData(command, Buffer.alloc(0));
  }

  /**
   * Get image buffer address in device memory
   *
   * @returns The image buffer base address
   * @throws {Error} If device has not been initialized
   */
  get imageBufferAddress(): number {
    if (this._imageBufferAddress === 0) {
      throw new Error("Device not initialized. Call open() and getDeviceInfo() first.");
    }
    return this._imageBufferAddress;
  }

  /**
   * Check if device is currently connected
   *
   * @returns True if device is open and connected
   */
  isConnected(): boolean {
    return this.device !== null && this.endpointIn !== null && this.endpointOut !== null;
  }

  /**
   * Identify the device using SCSI INQUIRY command
   *
   * @returns Device identification information
   * @throws {USBTransferError} If USB transfer fails
   * @throws {SCSIError} If SCSI command fails
   */
  async identify(): Promise<IdentifyResult> {
    const response = await this.scsiInquiry();
    const inquiry = parseInquiryResponse(response);

    return {
      isIT8951: isIT8951Inquiry(inquiry),
      productId: inquiry.productId,
      vendorId: inquiry.vendorId,
      revision: inquiry.revision,
    };
  }

  /**
   * Read the standard 36-byte SCSI INQUIRY response.
   *
   * @returns Raw INQUIRY response buffer
   * @throws {USBTransferError} If USB transfer fails
   * @throws {SCSIError} If SCSI command fails
   */
  async scsiInquiry(): Promise<Buffer> {
    return this.sendCommand(buildInquiryCommand(STANDARD_INQUIRY_LENGTH), STANDARD_INQUIRY_LENGTH);
  }

  /**
   * Fast write memory using FAST_WRITE_MEM command (0xa5)
   * Achieves up to 30MB/s transfer speed
   *
   * @param address - Target memory address
   * @param data - Data buffer to write
   * @throws {USBTransferError} If USB transfer fails
   * @throws {SCSIError} If SCSI command fails
   */
  async fastWriteMemory(address: number, data: Buffer): Promise<void> {
    for (let offset = 0; offset < data.length; offset += this.maxTransferBytes) {
      const chunk = data.subarray(offset, offset + this.maxTransferBytes);
      const command = buildMemoryCommand(
        SCSICommands.FAST_WRITE_MEM,
        address + offset,
        chunk.length,
      );
      await this.sendCommandWithData(command, chunk);
    }
  }

  /**
   * Get complete system information (raw 112-byte structure)
   *
   * @returns Parsed SystemInfo structure
   * @throws {USBTransferError} If USB transfer fails
   * @throws {SCSIError} If SCSI command fails
   */
  async getSystemInfo(): Promise<SystemInfo> {
    const response = await this.sendCommand(buildGetSystemInfoCommand(), GET_SYSTEM_INFO_LENGTH);
    const systemInfo = parseSystemInfo(response);
    this._imageBufferAddress = systemInfo.imageBufBase;
    return systemInfo;
  }

  /**
   * Load image data to a specific area with automatic 4-byte row alignment
   *
   * @param x - X coordinate (horizontal position)
   * @param y - Y coordinate (vertical position)
   * @param width - Width of the image area in pixels
   * @param height - Height of the image area in pixels
   * @param imageData - Raw pixel data (8-bit grayscale)
   * @param autoAlign - Whether to automatically align image data (default: true)
   * @throws {USBTransferError} If USB transfer fails
   * @throws {SCSIError} If SCSI command fails
   */
  async loadImageAreaAligned(
    x: number,
    y: number,
    width: number,
    height: number,
    imageData: Buffer,
    autoAlign: boolean = true,
  ): Promise<void> {
    let alignedData = imageData;
    let alignedWidth = width;

    if (autoAlign && width % 4 !== 0) {
      // Align width to 4-byte boundary
      alignedWidth = Math.ceil(width / 4) * 4;
      alignedData = this.alignImageData(imageData, width, height, alignedWidth);
    }

    await this.loadImageArea(x, y, alignedWidth, height, alignedData);
  }

  /**
   * Align image data to 4-byte row boundaries
   *
   * @param data - Original image data
   * @param width - Original width
   * @param height - Image height
   * @param alignedWidth - Target aligned width (must be multiple of 4)
   * @returns Aligned image data buffer
   */
  private alignImageData(
    data: Buffer,
    width: number,
    height: number,
    alignedWidth: number,
  ): Buffer {
    if (width === alignedWidth) return data;

    const aligned = Buffer.alloc(alignedWidth * height);
    for (let row = 0; row < height; row++) {
      data.copy(aligned, row * alignedWidth, row * width, row * width + width);
      // Remaining bytes in aligned row are already 0 (from Buffer.alloc)
    }
    return aligned;
  }

  // =============================================================================
  // Private Methods
  // =============================================================================

  /**
   * Send SCSI command and receive response
   *
   * @param command - SCSI command buffer (16 bytes)
   * @param dataLength - Expected response data length
   * @returns Response data buffer
   * @throws {USBTransferError} If USB transfer fails
   * @throws {SCSIError} If SCSI command fails
   */
  private async sendCommand(command: Buffer, dataLength: number): Promise<Buffer> {
    if (!this.endpointOut || !this.endpointIn) {
      throw new USBTransferError("Device not opened");
    }

    const { cbw, tag: expectedTag } = this.createCBW(command, dataLength, "in");

    try {
      // Send CBW
      await this.transferOut(this.endpointOut, cbw);

      let data: Buffer;
      if (dataLength > 0) {
        // Receive data
        data = await this.transferIn(this.endpointIn, dataLength);
      } else {
        data = Buffer.alloc(0);
      }

      // Receive CSW
      const csw = await this.transferIn(this.endpointIn, CSW_LENGTH);

      // Validate CSW
      this.validateCSW(csw, expectedTag);

      return data;
    } catch (error) {
      if (error instanceof EPDError) {
        throw error;
      }
      throw new USBTransferError(
        `USB transfer failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Send SCSI command with outbound data
   *
   * @param command - SCSI command buffer
   * @param data - Data to send
   * @throws {USBTransferError} If USB transfer fails
   * @throws {SCSIError} If SCSI command fails
   */
  private async sendCommandWithData(command: Buffer, data: Buffer): Promise<void> {
    if (!this.endpointOut || !this.endpointIn) {
      throw new USBTransferError("Device not opened");
    }

    const { cbw, tag: expectedTag } = this.createCBW(command, data.length, "out");

    try {
      // Send CBW
      await this.transferOut(this.endpointOut, cbw);

      // Send data phase only when the command has an outbound payload.
      if (data.length > 0) {
        await this.transferOut(this.endpointOut, data);
      }

      // Receive CSW
      const csw = await this.transferIn(this.endpointIn, CSW_LENGTH);

      // Validate CSW
      this.validateCSW(csw, expectedTag);
    } catch (error) {
      if (error instanceof EPDError) {
        throw error;
      }
      throw new USBTransferError(
        `USB transfer failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Perform bulk OUT transfer
   *
   * @param endpoint - OUT endpoint
   * @param data - Data buffer to send
   */
  private async transferOut(endpoint: OutEndpoint, data: Buffer): Promise<void> {
    return new Promise((resolve, reject) => {
      endpoint.transfer(data, (error) => {
        if (error) {
          reject(new USBTransferError(`OUT transfer failed: ${error.message}`));
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Perform bulk IN transfer
   *
   * @param endpoint - IN endpoint
   * @param length - Number of bytes to receive
   * @returns Received data buffer
   */
  private async transferIn(endpoint: InEndpoint, length: number): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      endpoint.transfer(length, (error, buffer) => {
        if (error) {
          reject(new USBTransferError(`IN transfer failed: ${error.message}`));
        } else if (!buffer) {
          reject(new USBTransferError("IN transfer returned empty buffer"));
        } else {
          resolve(Buffer.from(buffer));
        }
      });
    });
  }

  /**
   * Create Command Block Wrapper for a single SCSI command.
   *
   * @param command - SCSI command buffer
   * @param dataLength - Data transfer length
   * @param direction - USB data phase direction
   * @returns CBW buffer and tag that must match the following CSW
   */
  private createCBW(
    command: Buffer,
    dataLength: number,
    direction: TransferDirection,
  ): { cbw: Buffer; tag: number } {
    this.tag = (this.tag + 1) >>> 0;
    if (this.tag === 0) {
      this.tag = 1;
    }

    return {
      cbw: buildCBW(command, dataLength, direction, this.tag),
      tag: this.tag,
    };
  }

  /**
   * Validate Command Status Wrapper
   *
   * @param csw - CSW buffer
   * @param expectedTag - Expected tag value
   * @throws {SCSIError} If validation fails
   */
  private validateCSW(csw: Buffer, expectedTag: number): void {
    const signature = csw.readUInt32LE(0);
    const cswTag = csw.readUInt32LE(4);
    const status = csw.readUInt8(12);

    if (signature !== CSW_SIGNATURE_VALUE) {
      throw new SCSIError(
        0,
        `Invalid CSW signature: expected 0x${CSW_SIGNATURE_VALUE.toString(16)}, got 0x${signature.toString(16)}`,
      );
    }

    if (cswTag !== expectedTag) {
      throw new SCSIError(0, `CSW tag mismatch: expected ${expectedTag}, got ${cswTag}`);
    }

    if (status !== 0) {
      throw new SCSIError(status);
    }
  }
}
