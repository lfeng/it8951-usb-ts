/**
 * Auto Display Module
 *
 * Provides automatic partial update functionality by tracking frame buffer changes
 */

import { EPD } from "./epd.js";
import { DisplayModes, LOW_BPP_MODES } from "./constants.js";

/** Bounding box coordinates [minX, minY, maxX, maxY] */
export type BoundingBox = [number, number, number, number];

/** Options for AutoEPDDisplay */
export interface AutoDisplayOptions {
  /** Rotation mode */
  rotate?: "none" | "cw" | "ccw" | "flip";
  /** Mirror horizontally */
  mirror?: boolean;
  /** Track grayscale changes for better partial updates */
  trackGray?: boolean;
}

/**
 * Base class for auto-updating displays
 * Tracks changes to frame buffer and updates only modified regions
 */
export abstract class AutoDisplay {
  protected frameBuffer: Uint8Array;
  private bufferPool: Uint8Array[] = [];
  private peakMemoryUsage: number = 0;
  protected previousFrame: Uint8Array | null = null;
  protected displayWidth: number;
  protected displayHeight: number;

  private rotate: "none" | "cw" | "ccw" | "flip";
  private mirror: boolean;
  private trackGray: boolean;
  private grayChangeBBox: BoundingBox | null = null;

  constructor(width: number, height: number, options: AutoDisplayOptions = {}) {
    this.displayWidth = width;
    this.displayHeight = height;
    this.rotate = options.rotate ?? "none";
    this.mirror = options.mirror ?? false;
    this.trackGray = options.trackGray ?? false;

    // Allocate frame buffer
    const [bufWidth, bufHeight] = this.getBufferDimensions();
    this.frameBuffer = new Uint8Array(bufWidth * bufHeight).fill(0xff);
  }

  /** Get actual buffer dimensions based on rotation */
  private getBufferDimensions(): [number, number] {
    if (this.rotate === "cw" || this.rotate === "ccw") {
      return [this.displayHeight, this.displayWidth];
    }
    return [this.displayWidth, this.displayHeight];
  }

  /** Get frame width */
  get width(): number {
    const [width] = this.getBufferDimensions();
    return width;
  }

  /** Get frame height */
  get height(): number {
    const [, height] = this.getBufferDimensions();
    return height;
  }

  /**
   * Draw full frame to display
   * @param mode - Display mode
   */
  async drawFull(mode: DisplayModes): Promise<void> {
    const frame = this.getRotatedFrame();

    await this.update(frame, [0, 0, this.displayWidth, this.displayHeight], mode);

    if (this.trackGray) {
      if (mode === DisplayModes.DU) {
        const diffBox = this.computeDiffBox(this.previousFrame, frame, 8);
        this.grayChangeBBox = this.mergeBBox(this.grayChangeBBox, diffBox);
      } else {
        this.grayChangeBBox = null;
      }
    }

    this.previousFrame = new Uint8Array(frame);
  }

  /**
   * Draw only changed portions of the frame
   * @param mode - Display mode
   */
  async drawPartial(mode: DisplayModes): Promise<void> {
    if (this.previousFrame === null) {
      await this.drawFull(mode);
      return;
    }

    const roundTo = LOW_BPP_MODES.has(mode) ? 8 : 4;
    const frame = this.getRotatedFrame();

    // Compute difference box
    let diffBox = this.computeDiffBox(this.previousFrame, frame, roundTo);

    if (this.trackGray) {
      this.grayChangeBBox = this.mergeBBox(this.grayChangeBBox, diffBox);

      if (mode !== DisplayModes.DU) {
        diffBox = this.grayChangeBBox;
        this.grayChangeBBox = null;
      }
    }

    if (diffBox !== null) {
      const [minX, minY, maxX, maxY] = diffBox;
      const buf = this.extractRegion(frame, minX, minY, maxX - minX, maxY - minY);

      // For DU mode, convert changes to black/white
      if (mode === DisplayModes.DU) {
        this.makeChangesBW(
          this.extractRegion(this.previousFrame!, minX, minY, maxX - minX, maxY - minY),
          buf,
        );
      }

      await this.update(buf, [minX, minY, maxX - minX, maxY - minY], mode);
    }

    this.previousFrame = new Uint8Array(frame);
  }

  /**
   * Clear the display
   */
  async clear(): Promise<void> {
    // Fill frame buffer with white
    this.frameBuffer.fill(0xff);
    await this.drawFull(DisplayModes.INIT);
  }

  /**
   * Update display region (to be implemented by subclasses)
   * @param data - Pixel data
   * @param region - [x, y, width, height]
   * @param mode - Display mode
   */

  /**
   * Allocate buffer from pool or create new
   */
  protected allocateBuffer(size: number): Uint8Array {
    const existing = this.bufferPool.find(b => b.length >= size);
    if (existing) {
      this.bufferPool = this.bufferPool.filter(b => b !== existing);
      return existing;
    }
    const buffer = new Uint8Array(size);
    this.peakMemoryUsage = Math.max(this.peakMemoryUsage, buffer.length);
    return buffer;
  }

