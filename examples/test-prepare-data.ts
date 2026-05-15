/**
 * Test to verify prepareImageData logic
 */

// Simulate prepareImageData
function prepareImageData(
  buffer: Uint8Array,
  options: { x?: number; y?: number; width?: number; height?: number },
  deviceWidth: number,
  deviceHeight: number,
) {
  const destX = options.x ?? 0;
  const destY = options.y ?? 0;

  let sourceWidth: number;
  let sourceHeight: number;

  if (options.width !== undefined && options.height !== undefined) {
    sourceWidth = options.width;
    sourceHeight = options.height;
  } else if (options.width !== undefined) {
    sourceWidth = options.width;
    sourceHeight = Math.floor(buffer.length / sourceWidth);
  } else if (options.height !== undefined) {
    sourceHeight = options.height;
    sourceWidth = Math.floor(buffer.length / sourceHeight);
  } else {
    sourceWidth = deviceWidth;
    sourceHeight = deviceHeight;
  }

  const displayX = Math.max(0, destX);
  const displayY = Math.max(0, destY);
  const displayWidth = Math.min(sourceWidth - Math.max(0, -destX), deviceWidth - displayX);
  const displayHeight = Math.min(sourceHeight - Math.max(0, -destY), deviceHeight - displayY);

  if (displayWidth <= 0 || displayHeight <= 0) {
    return { x: 0, y: 0, width: 0, height: 0, croppedData: new Uint8Array(0) };
  }

  const offsetX = Math.max(0, -destX);
  const offsetY = Math.max(0, -destY);
  const croppedData = new Uint8Array(displayWidth * displayHeight);

  for (let row = 0; row < displayHeight; row++) {
    const srcRow = offsetY + row;
    const srcOffset = srcRow * sourceWidth + offsetX;
    const dstOffset = row * displayWidth;
    croppedData.set(buffer.subarray(srcOffset, srcOffset + displayWidth), dstOffset);
  }

  return {
    x: displayX,
    y: displayY,
    width: displayWidth,
    height: displayHeight,
    croppedData,
  };
}

// Test with device dimensions
const deviceWidth = 1872;
const deviceHeight = 1404;
const bufferSize = deviceWidth * deviceHeight;

console.log("=== Testing prepareImageData ===\n");
console.log(`Device: ${deviceWidth}x${deviceHeight}`);
console.log(`Buffer size: ${bufferSize}\n`);

// Create white buffer
const whiteBuffer = new Uint8Array(bufferSize).fill(0xff);
console.log(`White buffer created: ${whiteBuffer.length} bytes`);
console.log(
  `First 10 bytes: ${Array.from(whiteBuffer.slice(0, 10))
    .map((b) => b.toString(16))
    .join(" ")}`,
);
console.log(
  `Last 10 bytes: ${Array.from(whiteBuffer.slice(-10))
    .map((b) => b.toString(16))
    .join(" ")}`,
);

// Test full screen (no options)
console.log("\n--- Test 1: Full screen (no options) ---");
const result1 = prepareImageData(whiteBuffer, {}, deviceWidth, deviceHeight);
console.log(
  `Result: x=${result1.x}, y=${result1.y}, width=${result1.width}, height=${result1.height}`,
);
console.log(`CroppedData length: ${result1.croppedData.length}`);
console.log(
  `CroppedData first 10: ${Array.from(result1.croppedData.slice(0, 10))
    .map((b) => b.toString(16))
    .join(" ")}`,
);
console.log(
  `CroppedData last 10: ${Array.from(result1.croppedData.slice(-10))
    .map((b) => b.toString(16))
    .join(" ")}`,
);

// Check if any values are not 0xff
let nonWhiteCount = 0;
for (let i = 0; i < result1.croppedData.length; i++) {
  if (result1.croppedData[i] !== 0xff) {
    nonWhiteCount++;
    if (nonWhiteCount <= 5) {
      console.log(`Non-0xff at index ${i}: ${result1.croppedData[i].toString(16)}`);
    }
  }
}
console.log(`Total non-0xff values: ${nonWhiteCount}`);

// Test small area
console.log("\n--- Test 2: 100x100 at (100,100) ---");
const blackBuffer = new Uint8Array(100 * 100).fill(0x00);
const result2 = prepareImageData(
  blackBuffer,
  { x: 100, y: 100, width: 100, height: 100 },
  deviceWidth,
  deviceHeight,
);
console.log(
  `Result: x=${result2.x}, y=${result2.y}, width=${result2.width}, height=${result2.height}`,
);
console.log(`CroppedData length: ${result2.croppedData.length}`);
console.log(
  `CroppedData first 10: ${Array.from(result2.croppedData.slice(0, 10))
    .map((b) => b.toString(16))
    .join(" ")}`,
);

// Check
let nonBlackCount = 0;
for (let i = 0; i < result2.croppedData.length; i++) {
  if (result2.croppedData[i] !== 0x00) {
    nonBlackCount++;
  }
}
console.log(`Total non-0x00 values: ${nonBlackCount}`);

console.log("\n=== Test complete ===");
