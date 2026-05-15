/**
 * Compatibility smoke test for the maintained USBInterface implementation.
 *
 * This file used to embed a copy of the old low-level transport. It now keeps
 * the same script name but routes through the current protocol/USB stack.
 */

import { DisplayModes } from "../src/constants.js";
import {
  createUSBInterface,
  logHardwareUsage,
  resolveVCOMMillivolts,
  sleep,
} from "./example-utils.js";

async function main(): Promise<void> {
  console.log("=== Maintained USBInterface Compatibility Test ===\n");
  logHardwareUsage("examples/test-original.ts");

  const usb = createUSBInterface({ timeout: 10000 });

  try {
    console.log("Opening device...");
    await usb.open();

    console.log("Identifying device...");
    const identity = await usb.identify();
    console.log(identity);

    console.log("\nReading device info...");
    const info = await usb.getDeviceInfo();
    console.log(`Display: ${info.width}x${info.height}`);
    console.log(`Image buffer: 0x${info.imageBufferAddress.toString(16)}`);
    console.log(`Command table: ${info.firmwareVersion}\n`);

    console.log("Setting VCOM...");
    await usb.setPowerVcom(resolveVCOMMillivolts(), true);
    await sleep(500);

    console.log("Clearing to white...");
    const white = Buffer.alloc(info.width * info.height, 0xff);
    await usb.loadImageArea(0, 0, info.width, info.height, white);
    await usb.displayArea(0, 0, info.width, info.height, DisplayModes.INIT, true);
    await sleep(2500);
    await usb.displayArea(0, 0, info.width, info.height, DisplayModes.GC16, true);
    await sleep(1100);

    console.log("Drawing 100x100 black square at (100,100)...");
    const black = Buffer.alloc(100 * 100, 0x00);
    await usb.loadImageArea(100, 100, 100, 100, black);
    await usb.displayArea(100, 100, 100, 100, DisplayModes.GC16, true);

    console.log("\nExpected: white background with a black 100x100 square.");
    await sleep(5000);
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      console.error("Stack:", error.stack);
    }
    process.exit(1);
  } finally {
    usb.close();
    process.exit(0);
  }
}

main();
