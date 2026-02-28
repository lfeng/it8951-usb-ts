/**
 * Basic Example: Initialize display and show test pattern
 */

import { EPD, DisplayModes } from '../src/index.js';

async function main() {
  console.log('IT8951 Basic Example');
  console.log('====================\n');

  const epd = new EPD({ vcom: -2.06 });

  try {
    console.log('Initializing display...');
    await epd.init();

    console.log(`Display size: ${epd.width} x ${epd.height}`);
    console.log(`Firmware version: ${epd.firmwareVersion}`);
    console.log(`LUT version: ${epd.lutVersion}`);
    console.log();

    // Clear display
    console.log('Clearing display...');
    await epd.clear();
    console.log('Display cleared!\n');

    // Create gradient test pattern
    console.log('Drawing gradient...');
    const buffer = new Uint8Array(epd.width * epd.height);
    
    for (let y = 0; y < epd.height; y++) {
      for (let x = 0; x < epd.width; x++) {
        const index = y * epd.width + x;
        buffer[index] = Math.floor((x / epd.width) * 255);
      }
    }

    await epd.loadImageArea(buffer);
    await epd.displayArea(0, 0, epd.width, epd.height, DisplayModes.GC16);
    await epd.waitDisplayReady();
    
    console.log('Gradient displayed!\n');
    console.log('Example completed!');

  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    epd.close();
  }
}

main();
