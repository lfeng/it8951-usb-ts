/**
 * IT8951 USB Display Driver
 * 
 * Node.js + TypeScript driver for IT8951 e-paper display controllers
 * 
 * @packageDocumentation
 */

// Export constants
export {
  Commands,
  Rotate,
  PixelModes,
  DisplayModes,
  EndianTypes,
  Registers,
  LOW_BPP_MODES,
  DEFAULT_DISPLAY_MODES,
  USB_VENDOR_ID,
  USB_PRODUCT_ID,
} from './constants.js';

// Export types
export type {
  DeviceInfo,
  USBInterfaceOptions,
} from './usb-interface.js';

export type {
  EPDConfig,
  ImageArea,
} from './epd.js';

export type {
  AutoDisplayOptions,
  BoundingBox,
} from './auto-display.js';

// Export classes
export { USBInterface } from './usb-interface.js';
export { EPD } from './epd.js';
export { AutoDisplay, AutoEPDDisplay } from './auto-display.js';
