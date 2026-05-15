/**
 * Test the current USB LD_IMG_AREA 8BPP pixel path
 * 
 * The public USB LD_IMG_AREA path sends one byte per pixel. PixelModes still
 * exposes datasheet constants for lower-bpp host-interface experiments, but
 * this maintained example validates the current 8BPP USB transfer path.
 */

import { DisplayModes } from "../src/index.js";
import { createEPD, logHardwareUsage, sleep } from "./example-utils.js";

async function main() {
  console.log("IT8951 Pixel Format Test (USB 8BPP)");
  console.log("====================================\n");
  logHardwareUsage("examples/test-pixel-format.ts");

  const epd = createEPD();

  try {
    console.log("Initializing display...");
    await epd.init();

    const width = epd.width;
    const height = epd.height;
    console.log(`Display size: ${width} × ${height}`);

    // Clear display first
    console.log("\nClearing display...");
    await epd.clear();
    await sleep(1000);

    console.log("\n=== Test: 8BPP data with 16-level quantization ===");
    
    // Create 8BPP gradient but only use values 0, 17, 34, ... 255 (16 levels)
    const buffer8BPP = new Uint8Array(width * height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = y * width + x;
        // Map x position to 16 levels, then scale to 0-255
        const level = Math.floor((x / width) * 16);
        buffer8BPP[index] = Math.min(255, level * 17); // 0, 17, 34, ... 255
      }
    }
    
    console.log("Sending quantized 8BPP data...");
    await epd.loadImageArea(buffer8BPP);
    await epd.displayArea(0, 0, width, height, DisplayModes.GC16);
    
    console.log("\nCheck if quantized gradient displays correctly.");
    
    await sleep(5000);
    
    // Clean up
    console.log("\nClearing display...");
    await epd.clear();

    console.log("\nTest complete!");

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
