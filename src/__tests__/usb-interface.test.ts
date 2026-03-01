/**
 * USB Interface Test Suite
 * Tests for USB communication layer
 */

import { USBInterface } from '../usb-interface.js';

describe('USBInterface', () => {
  let usbInterface: USBInterface;

  beforeEach(() => {
    usbInterface = new USBInterface();
  });

  describe('constructor', () => {
    it('should create with default vendor and product IDs', () => {
      expect(usbInterface).toBeInstanceOf(USBInterface);
    });

    it('should create with custom vendor and product IDs', () => {
      const customVendor = 0x1234;
      const customProduct = 0x5678;
      const customInterface = new USBInterface({
        vendorId: customVendor,
        productId: customProduct,
      });
      expect(customInterface).toBeInstanceOf(USBInterface);
    });

    it('should create with custom timeout', () => {
      const customInterface = new USBInterface({ timeout: 10000 });
      expect(customInterface).toBeInstanceOf(USBInterface);
    });
  });

  describe('isConnected', () => {
    it('should return false when not opened', () => {
      expect(usbInterface.isConnected()).toBe(false);
    });
  });

  describe('close', () => {
    it('should handle close without open gracefully', () => {
      expect(() => usbInterface.close()).not.toThrow();
    });
  });
});
