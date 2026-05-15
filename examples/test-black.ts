/**
 * Simple Test: Display solid black to test if display works
 */

import { DisplayModes } from "../src/index.js";
import { createEPD, logHardwareUsage, sleep } from "./example-utils.js";

async function main() {
  console.log("IT8951 Simple Black Test");
  console.log("=======================\n");
  logHardwareUsage("examples/test-black.ts");

  const epd = createEPD();

  try {
    console.log("Initializing display...");
    await epd.init();
    console.log(`Display size: ${epd.width} x ${epd.height}`);
    console.log(`Image buffer address: 0x${epd.imageBufferAddress.toString(16)}\n`);

    // Wait after init
    await sleep(500);

    // IMPORTANT: First clear the display to ensure white background
    console.log("Step 1: Clearing display to white background...");
    await epd.clear();
    console.log("Display cleared - background should now be WHITE.\n");

    // Wait a moment
    await sleep(1000);

    // Test with a small area (100x100 pixels)
    const testWidth = 100;
    const testHeight = 100;
    const testX = 100;
    const testY = 100;

    console.log(`Step 2: Testing small area: ${testWidth}x${testHeight} at (${testX},${testY})...`);
    const smallBuffer = new Uint8Array(testWidth * testHeight).fill(0x00); // 0x00 = black

    // Load and display small area
    console.log("Loading small black area...");
    await epd.loadImageArea(smallBuffer, {
      x: testX,
      y: testY,
      width: testWidth,
      height: testHeight,
    });

    console.log("Displaying small area with GC16 mode...");
    await epd.displayArea(testX, testY, testWidth, testHeight, DisplayModes.GC16);

    console.log("Small area test passed!");
    console.log(">>> You should see: WHITE background + BLACK 100x100 square at (100,100)\n");

    // Wait 5 seconds to observe
    console.log("Waiting 5 seconds to observe result...");
    await sleep(5000);

    // Final clear
    console.log("\nStep 3: Final clear...");
    await epd.clear();
    console.log("Test complete! Screen should be fully WHITE now.");
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      console.error("Stack:", error.stack);
    }
    process.exit(1);
  } finally {
    epd.close();
    process.exit(0);
  }
}

main();
