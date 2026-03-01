/**
 * USB Interface for IT8951 Display Controller
 *
 * Handles USB communication with the IT8951 device using SCSI over USB protocol
 */

import { getDeviceList, Device, Interface, InEndpoint, OutEndpoint } from "usb";
import { USB_VENDOR_ID, USB_PRODUCT_ID, Registers, DisplayModes, EndianTypes } from "./constants.js";

/** Device information returned by GET_SYS command */
export interface DeviceInfo {
  width: number;
  height: number;
  imageBufferAddress: number;
  firmwareVersion: string;
  lutVersion: string;
}

/** Configuration options for USBInterface */
export interface USBInterfaceOptions {
  /** USB timeout in milliseconds (default: 5000) */
  timeout?: number;
  /** Vendor ID (default: IT8951 vendor ID) */
  vendorId?: number;
  /** Product ID (default: IT8951 product ID) */
  productId?: number;
  /** VCOM byte order (default: LITTLE endian) */
  vcomEndian?: EndianTypes;
}

// SCSI CBW/CSW constants
const CBW_SIGNATURE = Buffer.from([0x55, 0x53, 0x42, 0x43]); // 'USBC'
const CSW_SIGNATURE_VALUE = 0x53425355; // 'USBS' as little-endian uint32
const CBW_LENGTH = 31;
const CSW_LENGTH = 13;

// IT8951 SCSI Commands (16 bytes each)
const SCSI_GET_SYS = Buffer.from([
  0xfe, 0x00, 0x38, 0x39, 0x35, 0x31, 0x80, 0x00, 0x01, 0x00, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00,
]);

const SCSI_LD_IMAGE_AREA = Buffer.from([
  0xfe, 0x00, 0x00, 0x00, 0x00, 0x00, 0xa2, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
]);

const SCSI_DPY_AREA = Buffer.from([
  0xfe, 0x00, 0x00, 0x00, 0x00, 0x00, 0x94, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
]);

const SCSI_PMIC_CTRL = Buffer.from([
  0xfe, 0x00, 0x00, 0x00, 0x00, 0x00, 0xa3, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
]);

const SCSI_INQUIRY = Buffer.from([
  0x12, 0x00, 0x00, 0x00, 0x24, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
]);

const SCSI_FAST_WRITE = Buffer.from([
  0xfe, 0x00, 0x00, 0x00, 0x00, 0x00, 0xa5, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
]);

/**
 * USB communication layer for IT8951 using SCSI over USB
 */
export class USBInterface {
  private device: Device | null = null;
  private iface: Interface | null = null;
  private endpointOut: OutEndpoint | null = null;
  private endpointIn: InEndpoint | null = null;
  private vendorId: number;
  private productId: number;
  private timeout: number;
  private tag: number = 0;
  private _imageBufferAddress: number = 0;
  private vcomEndian: EndianTypes;

  constructor(options: USBInterfaceOptions = {}) {
    this.vendorId = options.vendorId ?? USB_VENDOR_ID;
    this.productId = options.productId ?? USB_PRODUCT_ID;
    this.timeout = options.timeout ?? 5000;
    this.vcomEndian = options.vcomEndian ?? EndianTypes.LITTLE;
  }

  /**
   * Find and open the IT8951 USB device
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
      throw new Error("IT8951 device not found. Make sure it is connected via USB.");
    }

    try {
      this.device.open();

      // Get the first interface
      const interfaces = this.device.interfaces;
      if (!interfaces || interfaces.length === 0) {
        throw new Error("No interfaces found on IT8951 device");
      }

      this.iface = interfaces[0];

      if (this.iface.isKernelDriverActive?.()) {
        this.iface.detachKernelDriver();
      }
      this.iface.claim();

      // Find bulk endpoints
      for (const ep of this.iface.endpoints) {
        const endpoint = ep as InEndpoint | OutEndpoint;
        if (endpoint.direction === "out" && endpoint.transferType === 2) {
          this.endpointOut = endpoint as OutEndpoint;
        } else if (endpoint.direction === "in" && endpoint.transferType === 2) {
          this.endpointIn = endpoint as InEndpoint;
        }
      }

      if (!this.endpointOut || !this.endpointIn) {
        throw new Error("Required bulk endpoints not found");
      }

      // Set timeout for endpoints
      this.endpointOut.timeout = this.timeout;
      this.endpointIn.timeout = this.timeout;
    } catch (error) {
      this.close();
      throw new Error(
        `Failed to open IT8951 device: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Close the USB device
   */
  close(): void {
    try {
      if (this.endpointIn) {
        try {
          this.endpointIn.stopPoll?.();
        } catch {
          // Ignore errors when stopping poll
        }
      }
      if (this.iface) {
        try {
          this.iface.release();
        } catch {
          // Ignore release errors
        }
      }
      if (this.device) {
        try {
          this.device.close();
        } catch (closeError) {
          if (closeError instanceof Error && closeError.message.includes("pending request")) {
            try {
              this.device.reset(() => {});
            } catch {
              // Ignore reset errors
            }
          }
        }
      }
    } catch (error) {
      console.warn("Warning: Error closing device:", error);
    }

    this.device = null;
    this.iface = null;
    this.endpointOut = null;
    this.endpointIn = null;
  }

