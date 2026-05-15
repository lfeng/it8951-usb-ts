/**
 * USB Interface Test Suite
 * Tests for USB communication layer
 */

import { USBInterface } from '../usb-interface.js';
import { EndianTypes } from '../constants.js';
import { mockTransferOut, mockTransferIn } from '../__mocks__/usb.js';

const CBW_LENGTH = 31;
const CSW_LENGTH = 13;

function makeCsw(tag: number, status = 0): Buffer {
  const csw = Buffer.alloc(CSW_LENGTH);
  csw.writeUInt32LE(0x53425355, 0);
  csw.writeUInt32LE(tag, 4);
  csw.writeUInt32LE(0, 8);
  csw.writeUInt8(status, 12);
  return csw;
}

function makeInquiryResponse(): Buffer {
  const response = Buffer.alloc(36);
  response.write('Generic ', 8, 'ascii');
  response.write('Storage RamDisc ', 16, 'ascii');
  response.write('1.00', 32, 'ascii');
  return response;
}

describe('USBInterface', () => {
  let usbInterface: USBInterface;
  let outTransfers: Buffer[];

  beforeEach(() => {
    usbInterface = new USBInterface();
    outTransfers = [];

    mockTransferOut.mockImplementation((data: Buffer, callback: (error?: Error) => void) => {
      outTransfers.push(Buffer.from(data));
      callback();
    });

    mockTransferIn.mockImplementation((length: number, callback: (error?: Error, data?: Buffer) => void) => {
      if (length === 36) {
        callback(undefined, makeInquiryResponse());
        return;
      }

      const lastCbw = outTransfers.filter((transfer) => transfer.length === CBW_LENGTH).at(-1);
      const tag = lastCbw?.readUInt32LE(4) ?? 0;
      callback(undefined, makeCsw(tag));
    });
  });

  describe('constructor', () => {
    it('should create with default vendor and product IDs', () => {
      expect(usbInterface).toBeInstanceOf(USBInterface);
    });

    it('should create with custom vendor and product IDs', () => {
      const customInterface = new USBInterface({
        vendorId: 0x1234,
        productId: 0x5678,
      });
      expect(customInterface).toBeInstanceOf(USBInterface);
    });

    it('should create with custom timeout', () => {
      const customInterface = new USBInterface({ timeout: 10000 });
      expect(customInterface).toBeInstanceOf(USBInterface);
    });

    it('should create with custom vcomEndian', () => {
      const customInterface = new USBInterface({ vcomEndian: EndianTypes.BIG });
      expect(customInterface).toBeInstanceOf(USBInterface);
    });
  });

  describe('isConnected', () => {
    it('should return false when not opened', () => {
      expect(usbInterface.isConnected()).toBe(false);
    });

    it('should return true after opening a matching mock device', async () => {
      await usbInterface.open();

      expect(usbInterface.isConnected()).toBe(true);
    });
  });

  describe('close', () => {
    it('should handle close without open gracefully', () => {
      expect(() => usbInterface.close()).not.toThrow();
    });
  });

  describe('imageBufferAddress', () => {
    it('should throw if device not initialized', () => {
      expect(() => usbInterface.imageBufferAddress).toThrow('Device not initialized');
    });
  });

  describe('SCSI inquiry', () => {
    it('should parse the standard RamDisc identity', async () => {
      await usbInterface.open();

      const result = await usbInterface.identify();

      expect(result).toEqual({
        isIT8951: true,
        vendorId: 'Generic',
        productId: 'Storage RamDisc',
        revision: '1.00',
      });
    });
  });

  describe('loadImageArea', () => {
    it('should split image loads to stay under the configured USB transfer size', async () => {
      usbInterface = new USBInterface({ maxTransferBytes: 28 });
      await usbInterface.open();
      (usbInterface as unknown as { _imageBufferAddress: number })._imageBufferAddress = 0x01020304;

      await usbInterface.loadImageArea(1, 2, 4, 3, Buffer.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]));

      const cbws = outTransfers.filter((transfer) => transfer.length === CBW_LENGTH);
      const payloads = outTransfers.filter((transfer) => transfer.length !== CBW_LENGTH);

      expect(cbws).toHaveLength(2);
      expect(payloads.map((payload) => payload.length)).toEqual([28, 24]);
      expect(payloads[0].readUInt32BE(0)).toBe(0x01020304);
      expect(payloads[0].readUInt32BE(4)).toBe(1);
      expect(payloads[0].readUInt32BE(8)).toBe(2);
      expect(payloads[0].readUInt32BE(12)).toBe(4);
      expect(payloads[0].readUInt32BE(16)).toBe(2);
      expect(payloads[0].subarray(20)).toEqual(Buffer.from([0, 1, 2, 3, 4, 5, 6, 7]));
      expect(payloads[1].readUInt32BE(8)).toBe(4);
      expect(payloads[1].readUInt32BE(16)).toBe(1);
      expect(payloads[1].subarray(20)).toEqual(Buffer.from([8, 9, 10, 11]));
      expect(cbws.every((cbw) => cbw[21] === 0xa2)).toBe(true);
    });
  });

  describe('fastWriteMemory', () => {
    it('should encode FAST_WRITE_MEM address and length fields and chunk data', async () => {
      usbInterface = new USBInterface({ maxTransferBytes: 5 });
      await usbInterface.open();

      await usbInterface.fastWriteMemory(0x1000, Buffer.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]));

      const cbws = outTransfers.filter((transfer) => transfer.length === CBW_LENGTH);
      const payloads = outTransfers.filter((transfer) => transfer.length !== CBW_LENGTH);

      expect(cbws).toHaveLength(3);
      expect(payloads.map((payload) => [...payload])).toEqual([
        [0, 1, 2, 3, 4],
        [5, 6, 7, 8, 9],
        [10, 11],
      ]);

      expect(cbws.map((cbw) => cbw.readUInt32BE(17))).toEqual([0x1000, 0x1005, 0x100a]);
      expect(cbws.map((cbw) => cbw[21])).toEqual([0xa5, 0xa5, 0xa5]);
      expect(cbws.map((cbw) => cbw.readUInt16BE(22))).toEqual([5, 5, 2]);
    });
  });

  describe('setPowerVcom', () => {
    it('should send PMIC control as a no-data command and avoid an empty data phase', async () => {
      usbInterface = new USBInterface({ vcomEndian: EndianTypes.BIG });
      await usbInterface.open();

      await usbInterface.setPowerVcom(2500, true);

      expect(outTransfers).toHaveLength(1);
      const cbw = outTransfers[0];
      expect(cbw[21]).toBe(0xa3);
      expect(cbw[22]).toBe(0x09);
      expect(cbw[23]).toBe(0xc4);
      expect(cbw[24]).toBe(1);
      expect(cbw[25]).toBe(1);
      expect(cbw[26]).toBe(1);
    });
  });
});
