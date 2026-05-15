import {
  EPD,
  EndianTypes,
  VCOM_PRESETS,
  type EPDConfig,
  type VCOMPreset,
} from "../src/index.js";
import { USBInterface, type USBInterfaceOptions } from "../src/usb-interface.js";

export const SAFE_REFRESH_DELAY_MS = 1100;
export const DEFAULT_VCOM_PRESET: VCOMPreset = "WAVESHARE_7_8INCH";

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function resolveVCOM(): number | VCOMPreset {
  const raw = process.env.IT8951_VCOM ?? process.env.VCOM;
  if (!raw || raw.trim() === "") {
    return DEFAULT_VCOM_PRESET;
  }

  const value = raw.trim();
  const normalizedPreset = value.toUpperCase().replace(/[-\s]+/g, "_");
  if (normalizedPreset in VCOM_PRESETS) {
    return normalizedPreset as VCOMPreset;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(
      `Invalid VCOM "${value}". Use volts such as -2.3 or a preset such as ${DEFAULT_VCOM_PRESET}.`,
    );
  }

  return parsed > 0 ? -parsed : parsed;
}

export function resolveVCOMMillivolts(): number {
  const vcom = resolveVCOM();
  const volts = typeof vcom === "string" ? VCOM_PRESETS[vcom] : vcom;
  return Math.round(Math.abs(volts) * 1000);
}

export function describeVCOM(vcom: number | VCOMPreset = resolveVCOM()): string {
  if (typeof vcom === "string") {
    return `${vcom} (${VCOM_PRESETS[vcom]}V)`;
  }
  return `${vcom}V`;
}

export function createEPD(config: EPDConfig = {}): EPD {
  const vcom = config.vcom ?? resolveVCOM();
  console.log(`Using VCOM: ${describeVCOM(vcom)}`);
  return new EPD({
    ...config,
    vcom,
    vcomEndian: config.vcomEndian ?? EndianTypes.BIG,
  });
}

export function createUSBInterface(options: USBInterfaceOptions = {}): USBInterface {
  return new USBInterface({
    ...options,
    vcomEndian: options.vcomEndian ?? EndianTypes.BIG,
  });
}

export function logHardwareUsage(script: string): void {
  console.log(`Usage: sudo env "PATH=$PATH" IT8951_VCOM=-2.3 npx tsx ${script}`);
  console.log(`Default VCOM: ${describeVCOM(DEFAULT_VCOM_PRESET)}`);
  console.log("Set IT8951_VCOM to the value printed on your panel FPC label before display tests.\n");
}
