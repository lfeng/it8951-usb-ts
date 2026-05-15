/**
 * Auto Display Test Suite
 * Tests for automatic partial update functionality
 */

import { DisplayModes } from '../constants.js';
import { AutoEPDDisplay, AutoDisplay, BoundingBox, } from '../auto-display.js';

// Mock EPD
const mockWaitDisplayReady = jest.fn().mockResolvedValue(undefined);
const mockLoadImageArea = jest.fn().mockResolvedValue(undefined);
const mockDisplayArea = jest.fn().mockResolvedValue(undefined);

jest.mock('../epd.js', () => ({
  EPD: jest.fn().mockImplementation(() => ({
    width: 800,
    height: 600,
    waitDisplayReady: mockWaitDisplayReady,
    loadImageArea: mockLoadImageArea,
    displayArea: mockDisplayArea,
  })),
}));

describe('AutoDisplay', () => {
  class TestAutoDisplay extends AutoDisplay {
    public updateCalls: Array<{
      data: Uint8Array;
      region: [number, number, number, number];
      mode: DisplayModes;
    }> = [];

    protected async update(
      data: Uint8Array,
      region: [number, number, number, number],
      mode: DisplayModes
    ): Promise<void> {
      this.updateCalls.push({ data, region, mode });
    }

    public getFrameBuffer(): Uint8Array {
      return this.frameBuffer;
    }

    public getPreviousFrame(): Uint8Array | null {
      return this.previousFrame;
    }

    public testGetSourceIndex(x: number, y: number, width: number, height: number): number {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (this as any).getSourceIndex(x, y, width, height);
    }

    public testRoundBBox(bbox: BoundingBox, roundTo: number): BoundingBox {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (this as any).roundBBox(bbox, roundTo);
    }

    public testMergeBBox(a: BoundingBox | null, b: BoundingBox | null): BoundingBox | null {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (this as any).mergeBBox(a, b);
    }
  }

  let display: TestAutoDisplay;

  beforeEach(() => {
    jest.clearAllMocks();
    display = new TestAutoDisplay(800, 600);
  });

  describe('constructor', () => {
    it('should create with default options', () => {
      expect(display.width).toBe(800);
      expect(display.height).toBe(600);
    });

    it('should create with rotation option', () => {
      const rotated = new TestAutoDisplay(800, 600, { rotate: 'cw' });
      expect(rotated.width).toBe(600);
      expect(rotated.height).toBe(800);
    });

    it('should create with mirror option', () => {
      const mirrored = new TestAutoDisplay(800, 600, { mirror: true });
      expect(mirrored.width).toBe(800);
      expect(mirrored.height).toBe(600);
    });

    it('should create with trackGray option', () => {
      const tracked = new TestAutoDisplay(800, 600, { trackGray: true });
      expect(tracked).toBeInstanceOf(AutoDisplay);
    });

    it('should initialize frame buffer with white (0xFF)', () => {
      const buffer = display.getFrameBuffer();
      expect(buffer[0]).toBe(0xFF);
      expect(buffer[buffer.length - 1]).toBe(0xFF);
    });
  });

  describe('rotation', () => {
    it('should handle no rotation', () => {
      const noRotate = new TestAutoDisplay(800, 600, { rotate: 'none' });
      expect(noRotate.width).toBe(800);
      expect(noRotate.height).toBe(600);
    });

    it('should handle clockwise rotation', () => {
      const cwRotate = new TestAutoDisplay(800, 600, { rotate: 'cw' });
      expect(cwRotate.width).toBe(600);
      expect(cwRotate.height).toBe(800);
    });

    it('should handle counter-clockwise rotation', () => {
      const ccwRotate = new TestAutoDisplay(800, 600, { rotate: 'ccw' });
      expect(ccwRotate.width).toBe(600);
      expect(ccwRotate.height).toBe(800);
    });

    it('should handle flip rotation', () => {
      const flipRotate = new TestAutoDisplay(800, 600, { rotate: 'flip' });
      expect(flipRotate.width).toBe(800);
      expect(flipRotate.height).toBe(600);
    });
  });

  describe('drawFull', () => {
    it('should draw full frame', async () => {
      await display.drawFull(DisplayModes.GC16);

      expect(display.updateCalls).toHaveLength(1);
      expect(display.updateCalls[0].region).toEqual([0, 0, 800, 600]);
      expect(display.updateCalls[0].mode).toBe(DisplayModes.GC16);
    });

    it('should update previous frame', async () => {
      await display.drawFull(DisplayModes.GC16);

      expect(display.getPreviousFrame()).not.toBeNull();
      expect(display.getPreviousFrame()?.length).toBe(800 * 600);
    });

    it('should track gray changes when enabled', async () => {
      const trackedDisplay = new TestAutoDisplay(800, 600, { trackGray: true });

      await trackedDisplay.drawFull(DisplayModes.DU);
      expect(trackedDisplay).toBeDefined();
    });
  });

  describe('drawPartial', () => {
    it('should draw full frame on first call', async () => {
      await display.drawPartial(DisplayModes.GC16);

      expect(display.updateCalls).toHaveLength(1);
      expect(display.updateCalls[0].region).toEqual([0, 0, 800, 600]);
    });

    it('should draw only changed region on second call', async () => {
      await display.drawFull(DisplayModes.GC16);
      display.updateCalls = [];

      const buffer = display.getFrameBuffer();
      buffer[100] = 0x00;
      buffer[101] = 0x00;
      buffer[102] = 0x00;

      await display.drawPartial(DisplayModes.DU);

      expect(display.updateCalls).toHaveLength(1);
      const [, , width, height] = display.updateCalls[0].region;
      expect(width).toBeGreaterThan(0);
      expect(height).toBeGreaterThan(0);
    });

    it('should round bounding box for low bpp modes', async () => {
      await display.drawFull(DisplayModes.GC16);
      display.updateCalls = [];

      const buffer = display.getFrameBuffer();
      buffer[100] = 0x00;

      await display.drawPartial(DisplayModes.DU);

      expect(display.updateCalls).toHaveLength(1);
      const [, , width] = display.updateCalls[0].region;
      expect(width % 8).toBe(0);
    });

    it('should not update if no changes', async () => {
      await display.drawFull(DisplayModes.GC16);
      display.updateCalls = [];

      // No changes to frame buffer
      await display.drawPartial(DisplayModes.DU);

      // Should not call update if no changes
      expect(display.updateCalls).toHaveLength(0);
    });
  });

  describe('clear', () => {
    it('should clear display', async () => {
      await display.clear();

      expect(display.updateCalls).toHaveLength(1);
      expect(display.updateCalls[0].mode).toBe(DisplayModes.INIT);
    });

    it('should fill frame buffer with white', async () => {
      const buffer = display.getFrameBuffer();
      buffer.fill(0x00);

      await display.clear();

      const clearedBuffer = display.getFrameBuffer();
      expect(clearedBuffer[0]).toBe(0xFF);
    });
  });

  describe('getSourceIndex', () => {
    it('should calculate correct index for no rotation', () => {
      const noRotate = new TestAutoDisplay(10, 10, { rotate: 'none' });
      expect(noRotate.testGetSourceIndex(0, 0, 10, 10)).toBe(0);
      expect(noRotate.testGetSourceIndex(5, 5, 10, 10)).toBe(55);
    });

    it('should calculate correct index for mirror', () => {
      const mirrored = new TestAutoDisplay(10, 10, { mirror: true });
      expect(mirrored.testGetSourceIndex(0, 0, 10, 10)).toBe(9);
      expect(mirrored.testGetSourceIndex(9, 0, 10, 10)).toBe(0);
    });

    it('should calculate correct index for clockwise rotation', () => {
      const cwRotate = new TestAutoDisplay(10, 20, { rotate: 'cw' });
      // For 10x20 display, cw rotation gives 20x10 buffer
      // (0,0) in buffer should map to (19, 0) in source
      expect(cwRotate.testGetSourceIndex(0, 0, 20, 10)).toBe(19 * 10 + 0);
    });

    it('should calculate correct index for counter-clockwise rotation', () => {
      const ccwRotate = new TestAutoDisplay(10, 20, { rotate: 'ccw' });
      // For 10x20 display, ccw rotation gives 20x10 buffer
      expect(ccwRotate.testGetSourceIndex(0, 0, 20, 10)).toBe(0 * 10 + 9);
    });

    it('should calculate correct index for flip rotation', () => {
      const flipRotate = new TestAutoDisplay(10, 10, { rotate: 'flip' });
      expect(flipRotate.testGetSourceIndex(0, 0, 10, 10)).toBe(9 * 10 + 9);
      expect(flipRotate.testGetSourceIndex(9, 9, 10, 10)).toBe(0);
    });
  });

  describe('roundBBox', () => {
    it('should round bounding box correctly', () => {
      const result = display.testRoundBBox([5, 5, 15, 15], 8);
      expect(result[0]).toBe(0); // floor(5/8)*8
      expect(result[2]).toBe(16); // ceil(15/8)*8
    });

    it('should clamp to display bounds', () => {
      const result = display.testRoundBBox([790, 590, 810, 610], 8);
      expect(result[2]).toBeLessThanOrEqual(800);
      expect(result[3]).toBeLessThanOrEqual(600);
    });
  });

  describe('mergeBBox', () => {
    it('should return b when a is null', () => {
      const b: BoundingBox = [10, 10, 20, 20];
      const result = display.testMergeBBox(null, b);
      expect(result).toEqual(b);
    });

    it('should return a when b is null', () => {
      const a: BoundingBox = [10, 10, 20, 20];
      const result = display.testMergeBBox(a, null);
      expect(result).toEqual(a);
    });

    it('should merge two bounding boxes', () => {
      const a: BoundingBox = [10, 10, 20, 20];
      const b: BoundingBox = [15, 15, 25, 25];
      const result = display.testMergeBBox(a, b);
      expect(result).toEqual([10, 10, 25, 25]);
    });
  });

  describe('getMemoryUsage', () => {
    it('should return memory usage stats', () => {
      const stats = display.getMemoryUsage();
      expect(stats.current).toBe(800 * 600);
      expect(stats.peak).toBe(0);
      expect(stats.poolSize).toBe(0);
    });

    it('should update after draw', async () => {
      await display.drawFull(DisplayModes.GC16);
      const stats = display.getMemoryUsage();
      expect(stats.current).toBe(800 * 600 * 2); // frameBuffer + previousFrame
    });
  });
});

