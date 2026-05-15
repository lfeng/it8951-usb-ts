/**
 * Simple gradient test - verify data is correctly transmitted
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
  console.log("=== Simple Gradient Test ===\n");
  logHardwareUsage("examples/test-gradient.ts");

  const usb: USBInterface = createUSBInterface();

  try {
    await usb.open();
    await usb.identify();
    const info = await usb.getDeviceInfo();
    console.log(`Display: ${info.width}x${info.height}`);

    await usb.setPowerVcom(resolveVCOMMillivolts(), true);
    await sleep(500);

    // Clear to white first
    console.log("Clearing to white...");
    const whiteBuffer = Buffer.alloc(info.width * info.height, 0xff);
    await usb.loadImageArea(0, 0, info.width, info.height, whiteBuffer);
    await usb.displayArea(0, 0, info.width, info.height, DisplayModes.INIT, true);
    await sleep(2500);

    // Create gradient buffer using Buffer directly (not Uint8Array)
    console.log("Creating gradient buffer...");
    const gradientBuffer = Buffer.alloc(info.width * info.height);
    
    for (let y = 0; y < info.height; y++) {
      for (let x = 0; x < info.width; x++) {
        const index = y * info.width + x;
        // Horizontal gradient: black (0) on left, white (255) on right
        gradientBuffer[index] = Math.floor((x / info.width) * 255);
      }
    }

    console.log(`Gradient buffer size: ${gradientBuffer.length}`);
    console.log(`First row sample: ${gradientBuffer[0]}, ${gradientBuffer[100]}, ${gradientBuffer[500]}, ${gradientBuffer[1000]}`);
    console.log(`Last row sample: ${gradientBuffer[gradientBuffer.length - info.width]}, ${gradientBuffer[gradientBuffer.length - 1]}`);

    console.log("\nLoading gradient...");
    await usb.loadImageArea(0, 0, info.width, info.height, gradientBuffer);
    
    console.log("Displaying with GC16...");
    await usb.displayArea(0, 0, info.width, info.height, DisplayModes.GC16, true);

    console.log("\n>>> Should see horizontal gradient: BLACK on left, WHITE on right <<<");
    await sleep(5000);

    console.log("\nTest complete!");
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  } finally {
    usb.close();
    process.exit(0);
  }
}

main();
