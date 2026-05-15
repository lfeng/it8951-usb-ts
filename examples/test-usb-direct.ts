/**
 * Test using new USBInterface directly (bypassing EPD class)
 */

import { USBInterface } from "../src/usb-interface.js";
import { DisplayModes } from "../src/constants.js";
import {
  createUSBInterface,
  logHardwareUsage,
  resolveVCOMMillivolts,
  sleep,
} from "./example-utils.js";

async function main() {
  console.log("=== Test New USBInterface Directly ===\n");
  logHardwareUsage("examples/test-usb-direct.ts");

  const usb: USBInterface = createUSBInterface();

  try {
    console.log("Opening device...");
    await usb.open();

    console.log("Getting device info...");
    const info = await usb.getDeviceInfo();
    console.log(`Display: ${info.width}x${info.height}`);
    console.log(`Buffer address: 0x${info.imageBufferAddress.toString(16)}\n`);

    // Set VCOM
    console.log("Setting VCOM...");
    await usb.setPowerVcom(resolveVCOMMillivolts(), true);
    await sleep(500);

    // Clear to white using USBInterface directly
    console.log("\n=== CLEAR TO WHITE ===");
    const whiteBuffer = Buffer.alloc(info.width * info.height, 0xff);
    console.log(
      `White buffer: ${whiteBuffer.length} bytes, first 10: ${whiteBuffer.subarray(0, 10).toString("hex")}`,
    );

    console.log("Loading white image...");
    await usb.loadImageArea(0, 0, info.width, info.height, whiteBuffer);

    console.log("Display INIT...");
    await usb.displayArea(0, 0, info.width, info.height, DisplayModes.INIT, true);
    console.log("Waiting 2.5s...");
    await sleep(2500);

    console.log("Display GC16...");
    await usb.displayArea(0, 0, info.width, info.height, DisplayModes.GC16, true);
    await sleep(1100);

    console.log("\n>>> Screen should be WHITE now <<<\n");
    await sleep(3000);

    // Black square
    console.log("=== BLACK SQUARE ===");
    const blackBuffer = Buffer.alloc(100 * 100, 0x00);
    console.log(
      `Black buffer: ${blackBuffer.length} bytes, first 10: ${blackBuffer.subarray(0, 10).toString("hex")}`,
    );

    console.log("Loading black square at (100,100)...");
    await usb.loadImageArea(100, 100, 100, 100, blackBuffer);

    console.log("Display GC16...");
    await usb.displayArea(100, 100, 100, 100, DisplayModes.GC16, true);

    console.log("\n>>> Should see WHITE + BLACK square <<<\n");
    await sleep(5000);

    // Final clear
    console.log("=== FINAL CLEAR ===");
    await usb.loadImageArea(0, 0, info.width, info.height, whiteBuffer);
    await usb.displayArea(0, 0, info.width, info.height, DisplayModes.INIT, true);
    await sleep(2500);

    console.log("Test complete!");
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) console.error("Stack:", error.stack);
    process.exit(1);
  } finally {
    usb.close();
    process.exit(0);
  }
}

main();