  /**
   * Build a SCSI Command Block Wrapper (CBW)
   */
  private buildCBW(command: Buffer, dataLength: number, direction: number): Buffer {
    const cbw = Buffer.alloc(CBW_LENGTH);
    this.tag++;

    // Copy signature
    CBW_SIGNATURE.copy(cbw, 0);
    cbw.writeUInt32LE(this.tag, 4);
    cbw.writeUInt32LE(dataLength, 8);
    cbw.writeUInt8(direction, 12);
    cbw.writeUInt8(0, 13); // LUN
    cbw.writeUInt8(16, 14); // Command length (always 16 for IT8951)
    command.copy(cbw, 15);

    return cbw;
  }

  /**
   * Read and verify Command Status Wrapper (CSW)
   */
  private async readCSW(): Promise<void> {
    const csw = await this.transferIn(CSW_LENGTH);

    const signature = csw.readUInt32LE(0);
    const tag = csw.readUInt32LE(4);
    const status = csw.readUInt8(12);

    if (signature !== CSW_SIGNATURE_VALUE) {
      throw new Error(`Invalid CSW signature: 0x${signature.toString(16)}`);
    }

    if (tag !== this.tag) {
      throw new Error(`CSW tag mismatch: expected ${this.tag}, got ${tag}`);
    }

    if (status !== 0) {
      throw new Error(`Command failed with status: ${status}`);
    }
  }

  /**
   * Execute a SCSI read command
   */
  private async scsiRead(command: Buffer, length: number): Promise<Buffer> {
    const cbw = this.buildCBW(command, length, 0x80);
    await this.transferOut(cbw);

    const data = await this.transferIn(length);
    await this.readCSW();

    return data;
  }

  /**
   * Execute a SCSI write command with data
   */
  private async scsiWrite(command: Buffer, data: Buffer): Promise<void> {
    const cbw = this.buildCBW(command, data.length, 0x00);
    await this.transferOut(cbw);
    await this.transferOut(data);
    await this.readCSW();
  }

  /**
   * Execute a SCSI command with no data transfer
   */
  private async scsiCommand(command: Buffer): Promise<void> {
    const cbw = this.buildCBW(command, 0, 0x00);
    await this.transferOut(cbw);
    await this.readCSW();
  }

  /**
   * Send SCSI Inquiry command to query device information
   * @returns Raw inquiry data (36 bytes standard inquiry response)
   * @remarks Returns Vendor ID, Product ID, Product Revision, and device type
   */
  async scsiInquiry(): Promise<Buffer> {
    // Standard SCSI Inquiry returns 36 bytes
    const data = await this.scsiRead(SCSI_INQUIRY, 36);
    return data;
  }

  /**
   * Identify if the connected device is an IT8951 controller
   * @returns True if device is IT8951, false otherwise
   * @remarks Checks if the inquiry response contains 'Generic Storage RamDisc'
   */
  async identify(): Promise<boolean> {
    try {
      const inquiry = await this.scsiInquiry();
      
      // Vendor ID: bytes 8-15 (8 chars)
      const vendorId = inquiry.subarray(8, 16).toString('ascii').trim();
      // Product ID: bytes 16-31 (16 chars)
      const productId = inquiry.subarray(16, 32).toString('ascii').trim();
      
      // IT8951 typically identifies as 'Generic Storage RamDisc'
      const fullId = `${vendorId} ${productId}`;
      
      return fullId.includes('Generic Storage') && fullId.includes('RamDisc');
    } catch (error) {
      console.warn('SCSI Inquiry failed:', error);
      return false;
    }
  }

