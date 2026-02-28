/**
 * Animation Example: Play image sequences (GIF-like animation)
 *
 * This example demonstrates how to:
 * - Load a sequence of BMP images
 * - Play them as an animation using fast display modes
 * - Use A2 mode for fastest animation playback
 *
 * Usage:
 *   npx tsx examples/animation.ts [fps]
 *
 * Default fps is 2 (e-paper has limited refresh rate)
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { EPD, DisplayModes } from "../src/index.js";
import {
  readBMP,
  scaleImage,
  findAvailableResolutions,
  BMPImage,
} from "./bmp-utils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Find GIF sequence images in the pic directory
 */
function findGifSequence(picDir: string): string[] {
  const files = fs.readdirSync(picDir);

  // Look for files with _gif_ pattern
  const gifFiles = files
    .filter((f) => f.includes("_gif_") && f.endsWith(".bmp"))
    .sort((a, b) => {
      // Sort by frame number
      const numA = parseInt(a.match(/_gif_(\d+)/)?.[1] || "0", 10);
      const numB = parseInt(b.match(/_gif_(\d+)/)?.[1] || "0", 10);
      return numA - numB;
    })
    .map((f) => path.join(picDir, f));

  return gifFiles;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log("IT8951 Animation Example");
  console.log("========================\n");

  // Get FPS from command line (default 2)
  const fps = parseInt(process.argv[2] || "2", 10);
  const frameDelay = Math.floor(1000 / fps);

  console.log(`Target FPS: ${fps} (${frameDelay}ms per frame)\n`);
  console.log("Note: E-paper displays have limited refresh rates.");
  console.log("A2 mode provides fastest refresh but lowest quality.\n");

  const epd = new EPD({ vcom: -2.06 });

  try {
    console.log("Initializing display...");
    await epd.init();

    console.log(`Display size: ${epd.width} x ${epd.height}`);
    console.log(`Firmware version: ${epd.firmwareVersion}\n`);

    const picDir = path.join(__dirname, "pic");

    // Find GIF sequence
    const gifFrames = findGifSequence(picDir);

    if (gifFrames.length === 0) {
      console.log("No GIF sequence found.");
      console.log("Looking for regular image sequence...\n");

      // Fall back to using regular images as animation
      const available = findAvailableResolutions(picDir);
      if (available.length > 0) {
        const [w, h] = available[0];
        const files = fs.readdirSync(picDir);
        const regularImages = files
          .filter((f) => f.startsWith(`${w}x${h}_`) && !f.includes("_gif_") && f.endsWith(".bmp"))
          .sort()
          .map((f) => path.join(picDir, f));

        if (regularImages.length > 0) {
          gifFrames.push(...regularImages);
          console.log(`Using ${regularImages.length} regular images as animation frames.\n`);
        }
      }
    }

    if (gifFrames.length === 0) {
      throw new Error("No animation frames found");
    }

    console.log(`Found ${gifFrames.length} animation frames:\n`);
    gifFrames.forEach((f, i) => console.log(`  Frame ${i}: ${path.basename(f)}`));
    console.log();

    // Preload all frames for smoother animation
    console.log("Preloading frames...");
    const frames: BMPImage[] = [];

    for (const framePath of gifFrames) {
      let frame = readBMP(framePath);
      if (frame.width !== epd.width || frame.height !== epd.height) {
        frame = scaleImage(frame, epd.width, epd.height);
      }
      frames.push(frame);
    }
    console.log("Frames preloaded!\n");

    // Clear display
    console.log("Clearing display...\n");
    await epd.clear();

    // Animation loop
    let running = true;
    let frameIndex = 0;
    let loopCount = 0;

    // Handle Ctrl+C gracefully
    process.on("SIGINT", () => {
      console.log("\n\nStopping animation...");
      running = false;
    });

    console.log("Starting animation... (Press Ctrl+C to stop)\n");
    console.log("Using A2 mode for fastest refresh.\n");
    console.log("-".repeat(50) + "\n");

    const startTime = Date.now();
    let totalFrames = 0;

    while (running) {
      const frame = frames[frameIndex];

      process.stdout.write(`\rLoop ${loopCount + 1}, Frame ${frameIndex + 1}/${frames.length}  `);

      // Display frame using A2 mode for fastest update
      await epd.loadImageArea(frame.pixels);
      await epd.displayArea(0, 0, epd.width, epd.height, DisplayModes.A2);
      await epd.waitDisplayReady();

      totalFrames++;

      // Calculate actual frame time and add delay if needed
      const frameTime = Date.now() - startTime;
      const expectedTime = totalFrames * frameDelay;
      const remainingDelay = expectedTime - frameTime;

      if (remainingDelay > 0) {
        await sleep(remainingDelay);
      }

      // Move to next frame
      frameIndex++;
      if (frameIndex >= frames.length) {
        frameIndex = 0;
        loopCount++;

        // Every 3 loops, do a GC16 refresh to reduce ghosting
        if (loopCount % 3 === 0 && running) {
          console.log("\n\nPerforming anti-ghosting refresh...");
          await epd.displayArea(0, 0, epd.width, epd.height, DisplayModes.GC16);
          await epd.waitDisplayReady();
          console.log("Done. Resuming animation...\n");
        }
      }
    }

    // Calculate actual FPS
    const totalTime = (Date.now() - startTime) / 1000;
    const actualFps = totalFrames / totalTime;

    console.log("\n\nAnimation Statistics:");
    console.log(`  Total frames: ${totalFrames}`);
    console.log(`  Total time: ${totalTime.toFixed(1)}s`);
    console.log(`  Actual FPS: ${actualFps.toFixed(2)}`);
    console.log(`  Loops completed: ${loopCount}`);

    // Clear display with GC16 to remove ghosting
    console.log("\nClearing display (removing ghosting)...");
    await epd.clear();

    console.log("Animation demo completed!");
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
