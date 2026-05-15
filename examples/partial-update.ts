/**
 * Partial Update Example: Demonstrate efficient partial screen updates
 *
 * This example demonstrates how to:
 * - Update only specific regions of the display
 * - Use AutoEPDDisplay for automatic change detection
 * - Optimize refresh speed with partial updates
 *
 * Usage:
 *   npx tsx examples/partial-update.ts
 */

import { DisplayModes } from "../src/index.js";
import { createEPD, logHardwareUsage, sleep } from "./example-utils.js";

/**
 * Create a rectangular region with specified grayscale value
 */
function createRegion(
  width: number,
  height: number,
  grayValue: number
): Uint8Array {
  return new Uint8Array(width * height).fill(grayValue);
}

/**
 * Create a gradient rectangle
 */
function createGradientRegion(
  width: number,
  height: number,
  horizontal: boolean = true
): Uint8Array {
  const buffer = new Uint8Array(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (horizontal) {
        buffer[idx] = Math.floor((x / width) * 255);
      } else {
        buffer[idx] = Math.floor((y / height) * 255);
      }
    }
  }

  return buffer;
}

/**
 * Create a checkerboard pattern
 */
function createCheckerboard(
  width: number,
  height: number,
  squareSize: number = 20
): Uint8Array {
  const buffer = new Uint8Array(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const isWhite =
        (Math.floor(x / squareSize) + Math.floor(y / squareSize)) % 2 === 0;
      buffer[idx] = isWhite ? 255 : 0;
    }
  }

  return buffer;
}

