/**
 * Auto Display Module
 *
 * Provides automatic partial update functionality by tracking frame buffer changes.
 * Only updates the regions of the display that have actually changed, improving
 * performance and reducing display wear.
 *
 * @example
 * ```typescript
 * const epd = new EPD({ vcom: -2.0 });
 * await epd.init();
 * const display = new AutoEPDDisplay(epd, { trackGray: true });
 *
 * // Draw something to the frame buffer
 * display.frameBuffer.fill(0x00, 0, 100);
 *
 * // Only update changed regions
 * await display.drawPartial(DisplayModes.DU);
 * ```
 */

import { EPD } from "./epd.js";
import { DisplayModes, LOW_BPP_MODES, quantizeTo4Levels } from "./constants.js";

// =============================================================================
// Type Definitions
// =============================================================================

/**
 * Rotation direction for auto-display
 */
export type RotationDirection = "none" | "cw" | "ccw" | "flip";

/**
 * Bounding box coordinates [minX, minY, maxX, maxY]
 */
export type BoundingBox = [number, number, number, number];

/**
 * Options for AutoEPDDisplay
 */
export interface AutoDisplayOptions {
  /** Rotation mode for the display buffer */
  readonly rotate?: RotationDirection;
  /** Mirror horizontally */
  readonly mirror?: boolean;
  /** Track grayscale changes for better partial updates */
  readonly trackGray?: boolean;
}

/**
 * Memory usage statistics
 */
export interface MemoryUsage {
  /** Current memory usage in bytes */
  readonly current: number;
  /** Peak memory usage in bytes */
  readonly peak: number;
  /** Number of buffers in the pool */
  readonly poolSize: number;
}

// =============================================================================
// Base Auto Display Class
// =============================================================================

/**
 * Base class for auto-updating displays
 *
 * Tracks changes to frame buffer and updates only modified regions.
 * Supports rotation, mirroring, and grayscale change tracking.
 */
export abstract class AutoDisplay {
  /** Frame buffer for drawing operations */
  protected frameBuffer: Uint8Array;
  private bufferPool: Uint8Array[] = [];
  private peakMemoryUsage: number = 0;
  protected previousFrame: Uint8Array | null = null;
  protected displayWidth: number;
  protected displayHeight: number;

  private rotate: RotationDirection;
  private mirror: boolean;
  private trackGray: boolean;
  private grayChangeBBox: BoundingBox | null = null;

  /**
   * Creates a new AutoDisplay instance
   *
   * @param width - Display width in pixels
   * @param height - Display height in pixels
   * @param options - Display options
   */
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

  // =============================================================================
  // Property Getters
  // =============================================================================

  /**
   * Get frame buffer width (may differ from display width if rotated)
   */
  get width(): number {
    const [width] = this.getBufferDimensions();
    return width;
  }

  /**
   * Get frame buffer height (may differ from display height if rotated)
   */
  get height(): number {
    const [, height] = this.getBufferDimensions();
    return height;
  }

  /**
   * Get actual buffer dimensions based on rotation
   */
  private getBufferDimensions(): [number, number] {
    if (this.rotate === "cw" || this.rotate === "ccw") {
      return [this.displayHeight, this.displayWidth];
    }
    return [this.displayWidth, this.displayHeight];
  }

  // =============================================================================
  // Display Operations
  // =============================================================================

  /**
   * Draw full frame to display
   *
   * Updates the entire display area regardless of changes.
   *
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
   *
   * Compares current frame with previous frame and only updates regions
   * that have changed. Falls back to full update on first call.
   *
   * Supports special handling for fast update modes:
   * - DU mode: Binary conversion (black/white only)
   * - DU4 mode: 4-level grayscale quantization (anti-aliased text)
   *
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

      if (mode !== DisplayModes.DU && mode !== DisplayModes.DU4) {
        diffBox = this.grayChangeBBox;
        this.grayChangeBBox = null;
      }
    }

    if (diffBox !== null) {
      const [minX, minY, maxX, maxY] = diffBox;
      const buf = this.extractRegion(frame, minX, minY, maxX - minX, maxY - minY);
      const oldBuf = this.extractRegion(this.previousFrame!, minX, minY, maxX - minX, maxY - minY);

      // Apply mode-specific pixel processing
      if (mode === DisplayModes.DU) {
        // DU mode: convert to black/white
        this.makeChangesBW(oldBuf, buf);
      } else if (mode === DisplayModes.DU4) {
        // DU4 mode: quantize to 4 grayscale levels
        this.makeChangesDU4(oldBuf, buf);
      }

      await this.update(buf, [minX, minY, maxX - minX, maxY - minY], mode);
    }

    this.previousFrame = new Uint8Array(frame);
  }

  /**
   * Clear the display
   *
   * Fills the frame buffer with white and performs a full refresh.
   */
  async clear(): Promise<void> {
    // Fill frame buffer with white
    this.frameBuffer.fill(0xff);
    await this.drawFull(DisplayModes.INIT);
  }

  // =============================================================================
  // Abstract Methods
  // =============================================================================

