/**
 * Test different row alignments to diagnose display issues
 */

import { DisplayModes } from "../src/index.js";
import { createEPD, logHardwareUsage, sleep } from "./example-utils.js";

async function main() {
  console.log("IT8951 Alignment Test");
  console.log("=====================\n");
  logHardwareUsage("examples/test-alignment.ts");

  const epd = createEPD();

  try {
    console.log("Initializing display...");
    await epd.init();

    console.log(`Display size: ${epd.width} × ${epd.height}`);
    console.log(`Image buffer address: 0x${epd.getDeviceInfo().imageBufferAddress.toString(16)}`);

    // Calculate different possible alignments
    const width = epd.width;
    const height = epd.height;
    
    console.log(`\nWidth: ${width}`);
    console.log(`Width % 4: ${width % 4}`);
    console.log(`Width % 8: ${width % 8}`);
    console.log(`Width % 16: ${width % 16}`);
    console.log(`Width % 32: ${width % 32}`);
    
    // Try with aligned row width of 2048
    const alignedWidth = 2048;
    console.log(`\nTesting with aligned row width: ${alignedWidth}`);
    console.log(`Padding per row: ${alignedWidth - width} bytes`);

    // Clear display first
    console.log("\nClearing display...");
    await epd.clear();
    
    // Wait for clear to complete
    await sleep(1000);

    // Create gradient with aligned rows
    console.log("\nCreating gradient with aligned rows...");
    const alignedBuffer = new Uint8Array(alignedWidth * height);
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < alignedWidth; x++) {
        const index = y * alignedWidth + x;
        if (x < width) {
          // Create horizontal gradient (0 at left, 255 at right)
          alignedBuffer[index] = Math.floor((x / width) * 255);
        } else {
          // Padding - fill with white
          alignedBuffer[index] = 0xFF;
        }
      }
    }

    // Send aligned source rows through the public API. The EPD layer crops each
    // aligned source row back to the visible display width before USB transfer.
    console.log("Sending aligned source image data...");
    await epd.loadImageArea(alignedBuffer, { width: alignedWidth, height });
    
    // Display only the visible portion
    console.log("Displaying...");
    await epd.displayArea(0, 0, width, height, DisplayModes.GC16);

    console.log("\nTest complete! Check if the gradient displays correctly.");
    console.log("Expected: Smooth horizontal gradient from black (left) to white (right)");
    
    // Wait a bit to see the result
    await sleep(5000);

    // Clean up
    console.log("\nClearing display...");
    await epd.clear();

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
