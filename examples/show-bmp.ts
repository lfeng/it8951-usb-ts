/**
 * Show BMP Example: Display a BMP image file on the e-paper display
 *
 * This example demonstrates how to:
 * - Load a BMP image file
 * - Convert it to grayscale
 * - Display it with automatic resolution matching
 *
 * Usage:
 *   npx tsx examples/show-bmp.ts [image_path]
 *
 * If no image path is provided, it will try to find a matching image
 * from examples/pic based on the display resolution.
 */

import * as path from "path";
import { fileURLToPath } from "url";
import { EPD, DisplayModes } from "../src/index.js";
import {
  readBMP,
  findMatchingImages,
  scaleImage,
  centerImage,
  findAvailableResolutions,
} from "./bmp-utils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log("IT8951 Show BMP Example");
  console.log("=======================\n");

  const epd = new EPD({ vcom: -2.06 });

  try {
    console.log("Initializing display...");
    await epd.init();

    console.log(`Display size: ${epd.width} x ${epd.height}`);
    console.log(`Firmware version: ${epd.firmwareVersion}`);
    console.log(`LUT version: ${epd.lutVersion}\n`);

    // Determine image path
    let imagePath: string;
    const picDir = path.join(__dirname, "pic");

    if (process.argv[2]) {
      // Use provided image path
      imagePath = process.argv[2];
      console.log(`Using provided image: ${imagePath}`);
    } else {
      // Find matching image based on display resolution
      const matchingImages = findMatchingImages(picDir, epd.width, epd.height);

      if (matchingImages.length > 0) {
        imagePath = matchingImages[0];
        console.log(`Found matching image: ${path.basename(imagePath)}`);
      } else {
        // List available resolutions
        const available = findAvailableResolutions(picDir);
        console.log("Available image resolutions:");
        available.forEach(([w, h]) => console.log(`  - ${w}x${h}`));

        // Use first available image and scale it
        if (available.length > 0) {
          const [w, h] = available[0];
          const firstImages = findMatchingImages(picDir, w, h);
          if (firstImages.length > 0) {
            imagePath = firstImages[0];
            console.log(`\nUsing and scaling: ${path.basename(imagePath)}`);
          } else {
            throw new Error("No images found in examples/pic");
          }
        } else {
          throw new Error("No images found in examples/pic");
        }
      }
    }

    // Read the BMP image
    console.log("\nReading BMP file...");
    let image = readBMP(imagePath);
    console.log(`Image size: ${image.width} x ${image.height}`);

    // Scale or center if needed
    if (image.width !== epd.width || image.height !== epd.height) {
      const widthRatio = epd.width / image.width;
      const heightRatio = epd.height / image.height;

      if (Math.abs(widthRatio - heightRatio) < 0.1) {
        // Similar aspect ratio - scale to fit
        console.log("Scaling image to fit display...");
        image = scaleImage(image, epd.width, epd.height);
      } else {
        // Different aspect ratio - center on white background
        console.log("Centering image on display...");
        const scale = Math.min(
          epd.width / image.width,
          epd.height / image.height
        );
        if (scale < 1) {
          // Scale down first
          const newWidth = Math.floor(image.width * scale);
          const newHeight = Math.floor(image.height * scale);
          image = scaleImage(image, newWidth, newHeight);
        }
        image = centerImage(image, epd.width, epd.height);
      }
    }

    // Clear display first
    console.log("\nClearing display...");
    await epd.clear();

    // Display the image
    console.log("Displaying image with GC16 mode (best quality)...");
    await epd.loadImageArea(image.pixels);
    await epd.displayArea(0, 0, epd.width, epd.height, DisplayModes.GC16);
    await epd.waitDisplayReady();

    console.log("\nImage displayed successfully!");
    console.log("Press Ctrl+C to exit (display will remain)");

    // Keep the program running
    await new Promise(() => {});
  } catch (error) {
    console.error(
      "Error:",
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  } finally {
    epd.close();
  }
}

main();
