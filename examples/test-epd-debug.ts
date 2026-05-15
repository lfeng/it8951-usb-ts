/**
 * Debug test for EPD class
 */

import { DisplayModes } from "../src/index.js";
import { createEPD, logHardwareUsage, sleep } from "./example-utils.js";

async function main() {
  console.log("=== EPD Class Debug Test ===\n");
  logHardwareUsage("examples/test-epd-debug.ts");

  const epd = createEPD();

  try {
    console.log("Initializing...");
    await epd.init();
    console.log(`EPD width: ${epd.width}, height: ${epd.height}`);
    console.log(`Buffer address: 0x${epd.imageBufferAddress.toString(16)}\n`);

    await sleep(500);

    // Create white buffer
    const bufferSize = epd.width * epd.height;
    console.log(`Buffer size: ${bufferSize} (${epd.width} x ${epd.height})`);

    const whiteBuffer = new Uint8Array(bufferSize).fill(0xff);
    console.log(`White buffer length: ${whiteBuffer.length}`);
    console.log(
      `White buffer first 10 bytes: ${Array.from(whiteBuffer.slice(0, 10))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(" ")}`,
    );
    console.log(
      `White buffer last 10 bytes: ${Array.from(whiteBuffer.slice(-10))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(" ")}`,
    );

    // Manually call loadImageArea to see what happens
    console.log("\n=== Loading white image via EPD.loadImageArea ===");
    await epd.loadImageArea(whiteBuffer);

    console.log("\n=== Display INIT ===");
    await epd.displayArea(0, 0, epd.width, epd.height, DisplayModes.INIT);
    console.log("Waiting 2.5s for INIT...");
    await sleep(2500);

    console.log("\n=== Display GC16 ===");
    await epd.displayArea(0, 0, epd.width, epd.height, DisplayModes.GC16);
    await sleep(1100);

    console.log("\n>>> Screen should be WHITE now <<<\n");
    await sleep(3000);

    // Black square
    console.log("=== BLACK SQUARE ===");
    const blackBuffer = new Uint8Array(100 * 100).fill(0x00);
    console.log(`Black buffer: ${blackBuffer.length} bytes`);

    await epd.loadImageArea(blackBuffer, { x: 100, y: 100, width: 100, height: 100 });
    await epd.displayArea(100, 100, 100, 100, DisplayModes.GC16);

    console.log("\n>>> Should see WHITE + BLACK square <<<");
    await sleep(5000);

    console.log("\nTest complete!");
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) console.error("Stack:", error.stack);
    process.exit(1);
  } finally {
    epd.close();
    process.exit(0);
  }
}

main();