  /**
   * Update display region (to be implemented by subclasses)
   *
   * @param data - Pixel data for the region
   * @param region - [x, y, width, height] region coordinates
   * @param mode - Display mode
   */
  protected abstract update(
    data: Uint8Array,
    region: [number, number, number, number],
    mode: DisplayModes,
  ): Promise<void>;

  // =============================================================================
  // Memory Management
  // =============================================================================

  /**
   * Allocate buffer from pool or create new
   *
   * @param size - Required buffer size in bytes
   * @returns Allocated buffer
   */
  protected allocateBuffer(size: number): Uint8Array {
    const existing = this.bufferPool.find((b) => b.length >= size);
    if (existing) {
      this.bufferPool = this.bufferPool.filter((b) => b !== existing);
      return existing;
    }
    const buffer = new Uint8Array(size);
    this.peakMemoryUsage = Math.max(this.peakMemoryUsage, buffer.length);
    return buffer;
  }

  /**
   * Return buffer to pool for reuse
   *
   * @param buffer - Buffer to return to pool
   */
  protected returnBuffer(buffer: Uint8Array): void {
    const MAX_POOL_SIZE = 5;
    if (this.bufferPool.length < MAX_POOL_SIZE) {
      buffer.fill(0);
      this.bufferPool.push(buffer);
    }
  }

  /**
   * Get memory usage statistics
   *
   * @returns Memory usage information
   */
  getMemoryUsage(): MemoryUsage {
    const current = this.frameBuffer.length + (this.previousFrame?.length ?? 0);
    return {
      current,
      peak: this.peakMemoryUsage,
      poolSize: this.bufferPool.length,
    };
  }

  // =============================================================================
  // Private Helper Methods
  // =============================================================================

  /**
   * Get rotated/mirrored frame
   *
   * Applies rotation and mirroring transformations to the frame buffer.
   *
   * @returns Transformed frame data
   */
  private getRotatedFrame(): Uint8Array {
    const [bufWidth, bufHeight] = this.getBufferDimensions();
    const rotated = new Uint8Array(bufWidth * bufHeight);

    for (let y = 0; y < bufHeight; y++) {
      for (let x = 0; x < bufWidth; x++) {
        const srcIndex = this.getSourceIndex(x, y);
        const dstIndex = y * bufWidth + x;
        rotated[dstIndex] = this.frameBuffer[srcIndex];
      }
    }

    return rotated;
  }

  /**
   * Get source index for a given destination coordinate
   *
   * Calculates the source buffer index based on rotation and mirroring settings.
   *
   * @param x - Destination X coordinate
   * @param y - Destination Y coordinate
   * @param width - Buffer width
   * @param height - Buffer height
   * @returns Source index in frame buffer
   */
  private getSourceIndex(x: number, y: number): number {
    const srcWidth = this.displayWidth;
    const srcHeight = this.displayHeight;

    switch (this.rotate) {
      case "cw":
        // 90 degrees clockwise: (x, y) -> (srcHeight - 1 - y, x)
        return (srcHeight - 1 - x) * srcWidth + y;
      case "ccw":
        // 90 degrees counter-clockwise: (x, y) -> (y, srcWidth - 1 - x)
        return x * srcWidth + (srcWidth - 1 - y);
      case "flip":
        // 180 degrees: (x, y) -> (srcWidth - 1 - x, srcHeight - 1 - y)
        return (srcHeight - 1 - y) * srcWidth + (srcWidth - 1 - x);
      default:
        // No rotation
        if (this.mirror) {
          // Mirror horizontally
          return y * srcWidth + (srcWidth - 1 - x);
        }
        return y * srcWidth + x;
    }
  }

  /**
   * Extract region from frame
   *
   * @param frame - Source frame data
   * @param x - Region X coordinate
   * @param y - Region Y coordinate
   * @param width - Region width
   * @param height - Region height
   * @returns Extracted region data
   */
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

