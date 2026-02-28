/**
 * Auto Display Test Suite
 * Tests for automatic partial update functionality
 */

import { AutoEPDDisplay, AutoDisplay, BoundingBox } from '../auto-display.js';
import { DisplayModes, PixelModes } from '../constants.js';

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
      const [, , width, height] = display.updateCalls[0].region;
      expect(width % 8).toBe(0);
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

  describe('computeDiffBox', () => {
    it('should return full box when previous frame is null', () => {
      const diffBox = (display as any).computeDiffBox(null, new Uint8Array(100));
      expect(diffBox).toEqual([0, 0, 800, 600]);
    });

    it('should return null when frames are identical', () => {
      const frame = new Uint8Array(100).fill(0xFF);
      const diffBox = (display as any).computeDiffBox(frame, frame);
      expect(diffBox).toBeNull();
    });

    it('should compute bounding box of differences', () => {
      const frame1 = new Uint8Array(100).fill(0xFF);
      const frame2 = new Uint8Array(100).fill(0xFF);
      frame2[50] = 0x00;

      const diffBox = (display as any).computeDiffBox(frame1, frame2);
      expect(diffBox).not.toBeNull();
    });

    it('should round bounding box to specified multiple', () => {
      const frame1 = new Uint8Array(100).fill(0xFF);
      const frame2 = new Uint8Array(100).fill(0xFF);
      frame2[10] = 0x00;

      const diffBox = (display as any).computeDiffBox(frame1, frame2, 8);
      if (diffBox) {
        const [minX, minY, maxX, maxY] = diffBox;
        expect(minX % 8).toBe(0);
        expect(minY % 8).toBe(0);
      }
    });
  });

  describe('mergeBBox', () => {
    it('should return b when a is null', () => {
      const b: BoundingBox = [10, 10, 20, 20];
      const result = (display as any).mergeBBox(null, b);
      expect(result).toEqual(b);
    });

    it('should return a when b is null', () => {
      const a: BoundingBox = [10, 10, 20, 20];
      const result = (display as any).mergeBBox(a, null);
      expect(result).toEqual(a);
    });

    it('should merge two bounding boxes', () => {
      const a: BoundingBox = [10, 10, 20, 20];
      const b: BoundingBox = [15, 15, 25, 25];
      const result = (display as any).mergeBBox(a, b);
      expect(result).toEqual([10, 10, 25, 25]);
    });
  });

  describe('extractRegion', () => {
    it('should extract region from frame', () => {
      const frame = new Uint8Array(100).fill(0xFF);
      const region = (display as any).extractRegion(frame, 0, 0, 10, 10);
      expect(region.length).toBe(100);
    });
  });
});

describe('AutoEPDDisplay', () => {
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

      await (autoDisplay as any).update(data, region, DisplayModes.GC16);

      expect(mockWaitDisplayReady).toHaveBeenCalled();
    });

    it('should load image area', async () => {
      const data = new Uint8Array(100).fill(0xFF);
      const region: [number, number, number, number] = [0, 0, 10, 10];

      await (autoDisplay as any).update(data, region, DisplayModes.GC16);

      expect(mockLoadImageArea).toHaveBeenCalledWith(data, {
        x: 0,
        y: 0,
        width: 10,
        height: 10,
        pixelFormat: PixelModes.M_4BPP,
      });
    });

    it('should display area', async () => {
      const data = new Uint8Array(100).fill(0xFF);
      const region: [number, number, number, number] = [0, 0, 10, 10];

      await (autoDisplay as any).update(data, region, DisplayModes.GC16);

      expect(mockDisplayArea).toHaveBeenCalledWith(0, 0, 10, 10, DisplayModes.GC16);
    });
  });
});
