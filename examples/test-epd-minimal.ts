/**
 * Minimal EPD test - exactly matching test-with-identify.ts flow
 */

import { DisplayModes } from "../src/index.js";
import { createEPD, logHardwareUsage, sleep } from "./example-utils.js";

async function main() {
  console.log("=== Minimal EPD Test ===\n");
  logHardwareUsage("examples/test-epd-minimal.ts");

  const epd = createEPD();

  try {
    console.log("Initializing...");
    await epd.init();
    console.log(`Display: ${epd.width}x${epd.height}`);
    console.log(`Buffer: 0x${epd.imageBufferAddress.toString(16)}\n`);

    await sleep(500);

    // Clear - using EPD.clear() which now directly calls usb.loadImageArea
    console.log("=== CLEAR TO WHITE (via EPD.clear) ===");
    await epd.clear();

    console.log("\n>>> Screen should be WHITE now <<<\n");
    await sleep(3000);

    console.log("=== BLACK SQUARE ===");
    const blackBuffer = new Uint8Array(100 * 100).fill(0x00);
    await epd.displayPartial(blackBuffer, 100, 100, 100, 100, DisplayModes.GC16);

    console.log("\n>>> Should see WHITE + BLACK square <<<\n");
    await sleep(5000);

    console.log("Test complete!");
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  } finally {
    epd.close();
    process.exit(0);
  }
}

main();
