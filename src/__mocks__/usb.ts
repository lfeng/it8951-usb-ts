/**
 * Mock for the 'usb' module
 */

import { USB_VENDOR_ID, USB_PRODUCT_ID } from '../constants.js';

export const mockTransferOut = jest.fn();
export const mockTransferIn = jest.fn();
export const mockOpen = jest.fn();
export const mockClose = jest.fn();
export const mockClaim = jest.fn();
export const mockRelease = jest.fn();
export const mockIsKernelDriverActive = jest.fn(() => false);
export const mockDetachKernelDriver = jest.fn();

export const mockOutEndpoint = {
  transfer: mockTransferOut,
  direction: 'out' as const,
  transferType: 2,
  timeout: 5000,
};

export const mockInEndpoint = {
  transfer: mockTransferIn,
  direction: 'in' as const,
  transferType: 2,
  timeout: 5000,
};

export const mockInterface = {
  isKernelDriverActive: mockIsKernelDriverActive,
  detachKernelDriver: mockDetachKernelDriver,
  claim: mockClaim,
  release: mockRelease,
  endpoints: [mockOutEndpoint, mockInEndpoint],
};

export const mockDevice = {
  deviceDescriptor: {
    idVendor: USB_VENDOR_ID,
    idProduct: USB_PRODUCT_ID,
  },
  open: mockOpen,
  close: mockClose,
  interfaces: [mockInterface],
};

export const getDeviceList = jest.fn(() => [mockDevice]);

export const Device = jest.fn();
export const Interface = jest.fn();
export const InEndpoint = jest.fn();
export const OutEndpoint = jest.fn();
