/**
 * Slideshow Example: Cycle through images in a slideshow
 *
 * This example demonstrates how to:
 * - Load multiple BMP images
 * - Display them in sequence
 * - Use different display modes
 *
 * Usage:
 *   npx tsx examples/slideshow.ts [interval_seconds]
 *
 * Default interval is 5 seconds between images.
 */

import * as path from "path";
import { fileURLToPath } from "url";
import { DisplayModes } from "../src/index.js";
import { createEPD, logHardwareUsage } from "./example-utils.js";
import {
  readBMP,
  findMatchingImages,
  findAvailableResolutions,
  scaleImage,
} from "./bmp-utils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log("IT8951 Slideshow Example");
  console.log("========================\n");
  logHardwareUsage("examples/slideshow.ts");

  // Get interval from command line (default 5 seconds)
  const interval = parseInt(process.argv[2] || "5", 10) * 1000;
  console.log(`Slideshow interval: ${interval / 1000} seconds\n`);

  const epd = createEPD();

  try {
    console.log("Initializing display...");
    await epd.init();

    console.log(`Display size: ${epd.width} x ${epd.height}`);
    console.log(`Firmware version: ${epd.firmwareVersion}\n`);

    const picDir = path.join(__dirname, "pic");

    // Find images matching display resolution
    let imagePaths = findMatchingImages(picDir, epd.width, epd.height);

    if (imagePaths.length === 0) {
      // If no matching images, find the closest resolution
      const available = findAvailableResolutions(picDir);
      console.log("No exact resolution match. Available resolutions:");
      available.forEach(([w, h]) => console.log(`  - ${w}x${h}`));

      // Find closest resolution
      let closestRes: [number, number] | null = null;
      let closestDiff = Infinity;

      for (const [w, h] of available) {
        const diff = Math.abs(w - epd.width) + Math.abs(h - epd.height);
        if (diff < closestDiff) {
          closestDiff = diff;
          closestRes = [w, h];
        }
      }

      if (closestRes) {
        console.log(`\nUsing closest resolution: ${closestRes[0]}x${closestRes[1]}`);
        imagePaths = findMatchingImages(picDir, closestRes[0], closestRes[1]);
      }
    }

    // Filter out gif sequence images for regular slideshow
    const regularImages = imagePaths.filter((p) => !p.includes("_gif_"));

    if (regularImages.length === 0) {
      throw new Error("No slideshow images found");
    }

    console.log(`Found ${regularImages.length} images for slideshow:\n`);
    regularImages.forEach((p) => console.log(`  - ${path.basename(p)}`));
    console.log();

    // Clear display
    console.log("Clearing display...\n");
    await epd.clear();

    // Slideshow loop
    let imageIndex = 0;
    let running = true;

    // Handle Ctrl+C gracefully
    process.on("SIGINT", () => {
      console.log("\n\nStopping slideshow...");
      running = false;
    });

    console.log("Starting slideshow... (Press Ctrl+C to stop)\n");
    console.log("=".repeat(50) + "\n");

    while (running) {
      const imagePath = regularImages[imageIndex];
      console.log(
        `[${imageIndex + 1}/${regularImages.length}] Displaying: ${path.basename(imagePath)}`
      );

      // Read and display image
      let image = readBMP(imagePath);

      // Scale if needed
      if (image.width !== epd.width || image.height !== epd.height) {
        image = scaleImage(image, epd.width, epd.height);
      }

      await epd.loadImageArea(image.pixels);
      await epd.displayArea(0, 0, epd.width, epd.height, DisplayModes.GC16);

      console.log("  Done. Waiting for next image...\n");

      // Wait for interval or until stopped
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(resolve, interval);
        if (!running) {
          clearTimeout(timeout);
          resolve();
        }
      });

      // Move to next image
      imageIndex = (imageIndex + 1) % regularImages.length;
    }

    // Clear display before exit
    console.log("Clearing display before exit...");
    await epd.clear();

    console.log("Slideshow completed!");
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