  /**
   * Return buffer to pool for reuse
   */
  protected returnBuffer(buffer: Uint8Array): void {
    if (this.bufferPool.length < 5) { // Limit pool size
      buffer.fill(0);
      this.bufferPool.push(buffer);
    }
  }

  /**
   * Get memory usage statistics
   */
  getMemoryUsage(): { current: number; peak: number; poolSize: number } {
    const current = this.frameBuffer.length + (this.previousFrame?.length ?? 0);
    return {
      current,
      peak: this.peakMemoryUsage,
      poolSize: this.bufferPool.length,
    };
  }

  protected abstract update(
    data: Uint8Array,
    region: [number, number, number, number],
    mode: DisplayModes,
  ): Promise<void>;

  /** Get rotated/mirrored frame */
  private getRotatedFrame(): Uint8Array {
    const [bufWidth, bufHeight] = this.getBufferDimensions();
    const rotated = new Uint8Array(bufWidth * bufHeight);

    for (let y = 0; y < bufHeight; y++) {
      for (let x = 0; x < bufWidth; x++) {
        const srcIndex = this.getSourceIndex(x, y, bufWidth, bufHeight);
        const dstIndex = y * bufWidth + x;
        rotated[dstIndex] = this.frameBuffer[srcIndex];
      }
    }

    return rotated;
  }

  /** Get source index for a given destination coordinate */
  private getSourceIndex(x: number, y: number, width: number, height: number): number {
    const srcWidth = this.displayWidth;

    switch (this.rotate) {
      case "cw":
        return y * srcWidth + (srcWidth - 1 - x);
      case "ccw":
        return (height - 1 - y) * srcWidth + x;
      case "flip":
        return (height - 1 - y) * srcWidth + (width - 1 - x);
      default:
        if (this.mirror) {
          return y * srcWidth + (width - 1 - x);
        }
        return y * srcWidth + x;
    }
  }

  /** Extract region from frame */
  private extractRegion(
    frame: Uint8Array,
    x: number,
    y: number,
    width: number,
    height: number,
  ): Uint8Array {
    const [bufWidth] = this.getBufferDimensions();
    const region = new Uint8Array(width * height);

    for (let row = 0; row < height; row++) {
      const srcOffset = (y + row) * bufWidth + x;
      const dstOffset = row * width;
      region.set(frame.subarray(srcOffset, srcOffset + width), dstOffset);
    }

    return region;
  }

  /** Compute bounding box of differences between two frames */
  private computeDiffBox(
    a: Uint8Array | null,
    b: Uint8Array,
    roundTo: number = 2,
  ): BoundingBox | null {
    if (a === null) {
      return [0, 0, this.width, this.height];
    }

    let minX = this.width;
    let minY = this.height;
    let maxX = 0;
    let maxY = 0;

    const [bufWidth, bufHeight] = this.getBufferDimensions();

    for (let y = 0; y < bufHeight; y++) {
      for (let x = 0; x < bufWidth; x++) {
        const index = y * bufWidth + x;
        if (a[index] !== b[index]) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x + 1);
          maxY = Math.max(maxY, y + 1);
        }
      }
    }

    if (maxX <= minX || maxY <= minY) {
      return null;
    }

    return this.roundBBox([minX, minY, maxX, maxY], roundTo);
  }

  /** Round bounding box to multiples */
  private roundBBox(bbox: BoundingBox, roundTo: number = 4): BoundingBox {
    const [minX, minY, maxX, maxY] = bbox;

    const roundedMinX = minX - (minX % roundTo);
    const roundedMaxX = maxX + (roundTo - 1) - ((maxX - 1) % roundTo);
    const roundedMinY = minY - (minY % roundTo);
    const roundedMaxY = maxY + (roundTo - 1) - ((maxY - 1) % roundTo);

    return [roundedMinX, roundedMinY, roundedMaxX, roundedMaxY];
  }

  /** Merge two bounding boxes */
  private mergeBBox(a: BoundingBox | null, b: BoundingBox | null): BoundingBox | null {
    if (a === null) return b;
    if (b === null) return a;

    return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])];
  }

  /** Convert changes to black/white for DU mode */
  private makeChangesBW(oldRegion: Uint8Array, newRegion: Uint8Array): void {
    for (let i = 0; i < newRegion.length; i++) {
      if (oldRegion[i] !== newRegion[i]) {
        // Convert to black (0) or white (255)
        newRegion[i] = newRegion[i] < 128 ? 0 : 255;
      }
    }
  }
}

/**
 * Auto-updating EPD display
 */
export class AutoEPDDisplay extends AutoDisplay {
  private epd: EPD;

  constructor(epd: EPD, options: AutoDisplayOptions = {}) {
    super(epd.width, epd.height, options);
    this.epd = epd;
  }

  protected async update(
    data: Uint8Array,
    region: [number, number, number, number],
    mode: DisplayModes,
  ): Promise<void> {
    const [x, y, width, height] = region;

    // Wait for display to be ready
    await this.epd.waitDisplayReady();

    // Send image to controller
    await this.epd.loadImageArea(data, {
      x,
      y,
      width,
      height,
    });

    // Display the sent image
    await this.epd.displayArea(x, y, width, height, mode);
  }
}
