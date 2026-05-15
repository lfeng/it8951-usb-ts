import {
  EndianTypes,
  SCSICommands,
  SCSIError,
} from "./constants.js";

export const CBW_LENGTH = 31;
export const CSW_LENGTH = 13;
export const SCSI_CDB_LENGTH = 16;
export const GET_SYSTEM_INFO_LENGTH = 112;
export const STANDARD_INQUIRY_LENGTH = 36;
export const LOAD_IMAGE_AREA_ARGUMENT_LENGTH = 20;
export const DISPLAY_AREA_ARGUMENT_LENGTH = 28;
export const MAX_USB_TRANSFER_SIZE = 60 * 1024;

export const CBW_SIGNATURE = Buffer.from([0x55, 0x53, 0x42, 0x43]);
export const CSW_SIGNATURE_VALUE = 0x53425355;
export const IT8951_SIGNATURE_BE = 0x38393531;
export const IT8951_CUSTOM_COMMAND = 0xfe;

export type TransferDirection = "in" | "out";

export interface Region {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface ParsedSystemInfo {
  readonly standardCmdNo: number;
  readonly extendCmdNo: number;
  readonly signature: number;
  readonly version: number;
  readonly width: number;
  readonly height: number;
  readonly updateBufBase: number;
  readonly imageBufBase: number;
  readonly temperatureNo: number;
  readonly modeNo: number;
  readonly frameCounts: readonly number[];
  readonly numImgBuf: number;
}

export interface ParsedInquiry {
  readonly vendorId: string;
  readonly productId: string;
  readonly revision: string;
}

export interface ImageAreaChunk {
  readonly area: Region;
  readonly data: Buffer;
}

export function buildCBW(
  command: Buffer,
  dataLength: number,
  direction: TransferDirection,
  tag: number,
): Buffer {
  if (command.length !== SCSI_CDB_LENGTH) {
    throw new RangeError(`SCSI command must be ${SCSI_CDB_LENGTH} bytes, got ${command.length}`);
  }
  assertUInt(dataLength, 32, "dataLength");
  assertUInt(tag, 32, "tag");

  const cbw = Buffer.alloc(CBW_LENGTH);
  CBW_SIGNATURE.copy(cbw, 0);
  cbw.writeUInt32LE(tag, 4);
  cbw.writeUInt32LE(dataLength, 8);
  cbw.writeUInt8(direction === "in" ? 0x80 : 0x00, 12);
  cbw.writeUInt8(0, 13);
  cbw.writeUInt8(SCSI_CDB_LENGTH, 14);
  command.copy(cbw, 15);
  return cbw;
}

export function buildInquiryCommand(allocationLength = STANDARD_INQUIRY_LENGTH): Buffer {
  assertUInt(allocationLength, 8, "allocationLength");

  const command = Buffer.alloc(SCSI_CDB_LENGTH);
  command[0] = SCSICommands.INQUIRY;
  command[4] = allocationLength;
  return command;
}

export function buildGetSystemInfoCommand(): Buffer {
  return Buffer.from([
    IT8951_CUSTOM_COMMAND,
    0x00,
    0x38,
    0x39,
    0x35,
    0x31,
    SCSICommands.GET_SYS,
    0x00,
    0x01,
    0x00,
    0x02,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
  ]);
}

export function buildNoArgumentCommand(commandCode: SCSICommands): Buffer {
  const command = Buffer.alloc(SCSI_CDB_LENGTH);
  command[0] = IT8951_CUSTOM_COMMAND;
  command[6] = commandCode;
  return command;
}

export function buildLoadImageAreaCommand(): Buffer {
  return buildNoArgumentCommand(SCSICommands.LD_IMG_AREA);
}

export function buildDisplayAreaCommand(indexed = false): Buffer {
  return buildNoArgumentCommand(indexed ? SCSICommands.DPY_BUF_AREA : SCSICommands.DPY_AREA);
}

export function buildPowerVcomCommand(
  vcomMillivolts: number | null,
  powerOn: boolean,
  endian: EndianTypes = EndianTypes.BIG,
): Buffer {
  const command = buildNoArgumentCommand(SCSICommands.PMIC_CTRL);

  if (vcomMillivolts !== null) {
    assertUInt(vcomMillivolts, 16, "vcomMillivolts");
    if (endian === EndianTypes.LITTLE) {
      command.writeUInt16LE(vcomMillivolts, 7);
    } else {
      command.writeUInt16BE(vcomMillivolts, 7);
    }
    command[9] = 1;
  }

  command[10] = 1;
  command[11] = powerOn ? 1 : 0;
  return command;
}

export function buildMemoryCommand(
  commandCode: SCSICommands.READ_MEM | SCSICommands.WRITE_MEM | SCSICommands.FAST_WRITE_MEM,
  address: number,
  length: number,
): Buffer {
  assertUInt(address, 32, "address");
  assertUInt(length, 16, "length");

  const command = Buffer.alloc(SCSI_CDB_LENGTH);
  command[0] = IT8951_CUSTOM_COMMAND;
  command.writeUInt32BE(address, 2);
  command[6] = commandCode;
  command.writeUInt16BE(length, 7);
  return command;
}

export function buildLoadImageAreaPayload(address: number, area: Region, imageData: Buffer): Buffer {
  assertUInt(address, 32, "address");
  assertRegion(area);
  assertImageDataLength(area, imageData);

  const payload = Buffer.alloc(LOAD_IMAGE_AREA_ARGUMENT_LENGTH + imageData.length);
  payload.writeUInt32BE(address, 0);
  payload.writeUInt32BE(area.x, 4);
  payload.writeUInt32BE(area.y, 8);
  payload.writeUInt32BE(area.width, 12);
  payload.writeUInt32BE(area.height, 16);
  imageData.copy(payload, LOAD_IMAGE_AREA_ARGUMENT_LENGTH);
  return payload;
}

export function buildDisplayAreaPayload(
  address: number,
  mode: number,
  area: Region,
  waitReady: boolean,
): Buffer {
  assertUInt(address, 32, "address");
  assertUInt(mode, 32, "mode");
  assertRegion(area);

  const payload = Buffer.alloc(DISPLAY_AREA_ARGUMENT_LENGTH);
  payload.writeUInt32BE(address, 0);
  payload.writeUInt32BE(mode, 4);
  payload.writeUInt32BE(area.x, 8);
  payload.writeUInt32BE(area.y, 12);
  payload.writeUInt32BE(area.width, 16);
  payload.writeUInt32BE(area.height, 20);
  payload.writeUInt32BE(waitReady ? 1 : 0, 24);
  return payload;
}

export function indexedBufferAddress(index: number): number {
  assertBufferIndex(index);
  return 0x80000000 + index;
}

export function splitImageAreaRows(
  area: Region,
  imageData: Buffer,
  maxTransferBytes = MAX_USB_TRANSFER_SIZE,
): ImageAreaChunk[] {
  assertRegion(area);
  assertImageDataLength(area, imageData);

  const maxImageBytes = maxTransferBytes - LOAD_IMAGE_AREA_ARGUMENT_LENGTH;
  if (maxImageBytes <= 0) {
    throw new RangeError(
      `maxTransferBytes must exceed ${LOAD_IMAGE_AREA_ARGUMENT_LENGTH}, got ${maxTransferBytes}`,
    );
  }
  if (area.width > maxImageBytes) {
    throw new RangeError(
      `Image row width ${area.width} exceeds max payload size ${maxImageBytes}`,
    );
  }

  const rowsPerChunk = Math.max(1, Math.floor(maxImageBytes / area.width));
  const chunks: ImageAreaChunk[] = [];

  for (let row = 0; row < area.height; row += rowsPerChunk) {
    const chunkHeight = Math.min(rowsPerChunk, area.height - row);
    const start = row * area.width;
    const end = start + chunkHeight * area.width;
    chunks.push({
      area: {
        x: area.x,
        y: area.y + row,
        width: area.width,
        height: chunkHeight,
      },
      data: imageData.subarray(start, end),
    });
  }

  return chunks;
}

export function parseInquiryResponse(response: Buffer): ParsedInquiry {
  if (response.length < STANDARD_INQUIRY_LENGTH) {
    throw new SCSIError(
      0,
      `Invalid INQUIRY response length: expected at least ${STANDARD_INQUIRY_LENGTH}, got ${response.length}`,
    );
  }

  return {
    vendorId: response.toString("ascii", 8, 16).trim(),
    productId: response.toString("ascii", 16, 32).trim(),
    revision: response.toString("ascii", 32, 36).trim(),
  };
}

export function isIT8951Inquiry(inquiry: ParsedInquiry): boolean {
  return (
    inquiry.productId.toLowerCase().includes("ramdisc") ||
    inquiry.productId.includes("8951") ||
    inquiry.vendorId.toLowerCase().includes("generic")
  );
}

export function parseSystemInfo(response: Buffer): ParsedSystemInfo {
  if (response.length < GET_SYSTEM_INFO_LENGTH) {
    throw new SCSIError(
      0,
      `Invalid system info length: expected ${GET_SYSTEM_INFO_LENGTH}, got ${response.length}`,
    );
  }

  const signature = response.readUInt32BE(8);
  if (signature !== IT8951_SIGNATURE_BE) {
    throw new SCSIError(
      0,
      `Invalid IT8951 signature: expected 0x${IT8951_SIGNATURE_BE.toString(16)}, got 0x${signature.toString(16)}`,
    );
  }

  const frameCounts: number[] = [];
  for (let i = 0; i < 8; i++) {
    frameCounts.push(response.readUInt32BE(40 + i * 4));
  }

  return {
    standardCmdNo: response.readUInt32BE(0),
    extendCmdNo: response.readUInt32BE(4),
    signature,
    version: response.readUInt32BE(12),
    width: response.readUInt32BE(16),
    height: response.readUInt32BE(20),
    updateBufBase: response.readUInt32BE(24),
    imageBufBase: response.readUInt32BE(28),
    temperatureNo: response.readUInt32BE(32),
    modeNo: response.readUInt32BE(36),
    frameCounts,
    numImgBuf: response.readUInt32BE(72),
  };
}

export function formatCommandTableVersion(version: number): string {
  assertUInt(version, 32, "version");
  const major = (version >> 16) & 0xff;
  const minor = (version >> 8) & 0xff;
  const patch = version & 0xff;
  return `${major}.${minor}.${patch}`;
}

function assertBufferIndex(index: number): void {
  if (!Number.isInteger(index) || index < 0 || index > 15) {
    throw new RangeError(`Buffer index ${index} out of range (0-15)`);
  }
}

function assertRegion(area: Region): void {
  assertUInt(area.x, 32, "x");
  assertUInt(area.y, 32, "y");
  assertPositiveUInt(area.width, 32, "width");
  assertPositiveUInt(area.height, 32, "height");
}

function assertImageDataLength(area: Region, imageData: Buffer): void {
  const expectedLength = area.width * area.height;
  if (imageData.length !== expectedLength) {
    throw new RangeError(
      `Image data length ${imageData.length} does not match area ${area.width}x${area.height} (${expectedLength})`,
    );
  }
}

function assertPositiveUInt(value: number, bits: number, name: string): void {
  assertUInt(value, bits, name);
  if (value === 0) {
    throw new RangeError(`${name} must be greater than 0`);
  }
}

function assertUInt(value: number, bits: number, name: string): void {
  const max = 2 ** bits - 1;
  if (!Number.isInteger(value) || value < 0 || value > max) {
    throw new RangeError(`${name} must be an unsigned ${bits}-bit integer, got ${value}`);
  }
}
