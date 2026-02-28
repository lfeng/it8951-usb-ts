/**
 * USB Interface for IT8951 Display Controller
 * 
 * Handles USB communication with the IT8951 device
 */

import { getDeviceList, Device, Interface, InEndpoint, OutEndpoint } from 'usb';
import { Commands, Registers, USB_VENDOR_ID, USB_PRODUCT_ID } from './constants.js';

/** Device information returned by GET_DEV_INFO command */
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
}

/**
 * USB communication layer for IT8951
 */
export class USBInterface {
  private device: Device | null = null;
  private iface: Interface | null = null;
  private endpointOut: OutEndpoint | null = null;
  private endpointIn: InEndpoint | null = null;
  private vendorId: number;
  private productId: number;

  constructor(options: USBInterfaceOptions = {}) {
    this.vendorId = options.vendorId ?? USB_VENDOR_ID;
    this.productId = options.productId ?? USB_PRODUCT_ID;
  }

  /**
   * Find and open the IT8951 USB device
   */
  async open(): Promise<void> {
    const devices = getDeviceList();
    
    for (const device of devices) {
      if (device.deviceDescriptor.idVendor === this.vendorId &&
          device.deviceDescriptor.idProduct === this.productId) {
        this.device = device;
        break;
      }
    }

    if (!this.device) {
      throw new Error('IT8951 device not found. Make sure it is connected via USB.');
    }

    try {
      this.device.open();
      
      // Get the first interface
      const interfaces = this.device.interfaces;
      if (!interfaces || interfaces.length === 0) {
        throw new Error('No interfaces found on IT8951 device');
      }
      
      this.iface = interfaces[0];
      
      if (this.iface.isKernelDriverActive?.()) {
        this.iface.detachKernelDriver();
      }
      this.iface.claim();

      // Find bulk endpoints
      for (const ep of this.iface.endpoints) {
        const endpoint = ep as InEndpoint | OutEndpoint;
        if (endpoint.direction === 'out' && endpoint.transferType === 2) { // bulk = 2
          this.endpointOut = endpoint as OutEndpoint;
        } else if (endpoint.direction === 'in' && endpoint.transferType === 2) {
          this.endpointIn = endpoint as InEndpoint;
        }
      }

      if (!this.endpointOut || !this.endpointIn) {
        throw new Error('Required bulk endpoints not found');
      }

    } catch (error) {
      this.close();
      throw new Error(`Failed to open IT8951 device: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Close the USB device
   */
  close(): void {
    try {
      if (this.iface) {
        this.iface.release();
      }
      if (this.device) {
        this.device.close();
      }
    } catch (error) {
      console.warn('Warning: Error closing device:', error);
    }
    
    this.device = null;
    this.iface = null;
    this.endpointOut = null;
    this.endpointIn = null;
  }

  /**
   * Write a command to the device
   * @param cmd - Command code
   * @param args - Command arguments
   */
  async writeCommand(cmd: Commands, args: number[] = []): Promise<void> {
    if (!this.endpointOut) {
      throw new Error('Device not opened');
    }

    // Command packet format: [preamble_high, preamble_low, cmd_low, cmd_high, ...args]
    const preamble = 0x6000;
    const buffer = Buffer.alloc(4 + args.length * 2);
    
    buffer.writeUInt16BE(preamble, 0);
    buffer.writeUInt16LE(cmd, 2);
    
    for (let i = 0; i < args.length; i++) {
      buffer.writeUInt16LE(args[i], 4 + i * 2);
    }

    await this.transferOut(buffer);
  }

  /**
   * Write data to the device
   * @param data - Array of 16-bit values
   */
  async writeData(data: number[]): Promise<void> {
    if (!this.endpointOut) {
      throw new Error('Device not opened');
    }

    const preamble = 0x0000;
    const buffer = Buffer.alloc(2 + data.length * 2);
    
    buffer.writeUInt16BE(preamble, 0);
    
    for (let i = 0; i < data.length; i++) {
      buffer.writeUInt16LE(data[i], 2 + i * 2);
    }

    await this.transferOut(buffer);
  }

  /**
   * Read data from the device
   * @param count - Number of 16-bit words to read
   * @returns Array of 16-bit values
   */
  async readData(count: number): Promise<number[]> {
    if (!this.endpointIn) {
      throw new Error('Device not opened');
    }

    const preamble = 0x1000;
    const preambleBuffer = Buffer.alloc(2);
    preambleBuffer.writeUInt16BE(preamble, 0);
    
    // Send read request
    await this.transferOut(preambleBuffer);
    
    // Read response (2 bytes preamble + count * 2 bytes data)
    const responseLength = 2 + count * 2;
    const responseBuffer = await this.transferIn(responseLength);
    
    const result: number[] = [];
    for (let i = 0; i < count; i++) {
      const value = responseBuffer.readUInt16LE(2 + i * 2);
      result.push(value);
    }
    
    return result;
  }

  /**
   * Read a single 16-bit integer from the device
   */
  async readInt(): Promise<number> {
    const data = await this.readData(1);
    return data[0];
  }

  /**
   * Read a device register
   * @param address - Register address
   */
  async readRegister(address: Registers): Promise<number> {
    await this.writeCommand(Commands.REG_RD, [address]);
    return await this.readInt();
  }

  /**
   * Write to a device register
   * @param address - Register address
   * @param value - Value to write
   */
  async writeRegister(address: Registers, value: number): Promise<void> {
    await this.writeCommand(Commands.REG_WR, [address]);
    await this.writeData([value]);
  }

  /**
   * Get device information
   */
  async getDeviceInfo(): Promise<DeviceInfo> {
    await this.writeCommand(Commands.GET_DEV_INFO);
    const data = await this.readData(20);

    if (data.every(x => x === 0)) {
      throw new Error('Communication with device failed');
    }

    const width = data[0];
    const height = data[1];
    const imageBufferAddress = (data[3] << 16) | data[2];
    
    // Decode firmware and LUT versions
    const decodeVersion = (start: number): string => {
      let version = '';
      for (let i = start; i < start + 8; i++) {
        version += String.fromCharCode(data[i] >> 8);
        version += String.fromCharCode(data[i] & 0xFF);
      }
      return version.replace(/\0/g, '').trim();
    };

    const firmwareVersion = decodeVersion(4);
    const lutVersion = decodeVersion(12);

    return {
      width,
      height,
      imageBufferAddress,
      firmwareVersion,
      lutVersion,
    };
  }

  /**
   * Transfer data out to the device
   */
  private async transferOut(buffer: Buffer): Promise<void> {
    if (!this.endpointOut) {
      throw new Error('Device not opened');
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
      throw new Error('Device not opened');
    }

    return new Promise((resolve, reject) => {
      this.endpointIn!.transfer(length, (error: Error | null | undefined, buffer?: Buffer) => {
        if (error) {
          reject(error);
        } else if (!buffer) {
          reject(new Error('No data received'));
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
}