  /**
   * Compute bounding box of differences between two frames
   *
   * Uses SIMD-friendly comparison (4 bytes at a time) for better performance.
   *
   * @param a - Previous frame (null for full frame)
   * @param b - Current frame
   * @param roundTo - Round bounding box to this multiple
   * @returns Bounding box of differences or null if no differences
   */
  private computeDiffBox(
    a: Uint8Array | null,
    b: Uint8Array,
    roundTo: number = 2,
  ): BoundingBox | null {
    if (a === null) {
      return [0, 0, this.displayWidth, this.displayHeight];
    }

    const [bufWidth, bufHeight] = this.getBufferDimensions();

    // Use Uint32Array for faster comparison (4 bytes at a time)
    // This is SIMD-friendly and can be 3-4x faster than byte-by-byte comparison
    const len = a.length;
    const alignedLen = len & ~3; // Round down to multiple of 4

    // Create aligned views for 4-byte comparison
    const view32A = new Uint32Array(a.buffer, a.byteOffset, alignedLen >> 2);
    const view32B = new Uint32Array(b.buffer, b.byteOffset, alignedLen >> 2);

    let minX = bufWidth;
    let minY = bufHeight;
    let maxX = 0;
    let maxY = 0;

    // Fast path: compare 4 bytes at a time
    for (let i = 0; i < view32A.length; i++) {
      if (view32A[i] !== view32B[i]) {
        // Difference found - calculate pixel positions
        const byteOffset = i << 2;

        // Check each byte in this 32-bit word for the exact boundaries
        for (let j = 0; j < 4; j++) {
          const pixelOffset = byteOffset + j;
          if (pixelOffset < len && a[pixelOffset] !== b[pixelOffset]) {
            const pixelY = Math.floor(pixelOffset / bufWidth);
            const pixelX = pixelOffset % bufWidth;
            minX = Math.min(minX, pixelX);
            minY = Math.min(minY, pixelY);
            maxX = Math.max(maxX, pixelX + 1);
            maxY = Math.max(maxY, pixelY + 1);
          }
        }
      }
    }

    // Handle remaining bytes (if length not multiple of 4)
    for (let i = alignedLen; i < len; i++) {
      if (a[i] !== b[i]) {
        const y = Math.floor(i / bufWidth);
        const x = i % bufWidth;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x + 1);
        maxY = Math.max(maxY, y + 1);
      }
    }

    if (maxX <= minX || maxY <= minY) {
      return null;
    }

    return this.roundBBox([minX, minY, maxX, maxY], roundTo);
  }

  /**
   * Round bounding box to multiples
   *
   * @param bbox - Bounding box to round
   * @param roundTo - Multiple to round to
   * @returns Rounded bounding box
   */
  private roundBBox(bbox: BoundingBox, roundTo: number = 4): BoundingBox {
    const [minX, minY, maxX, maxY] = bbox;

    const roundedMinX = Math.floor(minX / roundTo) * roundTo;
    const roundedMaxX = Math.ceil(maxX / roundTo) * roundTo;
    const roundedMinY = Math.floor(minY / roundTo) * roundTo;
    const roundedMaxY = Math.ceil(maxY / roundTo) * roundTo;

    return [
      Math.max(0, roundedMinX),
      Math.max(0, roundedMinY),
      Math.min(this.displayWidth, roundedMaxX),
      Math.min(this.displayHeight, roundedMaxY),
    ];
  }

  /**
   * Merge two bounding boxes
   *
   * @param a - First bounding box
   * @param b - Second bounding box
   * @returns Merged bounding box or null if both are null
   */
  private mergeBBox(a: BoundingBox | null, b: BoundingBox | null): BoundingBox | null {
    if (a === null) return b;
    if (b === null) return a;

    return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])];
  }

  /**
   * Convert changes to black/white for DU mode
   *
   * DU mode only supports [any grayscale] → [black/white] transitions.
   * According to E-paper Mode Declaration: pixel states [0-30] → [0, 30]
   *
   * @param oldRegion - Previous frame region
   * @param newRegion - Current frame region (modified in place)
   * @param threshold - Threshold for black/white decision (default: 128)
   */
  private makeChangesBW(
    oldRegion: Uint8Array,
    newRegion: Uint8Array,
    threshold: number = 128,
  ): void {
    for (let i = 0; i < newRegion.length; i++) {
      if (oldRegion[i] !== newRegion[i]) {
        // Convert 8-bit grayscale to black (0x00) or white (0xFF)
        // This maps to pixel state 0 (black) or 30 (white)
        newRegion[i] = newRegion[i] < threshold ? 0x00 : 0xff;
      }
    }
  }

  /**
   * Quantize changes to 4 grayscale levels for DU4 mode
   *
   * DU4 mode supports 4 grayscale levels: pixel states [0, 10, 20, 30]
   * Corresponding to 8-bit values: [0, 85, 170, 255]
   *
   * @param oldRegion - Previous frame region
   * @param newRegion - Current frame region (modified in place)
   */
  private makeChangesDU4(oldRegion: Uint8Array, newRegion: Uint8Array): void {
    for (let i = 0; i < newRegion.length; i++) {
      if (oldRegion[i] !== newRegion[i]) {
        // Quantize to 4 levels using the function from constants.ts
        newRegion[i] = quantizeTo4Levels(newRegion[i]);
      }
    }
  }
}

// =============================================================================
// EPD Auto Display Implementation
// =============================================================================

/**
 * Auto-updating EPD display implementation
 *
 * Integrates AutoDisplay with the EPD controller for automatic
 * partial updates on IT8951 displays.
 */
export class AutoEPDDisplay extends AutoDisplay {
  private epd: EPD;

  /**
   * Creates a new AutoEPDDisplay instance
   *
   * @param epd - Initialized EPD controller instance
   * @param options - Display options
   */
  constructor(epd: EPD, options: AutoDisplayOptions = {}) {
    super(epd.width, epd.height, options);
    this.epd = epd;
  }

  /**
   * Update display region using EPD controller
   *
   * @param data - Pixel data for the region
   * @param region - [x, y, width, height] region coordinates
   * @param mode - Display mode
   */
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
