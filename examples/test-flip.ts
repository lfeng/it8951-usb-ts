/**
 * Test image flip/transform for IT8951 USB mode
 * 
 * Some IT8951 USB implementations require image data to be flipped
 * (both vertically and horizontally) before sending.
 */

import { DisplayModes } from "../src/index.js";
import { createEPD, logHardwareUsage, sleep } from "./example-utils.js";

async function main() {
  console.log("IT8951 Image Flip Test");
  console.log("======================\n");
  logHardwareUsage("examples/test-flip.ts");

  const epd = createEPD();

  try {
    console.log("Initializing display...");
    await epd.init();

    const width = epd.width;
    const height = epd.height;
    console.log(`Display size: ${width} × ${height}`);

    // Test 1: Flip both vertically and horizontally (180 degree rotation)
    console.log("\n=== Test 1: Flip V+H (180° rotation) ===");
    await epd.clear();
    await sleep(1000);

    // Create original gradient
    const originalBuffer = new Uint8Array(width * height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        originalBuffer[y * width + x] = Math.floor((x / width) * 255);
      }
    }

    // Flip both V and H (equivalent to 180° rotation)
    const flippedVH = new Uint8Array(width * height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const srcIndex = y * width + x;
        // Flip: destination (height-1-y, width-1-x)
        const dstIndex = (height - 1 - y) * width + (width - 1 - x);
        flippedVH[dstIndex] = originalBuffer[srcIndex];
      }
    }

    console.log("Sending flipped (V+H) image...");
    await epd.loadImageArea(flippedVH);
    await epd.displayArea(0, 0, width, height, DisplayModes.GC16);

    console.log("Check: Should show smooth gradient if V+H flip is needed");
    await sleep(5000);

    // Test 2: Swap adjacent bytes (16-bit endian swap)
    console.log("\n=== Test 2: 16-bit byte swap ===");
    await epd.clear();
    await sleep(1000);

    // Swap every 2 adjacent bytes
    const swapped = Buffer.from(originalBuffer);
    for (let i = 0; i < swapped.length - 1; i += 2) {
      const temp = swapped[i];
      swapped[i] = swapped[i + 1];
      swapped[i + 1] = temp;
    }

    console.log("Sending byte-swapped image...");
    await epd.loadImageArea(swapped);
    await epd.displayArea(0, 0, width, height, DisplayModes.GC16);

    console.log("Check: Should show smooth gradient if byte swap is needed");
    await sleep(5000);

    // Test 3: Only vertical flip
    console.log("\n=== Test 3: Only vertical flip ===");
    await epd.clear();
    await sleep(1000);

    const flippedV = new Uint8Array(width * height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const srcIndex = y * width + x;
        const dstIndex = (height - 1 - y) * width + x;
        flippedV[dstIndex] = originalBuffer[srcIndex];
      }
    }

    console.log("Sending vertically flipped image...");
    await epd.loadImageArea(flippedV);
    await epd.displayArea(0, 0, width, height, DisplayModes.GC16);

    console.log("Check: Should show smooth gradient if V flip is needed");
    await sleep(5000);

    // Test 4: Only horizontal flip
    console.log("\n=== Test 4: Only horizontal flip ===");
    await epd.clear();
    await sleep(1000);

    const flippedH = new Uint8Array(width * height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const srcIndex = y * width + x;
        const dstIndex = y * width + (width - 1 - x);
        flippedH[dstIndex] = originalBuffer[srcIndex];
      }
    }

    console.log("Sending horizontally flipped image...");
    await epd.loadImageArea(flippedH);
    await epd.displayArea(0, 0, width, height, DisplayModes.GC16);

    console.log("Check: Should show smooth gradient if H flip is needed");
    await sleep(5000);

    // Clean up
    console.log("\nClearing display...");
    await epd.clear();

    console.log("\nTest complete!");
    console.log("Which test showed a smooth horizontal gradient (black on left, white on right)?");

  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : String(error));
    if (error instanceof Error) {
      console.error("Stack:", error.stack);
    }
    process.exit(1);
  } finally {
    epd.close();
    process.exit(0);
  }
}

main();
