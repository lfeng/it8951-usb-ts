/**
 * Display Modes Example: Compare different display modes
 *
 * This example demonstrates the visual differences between display modes:
 * - INIT: Full initialization refresh (slow, best quality)
 * - GC16: 16-level grayscale (medium speed, high quality)
 * - GL16: 16-level grayscale with ghosting reduction
 * - DU:   Direct Update (fast, black/white only)
 * - DU4:  4-level grayscale DU mode
 * - A2:   Animation mode (fastest, lowest quality)
 *
 * Usage:
 *   npx tsx examples/display-modes.ts
 */

import * as path from "path";
import { fileURLToPath } from "url";
import { EPD, DisplayModes } from "../src/index.js";
import {
  readBMP,
  findMatchingImages,
  findAvailableResolutions,
  scaleImage,
} from "./bmp-utils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Display mode descriptions
const MODE_INFO: Record<number, { name: string; description: string }> = {
  [DisplayModes.INIT]: {
    name: "INIT",
    description: "Full refresh - Slow, eliminates ghosting completely",
  },
  [DisplayModes.DU]: {
    name: "DU",
    description: "Direct Update - Fast, black/white only, some ghosting",
  },
  [DisplayModes.GC16]: {
    name: "GC16",
    description: "Grayscale 16 - Medium speed, high quality, 16 gray levels",
  },
  [DisplayModes.GL16]: {
    name: "GL16",
    description: "Grayscale 16 with flashing - Reduces ghosting artifacts",
  },
  [DisplayModes.A2]: {
    name: "A2",
    description: "Animation - Fastest mode, lowest quality, for video/animation",
  },
  [DisplayModes.DU4]: {
    name: "DU4",
    description: "Direct Update 4-level - Fast with 4 gray levels",
  },
};

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log("IT8951 Display Modes Comparison");
  console.log("================================\n");

  const epd = new EPD({ vcom: -2.06 });

  try {
    console.log("Initializing display...");
    await epd.init();

    console.log(`Display size: ${epd.width} x ${epd.height}`);
    console.log(`Firmware version: ${epd.firmwareVersion}\n`);

    const picDir = path.join(__dirname, "pic");

    // Find test images
    let imagePaths = findMatchingImages(picDir, epd.width, epd.height);

    if (imagePaths.length === 0) {
      const available = findAvailableResolutions(picDir);
      if (available.length > 0) {
        const [w, h] = available[0];
        imagePaths = findMatchingImages(picDir, w, h);
      }
    }

    // Filter regular images
    const testImages = imagePaths.filter((p) => !p.includes("_gif_"));

    if (testImages.length === 0) {
      throw new Error("No test images found");
    }

    // Load first test image
    let testImage = readBMP(testImages[0]);
    if (testImage.width !== epd.width || testImage.height !== epd.height) {
      testImage = scaleImage(testImage, epd.width, epd.height);
    }

    console.log(`Using test image: ${path.basename(testImages[0])}\n`);

    // Modes to demonstrate
    const modesToTest = [
      DisplayModes.INIT,
      DisplayModes.GC16,
      DisplayModes.GL16,
      DisplayModes.DU,
      DisplayModes.DU4,
      DisplayModes.A2,
    ];

    // Initial clear
    console.log("Clearing display...\n");
    await epd.clear();

    console.log("Display Mode Comparison Test");
    console.log("============================\n");
    console.log("Each mode will display the same image.\n");
    console.log("Watch for differences in:\n");
    console.log("  - Refresh speed");
    console.log("  - Image quality");
    console.log("  - Grayscale levels");
    console.log("  - Ghosting artifacts\n");
    console.log("-".repeat(60) + "\n");

    for (const mode of modesToTest) {
      const info = MODE_INFO[mode] || { name: `Mode ${mode}`, description: "Unknown mode" };

      console.log(`Testing: ${info.name}`);
      console.log(`  ${info.description}`);

      // Clear first to make differences more visible
      console.log("  Clearing...");
      const clearBuffer = new Uint8Array(epd.width * epd.height).fill(0xff);
      await epd.loadImageArea(clearBuffer);
      await epd.displayArea(0, 0, epd.width, epd.height, DisplayModes.DU);
      await epd.waitDisplayReady();

      await sleep(500);

      // Display image with the test mode
      console.log(`  Displaying with ${info.name} mode...`);
      const startTime = Date.now();

      await epd.loadImageArea(testImage.pixels);
      await epd.displayArea(0, 0, epd.width, epd.height, mode);
      await epd.waitDisplayReady();

      const elapsed = Date.now() - startTime;
      console.log(`  Complete! (${elapsed}ms)\n`);

      // Wait to observe the result
      console.log("  Observe the display for 4 seconds...\n");
      await sleep(4000);
    }

    // Summary
    console.log("=".repeat(60) + "\n");
    console.log("Display Mode Summary:");
    console.log("-".repeat(60));
    console.log("Mode    | Speed     | Quality   | Best For");
    console.log("-".repeat(60));
    console.log("INIT    | Slow      | Excellent | Initial clear, remove ghosting");
    console.log("GC16    | Medium    | High      | Photos, detailed images");
    console.log("GL16    | Medium    | High      | Text on images, reduce ghosting");
    console.log("DU      | Fast      | Medium    | Text, UI updates");
    console.log("DU4     | Fast      | Medium    | Simple graphics with grays");
    console.log("A2      | Fastest   | Low       | Animation, video playback");
    console.log("-".repeat(60) + "\n");

    // Clear display before exit
    console.log("Clearing display before exit...");
    await epd.clear();

    console.log("Display modes demo completed!");
  } catch (error) {
    console.error(
      "Error:",
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  } finally {
    epd.close();
    process.exit(0);
  }
}

main();
