/**
 * Basic Example: Initialize display and show test pattern
 *
 * Supports 7.8-inch e-paper display (1872 × 1404 pixels, 16 grayscale)
 * Based on IT8951 V0.2.4.3 specification and 7.8inch e-Paper Specification
 */

import { DisplayModes, DISPLAY_PRESETS } from "../src/index.js";
import { createEPD, logHardwareUsage, sleep } from "./example-utils.js";

async function main() {
  console.log("IT8951 Basic Example");
  console.log("====================\n");
  logHardwareUsage("examples/basic.ts");

  const epd = createEPD();

  try {
    console.log("Initializing display...");
    await epd.init();

    // 显示设备信息
    console.log(`Display size: ${epd.width} × ${epd.height}`);
    console.log(`Firmware version: ${epd.firmwareVersion}`);
    console.log(`LUT version: ${epd.lutVersion}`);

    // 验证是否为 7.8 寸屏幕
    const preset = DISPLAY_PRESETS.WAVESHARE_7_8INCH;
    if (epd.width === preset.width && epd.height === preset.height) {
      console.log("✓ Detected 7.8-inch display (1872×1404)");
    }
    console.log();

    // Clear display using optimized method
    console.log("Clearing display (INIT mode, ~2s)...");
    await epd.clear();
    console.log("Display cleared!\n");

    // Create gradient test pattern
    // Note: Device reports width/height in its coordinate system
    // The gradient goes from left (black) to right (white)
    console.log("Drawing horizontal gradient...");
    
    // Use Buffer.alloc directly for best compatibility with USB transfer
    const buffer = Buffer.alloc(epd.width * epd.height);

    for (let y = 0; y < epd.height; y++) {
      for (let x = 0; x < epd.width; x++) {
        const index = y * epd.width + x;
        // Horizontal gradient: black (0) on left, white (255) on right
        buffer[index] = Math.floor((x / epd.width) * 255);
      }
    }

    await epd.loadImageArea(buffer);
    await epd.displayArea(0, 0, epd.width, epd.height, DisplayModes.GC16);
    await epd.waitDisplayReady();

    console.log("Gradient displayed!\n");

    // Wait a moment to show the gradient
    console.log("Waiting 3 seconds...");
    await sleep(3000);

    // Wait before clearing
    await sleep(1100);

    // Clear display before exit
    console.log("Clearing display before exit...");
    await epd.clear();
    await epd.waitDisplayReady();
    console.log("Display cleared!\n");

    console.log("Example completed!");
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    epd.close();
    process.exit(0);
  }
}

main();
