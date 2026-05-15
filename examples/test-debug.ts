/**
 * Current protocol debug test.
 *
 * Prints the maintained protocol CDBs, then performs a small hardware smoke
 * test through USBInterface.
 */

import { DisplayModes, EndianTypes, SCSICommands } from "../src/constants.js";
import {
  buildDisplayAreaCommand,
  buildGetSystemInfoCommand,
  buildLoadImageAreaCommand,
  buildMemoryCommand,
  buildPowerVcomCommand,
} from "../src/protocol.js";
import {
  createUSBInterface,
  logHardwareUsage,
  resolveVCOMMillivolts,
  sleep,
} from "./example-utils.js";

function hex(buffer: Buffer): string {
  return buffer.toString("hex").match(/.{1,2}/g)?.join(" ") ?? "";
}

function printProtocolSnapshot(vcomMillivolts: number): void {
  console.log("Current protocol command snapshot:");
  console.log(`  GET_SYS:        ${hex(buildGetSystemInfoCommand())}`);
  console.log(`  LD_IMG_AREA:    ${hex(buildLoadImageAreaCommand())}`);
  console.log(`  DPY_AREA:       ${hex(buildDisplayAreaCommand())}`);
  console.log(
    `  PMIC_CTRL:      ${hex(buildPowerVcomCommand(vcomMillivolts, true, EndianTypes.BIG))}`,
  );
  console.log(
    `  FAST_WRITE_MEM: ${hex(buildMemoryCommand(SCSICommands.FAST_WRITE_MEM, 0x12345678, 0x1000))}`,
  );
  console.log();
}

async function main(): Promise<void> {
  console.log("=== IT8951 Current Protocol Debug Test ===\n");
  logHardwareUsage("examples/test-debug.ts");

  const vcomMillivolts = resolveVCOMMillivolts();
  printProtocolSnapshot(vcomMillivolts);

  const usb = createUSBInterface({ timeout: 10000 });

  try {
    console.log("Opening device...");
    await usb.open();

    console.log("SCSI INQUIRY:");
    console.log(await usb.identify());

    console.log("\nGET_SYS:");
    const systemInfo = await usb.getSystemInfo();
    console.log(systemInfo);

    console.log("\nSetting VCOM and drawing a small black square...");
    await usb.setPowerVcom(vcomMillivolts, true);
    await sleep(500);

    const black = Buffer.alloc(64 * 64, 0x00);
    await usb.loadImageArea(0, 0, 64, 64, black);
    await usb.displayArea(0, 0, 64, 64, DisplayModes.GC16, true);

    console.log("Expected: 64x64 black square at top-left.");
    await sleep(5000);
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      console.error("Stack:", error.stack);
    }
    process.exit(1);
  } finally {
    usb.close();
    process.exit(0);
  }
}

main();