  /**
   * Get device information using IT8951 GET_SYS command
   */
  async getDeviceInfo(): Promise<DeviceInfo> {
    // GET_SYS returns 112 bytes of system info
    const data = await this.scsiRead(SCSI_GET_SYS, 112);

    // Parse system info (big-endian uint32 values)
    const width = data.readUInt32BE(16);
    const height = data.readUInt32BE(20);
    const imageBufferAddress = data.readUInt32BE(28);

    this._imageBufferAddress = imageBufferAddress;

    // Firmware version is not directly available in this format
    // Return placeholder values
    return {
      width,
      height,
      imageBufferAddress,
      firmwareVersion: "N/A",
      lutVersion: "N/A",
    };
  }

  /**
   * Load image area to the display buffer
   */
  async loadImageArea(
    x: number,
    y: number,
    width: number,
    height: number,
    imageData: Buffer,
  ): Promise<void> {
    // Build area info (20 bytes, big-endian)
    const areaInfo = Buffer.alloc(20);
    areaInfo.writeUInt32BE(this._imageBufferAddress, 0);
    areaInfo.writeUInt32BE(x, 4);
    areaInfo.writeUInt32BE(y, 8);
    areaInfo.writeUInt32BE(width, 12);
    areaInfo.writeUInt32BE(height, 16);

    // Combine area info and image data
    const data = Buffer.concat([areaInfo, imageData]);

    await this.scsiWrite(SCSI_LD_IMAGE_AREA, data);
  }

  /**
   * Load image area to an indexed buffer location
   * @param index - Buffer index (0-15)
   * @param x - X coordinate
   * @param y - Y coordinate
   * @param width - Width
   * @param height - Height
   * @param imageData - Image data buffer
   * @remarks Index Mode allows up to 16 separate image buffers.
   * Address format: 0x80000000 | (index & 0x0F)
   */
  async loadImageAreaIndexed(
    index: number,
    x: number,
    y: number,
    width: number,
    height: number,
    imageData: Buffer,
  ): Promise<void> {
    if (index < 0 || index > 15) {
      throw new Error('Buffer index must be between 0 and 15');
    }

    // Index Mode address: 0x80000000 | (index & 0x0F)
    const indexedAddress = 0x80000000 | (index & 0x0F);

    // Build area info (20 bytes, big-endian)
    const areaInfo = Buffer.alloc(20);
    areaInfo.writeUInt32BE(indexedAddress, 0);
    areaInfo.writeUInt32BE(x, 4);
    areaInfo.writeUInt32BE(y, 8);
    areaInfo.writeUInt32BE(width, 12);
    areaInfo.writeUInt32BE(height, 16);

    // Combine area info and image data
    const data = Buffer.concat([areaInfo, imageData]);

    await this.scsiWrite(SCSI_LD_IMAGE_AREA, data);
  }

  /**
   * Display area on the e-paper
   */
  async displayArea(
    x: number,
    y: number,
    width: number,
    height: number,
    mode: DisplayModes,
    waitReady: boolean = true,
  ): Promise<void> {
    // Build display area info (28 bytes, big-endian)
    const displayInfo = Buffer.alloc(28);
    displayInfo.writeUInt32BE(this._imageBufferAddress, 0);
    displayInfo.writeUInt32BE(mode, 4);
    displayInfo.writeUInt32BE(x, 8);
    displayInfo.writeUInt32BE(y, 12);
    displayInfo.writeUInt32BE(width, 16);
    displayInfo.writeUInt32BE(height, 20);
    displayInfo.writeUInt32BE(waitReady ? 1 : 0, 24);

    await this.scsiWrite(SCSI_DPY_AREA, displayInfo);
  }

