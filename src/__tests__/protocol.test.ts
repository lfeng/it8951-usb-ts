import { EndianTypes, SCSICommands, SCSIError } from "../constants.js";
import {
  CBW_LENGTH,
  CSW_SIGNATURE_VALUE,
  DISPLAY_AREA_ARGUMENT_LENGTH,
  GET_SYSTEM_INFO_LENGTH,
  IT8951_SIGNATURE_BE,
  LOAD_IMAGE_AREA_ARGUMENT_LENGTH,
  MAX_USB_TRANSFER_SIZE,
  buildCBW,
  buildDisplayAreaPayload,
  buildGetSystemInfoCommand,
  buildLoadImageAreaPayload,
  buildMemoryCommand,
  buildPowerVcomCommand,
  indexedBufferAddress,
  isIT8951Inquiry,
  parseInquiryResponse,
  parseSystemInfo,
  splitImageAreaRows,
} from "../protocol.js";

describe("IT8951 USB protocol helpers", () => {
  it("builds the documented GET_SYS CDB", () => {
    expect(buildGetSystemInfoCommand()).toEqual(
      Buffer.from([
        0xfe,
        0x00,
        0x38,
        0x39,
        0x35,
        0x31,
        0x80,
        0x00,
        0x01,
        0x00,
        0x02,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
      ]),
    );
  });

  it("builds CBWs with matching tag, direction, and command length", () => {
    const command = buildGetSystemInfoCommand();
    const cbw = buildCBW(command, GET_SYSTEM_INFO_LENGTH, "in", 0x12345678);

    expect(cbw).toHaveLength(CBW_LENGTH);
    expect(cbw.subarray(0, 4)).toEqual(Buffer.from([0x55, 0x53, 0x42, 0x43]));
    expect(cbw.readUInt32LE(4)).toBe(0x12345678);
    expect(cbw.readUInt32LE(8)).toBe(GET_SYSTEM_INFO_LENGTH);
    expect(cbw[12]).toBe(0x80);
    expect(cbw[14]).toBe(16);
    expect(cbw.subarray(15, 31)).toEqual(command);
  });

  it("builds PMIC/VCOM command bytes in documented big-endian order", () => {
    const command = buildPowerVcomCommand(2500, true, EndianTypes.BIG);

    expect(command[6]).toBe(SCSICommands.PMIC_CTRL);
    expect(command[7]).toBe(0x09);
    expect(command[8]).toBe(0xc4);
    expect(command[9]).toBe(1);
    expect(command[10]).toBe(1);
    expect(command[11]).toBe(1);
  });

  it("supports legacy little-endian VCOM order behind the explicit option", () => {
    const command = buildPowerVcomCommand(2500, false, EndianTypes.LITTLE);

    expect(command[7]).toBe(0xc4);
    expect(command[8]).toBe(0x09);
    expect(command[11]).toBe(0);
  });

  it("builds FAST_WRITE_MEM CDB with address at CDB[2..5] and length at CDB[7..8]", () => {
    const command = buildMemoryCommand(SCSICommands.FAST_WRITE_MEM, 0x12345678, 0x2345);

    expect(command[0]).toBe(0xfe);
    expect(command.subarray(2, 6)).toEqual(Buffer.from([0x12, 0x34, 0x56, 0x78]));
    expect(command[6]).toBe(SCSICommands.FAST_WRITE_MEM);
    expect(command.subarray(7, 9)).toEqual(Buffer.from([0x23, 0x45]));
  });

  it("builds LD_IMG_AREA payload with 20-byte big-endian header followed by pixels", () => {
    const pixels = Buffer.from([1, 2, 3, 4, 5, 6]);
    const payload = buildLoadImageAreaPayload(
      0x01020304,
      { x: 5, y: 6, width: 3, height: 2 },
      pixels,
    );

    expect(payload).toHaveLength(LOAD_IMAGE_AREA_ARGUMENT_LENGTH + pixels.length);
    expect(payload.readUInt32BE(0)).toBe(0x01020304);
    expect(payload.readUInt32BE(4)).toBe(5);
    expect(payload.readUInt32BE(8)).toBe(6);
    expect(payload.readUInt32BE(12)).toBe(3);
    expect(payload.readUInt32BE(16)).toBe(2);
    expect(payload.subarray(LOAD_IMAGE_AREA_ARGUMENT_LENGTH)).toEqual(pixels);
  });

  it("builds DPY_AREA payload with documented argument order", () => {
    const payload = buildDisplayAreaPayload(
      0x01020304,
      2,
      { x: 5, y: 6, width: 7, height: 8 },
      true,
    );

    expect(payload).toHaveLength(DISPLAY_AREA_ARGUMENT_LENGTH);
    expect(payload.readUInt32BE(0)).toBe(0x01020304);
    expect(payload.readUInt32BE(4)).toBe(2);
    expect(payload.readUInt32BE(8)).toBe(5);
    expect(payload.readUInt32BE(12)).toBe(6);
    expect(payload.readUInt32BE(16)).toBe(7);
    expect(payload.readUInt32BE(20)).toBe(8);
    expect(payload.readUInt32BE(24)).toBe(1);
  });

  it("splits image rows without exceeding the IT8951 USB transfer limit", () => {
    const data = Buffer.from(Array.from({ length: 30 }, (_, index) => index));
    const chunks = splitImageAreaRows(
      { x: 10, y: 20, width: 5, height: 6 },
      data,
      LOAD_IMAGE_AREA_ARGUMENT_LENGTH + 12,
    );

    expect(chunks.map((chunk) => chunk.area)).toEqual([
      { x: 10, y: 20, width: 5, height: 2 },
      { x: 10, y: 22, width: 5, height: 2 },
      { x: 10, y: 24, width: 5, height: 2 },
    ]);
    for (const chunk of chunks) {
      expect(chunk.data.length + LOAD_IMAGE_AREA_ARGUMENT_LENGTH).toBeLessThanOrEqual(
        LOAD_IMAGE_AREA_ARGUMENT_LENGTH + 12,
      );
    }
  });

  it("keeps common full-width panels in one-row-or-larger chunks under the default limit", () => {
    const width = 1872;
    const maxImageBytes = MAX_USB_TRANSFER_SIZE - LOAD_IMAGE_AREA_ARGUMENT_LENGTH;

    expect(Math.floor(maxImageBytes / width)).toBeGreaterThan(1);
  });

  it("encodes indexed buffer addresses using bit 31 plus the low index nibble", () => {
    expect(indexedBufferAddress(0)).toBe(0x80000000);
    expect(indexedBufferAddress(15)).toBe(0x8000000f);
    expect(() => indexedBufferAddress(16)).toThrow(RangeError);
  });

  it("parses standard SCSI inquiry strings and recognizes the IT8951 RamDisc identity", () => {
    const response = Buffer.alloc(36);
    response.write("Generic ", 8, "ascii");
    response.write("Storage RamDisc ", 16, "ascii");
    response.write("1.00", 32, "ascii");

    const inquiry = parseInquiryResponse(response);

    expect(inquiry).toEqual({
      vendorId: "Generic",
      productId: "Storage RamDisc",
      revision: "1.00",
    });
    expect(isIT8951Inquiry(inquiry)).toBe(true);
  });

  it("parses and validates GET_SYS response data", () => {
    const response = Buffer.alloc(GET_SYSTEM_INFO_LENGTH);
    response.writeUInt32BE(1, 0);
    response.writeUInt32BE(2, 4);
    response.writeUInt32BE(IT8951_SIGNATURE_BE, 8);
    response.writeUInt32BE(0x00010203, 12);
    response.writeUInt32BE(1872, 16);
    response.writeUInt32BE(1404, 20);
    response.writeUInt32BE(0x01000000, 24);
    response.writeUInt32BE(0x02000000, 28);
    response.writeUInt32BE(3, 32);
    response.writeUInt32BE(8, 36);
    response.writeUInt32BE(16, 40);
    response.writeUInt32BE(4, 72);

    const parsed = parseSystemInfo(response);

    expect(parsed.width).toBe(1872);
    expect(parsed.height).toBe(1404);
    expect(parsed.updateBufBase).toBe(0x01000000);
    expect(parsed.imageBufBase).toBe(0x02000000);
    expect(parsed.frameCounts[0]).toBe(16);
    expect(parsed.numImgBuf).toBe(4);
  });

  it("rejects invalid GET_SYS signatures", () => {
    const response = Buffer.alloc(GET_SYSTEM_INFO_LENGTH);
    response.writeUInt32BE(0, 8);

    expect(() => parseSystemInfo(response)).toThrow(SCSIError);
  });

  it("uses the standard CSW signature value from USB bulk-only transport", () => {
    expect(CSW_SIGNATURE_VALUE).toBe(0x53425355);
  });
});