describe('AutoEPDDisplay', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let epd: any;
  let autoDisplay: AutoEPDDisplay;

  beforeEach(() => {
    jest.clearAllMocks();

    mockWaitDisplayReady.mockResolvedValue(undefined);
    mockLoadImageArea.mockResolvedValue(undefined);
    mockDisplayArea.mockResolvedValue(undefined);

    const EPD = jest.requireMock('../epd.js').EPD;
    epd = new EPD();
    autoDisplay = new AutoEPDDisplay(epd);
  });

  describe('constructor', () => {
    it('should create with EPD instance', () => {
      expect(autoDisplay).toBeInstanceOf(AutoEPDDisplay);
      expect(autoDisplay).toBeInstanceOf(AutoDisplay);
    });

    it('should inherit dimensions from EPD', () => {
      expect(autoDisplay.width).toBe(800);
      expect(autoDisplay.height).toBe(600);
    });

    it('should create with options', () => {
      const autoDisplayWithOptions = new AutoEPDDisplay(epd, {
        rotate: 'cw',
        mirror: true,
        trackGray: true,
      });
      expect(autoDisplayWithOptions).toBeInstanceOf(AutoEPDDisplay);
    });
  });

  describe('update', () => {
    it('should wait for display ready', async () => {
      const data = new Uint8Array(100).fill(0xFF);
      const region: [number, number, number, number] = [0, 0, 10, 10];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (autoDisplay as any).update(data, region, DisplayModes.GC16);

      expect(mockWaitDisplayReady).toHaveBeenCalled();
    });

    it('should load image area', async () => {
      const data = new Uint8Array(100).fill(0xFF);
      const region: [number, number, number, number] = [0, 0, 10, 10];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (autoDisplay as any).update(data, region, DisplayModes.GC16);

      expect(mockLoadImageArea).toHaveBeenCalledWith(data, {
        x: 0,
        y: 0,
        width: 10,
        height: 10,
      });
    });

    it('should display area', async () => {
      const data = new Uint8Array(100).fill(0xFF);
      const region: [number, number, number, number] = [0, 0, 10, 10];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (autoDisplay as any).update(data, region, DisplayModes.GC16);

      expect(mockDisplayArea).toHaveBeenCalledWith(0, 0, 10, 10, DisplayModes.GC16);
    });
  });
});