  /**
   * Display area from an indexed buffer location
   * @param index - Buffer index (0-15)
   * @param x - X coordinate
   * @param y - Y coordinate
   * @param width - Width
   * @param height - Height
   * @param mode - Display mode
   * @param waitReady - Wait for display to be ready (default: true)
   * @remarks Index Mode allows displaying from up to 16 separate image buffers.
   * Address format: 0x80000000 | (index & 0x0F)
   */
  async displayAreaIndexed(
    index: number,
    x: number,
    y: number,
    width: number,
    height: number,
    mode: DisplayModes,
    waitReady: boolean = true,
  ): Promise<void> {
    if (index < 0 || index > 15) {
      throw new Error('Buffer index must be between 0 and 15');
    }

    // Index Mode address: 0x80000000 | (index & 0x0F)
    const indexedAddress = 0x80000000 | (index & 0x0F);

    // Build display area info (28 bytes, big-endian)
    const displayInfo = Buffer.alloc(28);
    displayInfo.writeUInt32BE(indexedAddress, 0);
    displayInfo.writeUInt32BE(mode, 4);
    displayInfo.writeUInt32BE(x, 8);
    displayInfo.writeUInt32BE(y, 12);
    displayInfo.writeUInt32BE(width, 16);
    displayInfo.writeUInt32BE(height, 20);
    displayInfo.writeUInt32BE(waitReady ? 1 : 0, 24);

    await this.scsiWrite(SCSI_DPY_AREA, displayInfo);
  }

  /**
   * Set VCOM value and/or power state
   * @param vcom - VCOM value in millivolts (e.g., 2000 for -2.0V), or null to skip
   * @param powerOn - Power state (true = on, false = off), or null to skip
   * @remarks VCOM byte order is determined by the vcomEndian constructor option
   */
  async setPowerVcom(vcom: number | null, powerOn: boolean | null): Promise<void> {
    const cmd = Buffer.from(SCSI_PMIC_CTRL);

    if (vcom !== null) {
      // Write VCOM with configured endian
      if (this.vcomEndian === EndianTypes.LITTLE) {
        cmd[7] = vcom & 0xff;          // Low byte first
        cmd[8] = (vcom >> 8) & 0xff;   // High byte second
      } else {
        cmd[7] = (vcom >> 8) & 0xff;   // High byte first
        cmd[8] = vcom & 0xff;          // Low byte second
      }
      cmd[9] = 1; // Set VCOM
    }

    if (powerOn !== null) {
      cmd[10] = 1; // Do power control
      cmd[11] = powerOn ? 1 : 0;
    }

    await this.scsiCommand(cmd);
  }

  /**
   * Read a device register (legacy support - not available over USB SCSI)
   */
  async readRegister(_address: Registers): Promise<number> {
    // IT8951 USB doesn't have direct register access via SCSI
    // This is mainly for SPI interface compatibility
    console.warn("Register access not fully supported over USB SCSI interface");
    return 0;
  }

  /**
   * Write to a device register (legacy support - not available over USB SCSI)
   */
  async writeRegister(_address: Registers, _value: number): Promise<void> {
    // IT8951 USB doesn't have direct register access via SCSI
    console.warn("Register access not fully supported over USB SCSI interface");
  }

  /**
   * Fast Write Memory command (0xA5)
   * @param addr - Target memory address
   * @param data - Data to write
   * @remarks Supports up to 30MB/s write speed. Uses optimized SCSI command for bulk writes.
   */
  async fastWriteMemory(addr: number, data: Buffer): Promise<void> {
    const cmd = Buffer.from(SCSI_FAST_WRITE);
    
    // Set address in command (bytes 2-5, big-endian)
    cmd.writeUInt32BE(addr, 2);
    
    // Set data length (bytes 7-10, big-endian)
    cmd.writeUInt32BE(data.length, 7);
    
    // Write command and data
    await this.scsiWrite(cmd, data);
  }

  /**
   * Transfer data out to the device
   */
  private async transferOut(buffer: Buffer): Promise<void> {
    if (!this.endpointOut) {
      throw new Error("Device not opened");
    }

    return new Promise((resolve, reject) => {
      this.endpointOut!.transfer(buffer, (error: Error | null | undefined) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Transfer data in from the device
   */
  private async transferIn(length: number): Promise<Buffer> {
    if (!this.endpointIn) {
      throw new Error("Device not opened");
    }

    return new Promise((resolve, reject) => {
      this.endpointIn!.transfer(length, (error: Error | null | undefined, buffer?: Buffer) => {
        if (error) {
          reject(error);
        } else if (!buffer) {
          reject(new Error("No data received"));
        } else {
          resolve(buffer);
        }
      });
    });
  }

  /**
   * Check if device is connected
   */
  isConnected(): boolean {
    return this.device !== null;
  }

  /**
   * Get image buffer address
   */
  get imageBufferAddress(): number {
    return this._imageBufferAddress;
  }
}