async function main() {
  console.log("IT8951 Partial Update Example");
  console.log("==============================\n");
  logHardwareUsage("examples/partial-update.ts");

  const epd = createEPD({ minRefreshInterval: 250 });

  try {
    console.log("Initializing display...");
    await epd.init();

    console.log(`Display size: ${epd.width} x ${epd.height}`);
    console.log(`Firmware version: ${epd.firmwareVersion}\n`);

    // Clear display
    console.log("Clearing display...\n");
    await epd.clear();

    await sleep(1000);

    // ============================================
    // Demo 1: Manual partial updates
    // ============================================
    console.log("Demo 1: Manual Partial Updates");
    console.log("-".repeat(40) + "\n");

    // Define regions for partial updates
    const regionSize = Math.min(200, Math.floor(epd.width / 4));
    const spacing = Math.floor(regionSize / 2);

    const regions = [
      {
        name: "Top-Left",
        x: spacing,
        y: spacing,
        width: regionSize,
        height: regionSize,
      },
      {
        name: "Top-Right",
        x: epd.width - spacing - regionSize,
        y: spacing,
        width: regionSize,
        height: regionSize,
      },
      {
        name: "Bottom-Left",
        x: spacing,
        y: epd.height - spacing - regionSize,
        width: regionSize,
        height: regionSize,
      },
      {
        name: "Bottom-Right",
        x: epd.width - spacing - regionSize,
        y: epd.height - spacing - regionSize,
        width: regionSize,
        height: regionSize,
      },
      {
        name: "Center",
        x: Math.floor((epd.width - regionSize) / 2),
        y: Math.floor((epd.height - regionSize) / 2),
        width: regionSize,
        height: regionSize,
      },
    ];

    // Draw black squares in each region
    console.log("Drawing black squares in 5 positions...\n");

    for (const region of regions) {
      console.log(
        `  Updating ${region.name} (${region.x}, ${region.y}) ${region.width}x${region.height}...`
      );
      const blackRegion = createRegion(region.width, region.height, 0);

      const startTime = Date.now();
      await epd.displayPartial(
        blackRegion,
        region.x,
        region.y,
        region.width,
        region.height,
        DisplayModes.DU
      );
      console.log(`    Done in ${Date.now() - startTime}ms`);

      await sleep(500);
    }

    console.log("\nPartial update demo complete!");
    await sleep(2000);

    // ============================================
    // Demo 2: Pattern transitions
    // ============================================
    console.log("\nDemo 2: Pattern Transitions");
    console.log("-".repeat(40) + "\n");

    // Update center region with different patterns
    const centerX = Math.floor((epd.width - regionSize * 2) / 2);
    const centerY = Math.floor((epd.height - regionSize * 2) / 2);
    const centerWidth = regionSize * 2;
    const centerHeight = regionSize * 2;

    const patterns = [
      { name: "White", create: () => createRegion(centerWidth, centerHeight, 255) },
      { name: "Black", create: () => createRegion(centerWidth, centerHeight, 0) },
      { name: "Gray (128)", create: () => createRegion(centerWidth, centerHeight, 128) },
      {
        name: "Horizontal Gradient",
        create: () => createGradientRegion(centerWidth, centerHeight, true),
      },
      {
        name: "Vertical Gradient",
        create: () => createGradientRegion(centerWidth, centerHeight, false),
      },
      { name: "Checkerboard", create: () => createCheckerboard(centerWidth, centerHeight, 20) },
    ];

    for (const pattern of patterns) {
      console.log(`  Displaying: ${pattern.name}...`);
      const buffer = pattern.create();

      const startTime = Date.now();
      await epd.displayPartial(
        buffer,
        centerX,
        centerY,
        centerWidth,
        centerHeight,
        DisplayModes.GC16
      );
      console.log(`    Done in ${Date.now() - startTime}ms`);

      await sleep(1500);
    }

    console.log("\nPattern transitions complete!");
    await sleep(1000);

    // ============================================
    // Demo 3: Sequential partial updates simulation
    // ============================================
    console.log("\nDemo 3: Sequential Partial Updates");
    console.log("-".repeat(40) + "\n");

    // Clear and start fresh
    console.log("Clearing display...");
    await epd.clear();
    await sleep(500);

    // Draw initial frame with border using direct EPD calls
    console.log("Setting up initial frame with border...\n");
    const fullFrameBuffer = new Uint8Array(epd.width * epd.height);

    // Fill with white
    fullFrameBuffer.fill(255);

    // Draw a simple border
    const borderWidth = 5;
    for (let y = 0; y < epd.height; y++) {
      for (let x = 0; x < epd.width; x++) {
        const idx = y * epd.width + x;
        if (
          x < borderWidth ||
          x >= epd.width - borderWidth ||
          y < borderWidth ||
          y >= epd.height - borderWidth
        ) {
          fullFrameBuffer[idx] = 0;
        }
      }
    }

    // Initial full update
    console.log("Drawing initial frame with border...");
    await epd.display(fullFrameBuffer, DisplayModes.GC16);
    await sleep(1000);

    // Now make small changes with partial updates
    console.log("\nMaking incremental changes with partial updates...\n");

    // Draw a series of small squares
    const smallSquareSize = 50;
    const numSquares = 5;

    for (let i = 0; i < numSquares; i++) {
      const squareX = Math.floor(100 + i * (smallSquareSize + 30));
      const squareY = Math.floor(epd.height / 2 - smallSquareSize / 2);

      console.log(`  Drawing square ${i + 1}/${numSquares} at (${squareX}, ${squareY})...`);

      // Create small buffer for just this square
      const squareBuffer = new Uint8Array(smallSquareSize * smallSquareSize);
      // Alternate between black and gray
      squareBuffer.fill(i % 2 === 0 ? 0 : 128);

      // Use partial update for just this region
      const startTime = Date.now();
      await epd.displayPartial(
        squareBuffer,
        squareX,
        squareY,
        smallSquareSize,
        smallSquareSize,
        DisplayModes.DU
      );
      console.log(`    Partial update completed in ${Date.now() - startTime}ms`);

      await sleep(800);
    }

    console.log("\nSequential partial updates demo complete!");
    await sleep(1000);

    // ============================================
    // Summary
    // ============================================
    console.log("\n" + "=".repeat(50));
    console.log("\nPartial Update Benefits:");
    console.log("-".repeat(50));
    console.log("1. SPEED: Only refresh changed regions");
    console.log("2. POWER: Less e-paper refresh = lower power consumption");
    console.log("3. QUALITY: Reduces overall ghosting by minimizing refreshes");
    console.log("4. UX: Faster UI response for interactive applications");
    console.log("-".repeat(50) + "\n");

    // Clear display before exit
    console.log("Clearing display before exit...");
    await epd.clear();

    console.log("Partial update demo completed!");
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
