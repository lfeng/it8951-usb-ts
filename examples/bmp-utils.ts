/**
 * BMP Image Utilities
 * Provides functions to read and parse BMP image files
 */

import * as fs from "fs";
import * as path from "path";

/** BMP image data */
export interface BMPImage {
  width: number;
  height: number;
  /** Grayscale pixel data (0-255, where 255 is white) */
  pixels: Uint8Array;
}

/**
 * Read and parse a BMP file into grayscale pixel data
 * @param filePath - Path to the BMP file
 * @returns BMPImage object with dimensions and pixel data
 */
export function readBMP(filePath: string): BMPImage {
  const buffer = fs.readFileSync(filePath);

  // Verify BMP magic number
  if (buffer[0] !== 0x42 || buffer[1] !== 0x4d) {
    throw new Error("Not a valid BMP file");
  }

  // Read BMP header
  const dataOffset = buffer.readUInt32LE(10);
  const width = buffer.readInt32LE(18);
  const height = buffer.readInt32LE(22);
  const bitsPerPixel = buffer.readUInt16LE(28);
  const compression = buffer.readUInt32LE(30);

  // Only support uncompressed BMPs
  if (compression !== 0) {
    throw new Error("Compressed BMP files are not supported");
  }

  // Calculate row padding (BMP rows are padded to 4-byte boundaries)
  const bytesPerPixel = bitsPerPixel / 8;
  const rowSize = Math.ceil((width * bytesPerPixel) / 4) * 4;

  // BMP stores pixels bottom-to-top, so we need to flip
  const pixels = new Uint8Array(width * Math.abs(height));
  const isBottomUp = height > 0;
  const actualHeight = Math.abs(height);

  for (let y = 0; y < actualHeight; y++) {
    const srcY = isBottomUp ? actualHeight - 1 - y : y;
    const rowOffset = dataOffset + srcY * rowSize;

    for (let x = 0; x < width; x++) {
      const srcOffset = rowOffset + x * bytesPerPixel;
      const dstOffset = y * width + x;

      let gray: number;
      if (bitsPerPixel === 24) {
        // RGB -> Grayscale using luminance formula
        const b = buffer[srcOffset];
        const g = buffer[srcOffset + 1];
        const r = buffer[srcOffset + 2];
        gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      } else if (bitsPerPixel === 32) {
        // RGBA -> Grayscale
        const b = buffer[srcOffset];
        const g = buffer[srcOffset + 1];
        const r = buffer[srcOffset + 2];
        gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      } else if (bitsPerPixel === 8) {
        // Already grayscale (or indexed)
        gray = buffer[srcOffset];
      } else {
        throw new Error(`Unsupported BMP bit depth: ${bitsPerPixel}`);
      }

      pixels[dstOffset] = gray;
    }
  }

  return {
    width,
    height: actualHeight,
    pixels,
  };
}

/**
 * Find available image files matching the display resolution
 * @param picDir - Directory containing image files
 * @param width - Display width
 * @param height - Display height
 * @returns Array of matching file paths
 */
export function findMatchingImages(
  picDir: string,
  width: number,
  height: number
): string[] {
  const pattern = `${width}x${height}_`;
  const files = fs.readdirSync(picDir);

  return files
    .filter((f) => f.startsWith(pattern) && f.endsWith(".bmp"))
    .sort()
    .map((f) => path.join(picDir, f));
}

/**
 * Find all available resolution groups in the pic directory
 * @param picDir - Directory containing image files
 * @returns Array of available resolutions [width, height]
 */
export function findAvailableResolutions(
  picDir: string
): Array<[number, number]> {
  const files = fs.readdirSync(picDir);
  const resolutions = new Set<string>();

  for (const file of files) {
    const match = file.match(/^(\d+)x(\d+)_/);
    if (match) {
      resolutions.add(`${match[1]}x${match[2]}`);
    }
  }

  return Array.from(resolutions)
    .map((r) => {
      const [w, h] = r.split("x").map(Number);
      return [w, h] as [number, number];
    })
    .sort((a, b) => a[0] * a[1] - b[0] * b[1]);
}

/**
 * Scale image to fit display (simple nearest neighbor scaling)
 * @param image - Source image
 * @param targetWidth - Target width
 * @param targetHeight - Target height
 * @returns Scaled image
 */
export function scaleImage(
  image: BMPImage,
  targetWidth: number,
  targetHeight: number
): BMPImage {
  const pixels = new Uint8Array(targetWidth * targetHeight);
  const xRatio = image.width / targetWidth;
  const yRatio = image.height / targetHeight;

  for (let y = 0; y < targetHeight; y++) {
    for (let x = 0; x < targetWidth; x++) {
      const srcX = Math.floor(x * xRatio);
      const srcY = Math.floor(y * yRatio);
      const srcIdx = srcY * image.width + srcX;
      const dstIdx = y * targetWidth + x;
      pixels[dstIdx] = image.pixels[srcIdx];
    }
  }

  return {
    width: targetWidth,
    height: targetHeight,
    pixels,
  };
}

/**
 * Center image on display canvas
 * @param image - Source image
 * @param canvasWidth - Canvas/display width
 * @param canvasHeight - Canvas/display height
 * @param backgroundColor - Background color (default: 255 = white)
 * @returns Canvas with centered image
 */
export function centerImage(
  image: BMPImage,
  canvasWidth: number,
  canvasHeight: number,
  backgroundColor: number = 255
): BMPImage {
  const pixels = new Uint8Array(canvasWidth * canvasHeight).fill(
    backgroundColor
  );

  const offsetX = Math.floor((canvasWidth - image.width) / 2);
  const offsetY = Math.floor((canvasHeight - image.height) / 2);

  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      const srcIdx = y * image.width + x;
      const dstX = offsetX + x;
      const dstY = offsetY + y;

      if (dstX >= 0 && dstX < canvasWidth && dstY >= 0 && dstY < canvasHeight) {
        const dstIdx = dstY * canvasWidth + dstX;
        pixels[dstIdx] = image.pixels[srcIdx];
      }
    }
  }

  return {
    width: canvasWidth,
    height: canvasHeight,
    pixels,
  };
}
