> ⚠️ **Disclaimer**: This project is under active hardware validation. Set the
> correct VCOM for your panel before running display examples. Frequent refreshes
> or an incorrect VCOM value may shorten panel life or damage hardware.

# IT8951 USB Display Driver (TypeScript)

English Version | [中文版本](./README_CN.md)

Node.js + TypeScript driver for IT8951 e-paper display controllers over the USB
SCSI protocol. It targets Waveshare-style IT8951 USB boards and exposes both a
high-level `EPD` API and a lower-level `USBInterface` API.

## Features

- TypeScript-first public API with generated declaration files
- USB SCSI transport using the `usb` package and libusb
- Device identification through SCSI INQUIRY
- High-level image loading, display updates, VCOM, and power controls
- Partial update helpers and automatic change-region tracking
- Indexed buffer operations for controllers that expose multiple image buffers
- FAST_WRITE_MEM support for large memory writes
- Official waveform modes: `INIT`, `DU`, `GC16`, `GL16`, `GLR16`, `GLD16`, `A2`, and `DU4`
- Jest test suite with mocked USB devices
- Hardware examples that run directly from TypeScript with `tsx`

## Installation

```bash
npm install
```

### System Dependencies

macOS:

```bash
brew install libusb
```

Ubuntu / Debian:

```bash
sudo apt-get install libusb-1.0-0-dev
```

Node.js 18 or newer is required.

## Hardware Safety

1. Connect the IT8951 USB controller and power the panel according to your board
   documentation.
2. Find the VCOM value printed on the e-paper panel FPC label or product page.
3. Pass that value through `IT8951_VCOM` before any real display refresh.

Examples default to the `WAVESHARE_7_8INCH` preset (`-2.3V`), but you should
override it if your panel label says otherwise:

```bash
sudo env "PATH=$PATH" IT8951_VCOM=-2.3 npx tsx examples/basic.ts
```

Use a positive value only if you prefer that input style; the example helper
normalizes it to a negative VCOM internally:

```bash
sudo env "PATH=$PATH" IT8951_VCOM=2.3 npx tsx examples/basic.ts
```

On many systems, hardware examples need `sudo` unless you have configured udev
or equivalent USB permissions for VID `0x048d`, PID `0x8951`.

## Quick Start

Package usage:

```typescript
import { EPD, DisplayModes } from "it8951-usb-ts";

const epd = new EPD({ vcom: -2.3 });

try {
  await epd.init();

  const image = Buffer.alloc(epd.width * epd.height, 0xff);

  for (let y = 0; y < epd.height; y++) {
    for (let x = 0; x < epd.width; x++) {
      image[y * epd.width + x] = Math.floor((x / epd.width) * 255);
    }
  }

  await epd.loadImageArea(image);
  await epd.displayArea(0, 0, epd.width, epd.height, DisplayModes.GC16);
} finally {
  epd.close();
}
```

When running inside this repository, examples import from `../src/index.js` and
are intended to be executed with `npx tsx`.

## Running Examples

The examples are TypeScript files. Do not run them as `node examples/*.js`
unless you have built or authored JavaScript output yourself.

Safe data-preparation check with no hardware access:

```bash
npx tsx examples/test-prepare-data.ts
```

Recommended hardware smoke-test order:

```bash
# 1. Minimal init / clear path
sudo env "PATH=$PATH" IT8951_VCOM=-2.3 npx tsx examples/test-epd-minimal.ts

# 2. Basic full-screen gradient
sudo env "PATH=$PATH" IT8951_VCOM=-2.3 npx tsx examples/basic.ts

# 3. Display a BMP chosen from examples/pic or a custom path
sudo env "PATH=$PATH" IT8951_VCOM=-2.3 npx tsx examples/show-bmp.ts
sudo env "PATH=$PATH" IT8951_VCOM=-2.3 npx tsx examples/show-bmp.ts ./examples/pic/1872x1404_0.bmp
```

Additional hardware examples:

| Example | Purpose |
| --- | --- |
| `examples/display-modes.ts` | Compare waveform modes on the same test image |
| `examples/partial-update.ts` | Exercise partial-region updates |
| `examples/animation.ts` | Run A2-mode animation frames |
| `examples/slideshow.ts` | Cycle through BMP files under `examples/pic` |
| `examples/test-black.ts` | Draw a small black square after a white clear |
| `examples/test-gradient.ts` | Low-level USB gradient test |
| `examples/test-usb-direct.ts` | Low-level USB load/display path |
| `examples/test-with-identify.ts` | Low-level USB path after explicit identity check |
| `examples/test-alignment.ts` | Diagnose row alignment issues |
| `examples/test-flip.ts` | Diagnose orientation and mirroring issues |
| `examples/test-pixel-format.ts` | Inspect pixel-format behavior |
| `examples/test-debug.ts` / `examples/test-epd-debug.ts` | Focused debug probes |

All hardware examples can refresh the panel. Keep delays between manual reruns
and avoid running animation or partial-update loops repeatedly while tuning.

## Image Data

The high-level API expects 8-bit grayscale image data:

- `0x00` = black
- `0xff` = white
- one byte per pixel
- full-screen buffer length = `epd.width * epd.height`

`loadImageArea(buffer, options)` accepts `Buffer` or `Uint8Array`. If you pass
`x`, `y`, `width`, or `height`, the driver crops data that falls outside the
visible panel area.

## Display Modes

| Mode | Typical Time | Quality | Use Case |
| --- | ---: | --- | --- |
| `INIT` | ~2000 ms | Full reset | Initial clear and ghosting removal |
| `DU` | ~260 ms | Fast monochrome-ish update | Text and line drawings |
| `GC16` | ~450 ms | High quality 16-gray | Images and final refreshes |
| `GL16` | ~450 ms | 16-gray optimized | Text on white backgrounds |
| `GLR16` | ~450 ms | 16-gray remap | Reduced artifacts with preprocessing |
| `GLD16` | ~450 ms | 16-gray dither | Dithered high-quality images |
| `A2` | ~120 ms | Fast black/white | Animation and rapid changes |
| `DU4` | ~290 ms | Fast 4-gray | Fast limited-grayscale updates |

The `EPD` class enforces a minimum refresh interval by default. You can raise it
for safer experiments:

```typescript
const epd = new EPD({
  vcom: -2.3,
  minRefreshInterval: 2000,
});
```

## VCOM Presets

```typescript
import { EPD, VCOM_PRESETS } from "it8951-usb-ts";

const epdFromPreset = new EPD({ vcom: "WAVESHARE_7_8INCH" });
const epdFromVolts = new EPD({ vcom: -2.3 });

console.log(VCOM_PRESETS.WAVESHARE_7_8INCH); // -2.3
```

Available presets:

| Preset | VCOM |
| --- | ---: |
| `WAVESHARE_6INCH` | `-1.5V` |
| `WAVESHARE_7_8INCH` | `-2.3V` |
| `WAVESHARE_10_3INCH` | `-2.0V` |
| `DEFAULT` | `-2.0V` |

## API Reference

### `EPD`

High-level controller for most applications.

- `new EPD(config?)`
- `init()` - open USB, identify device, read system info, set VCOM
- `close()` - release USB resources
- `clear()` - white clear using `INIT` and `GC16`
- `loadImageArea(buffer, options?)` - load grayscale pixels to device memory
- `loadImageAreaIndexed(index, buffer, options?)` - load pixels to an indexed buffer
- `loadImageAreaFast(buffer, options?)` - write directly with FAST_WRITE_MEM
- `displayArea(x, y, width, height, mode)` - refresh an area
- `displayAreaIndexed(index, x, y, width, height, mode)` - refresh from an indexed buffer
- `display(buffer, mode?)` - load and display a full-screen image
- `displayPartial(buffer, x, y, width, height, mode?)` - load and display a region
- `displayWithGhostRemoval(buffer, mode)` - follow fast modes with a GC16 refresh
- `enterA2Mode()` / `exitA2Mode()` - A2 transition helpers
- `displayA2Sequence(frames, frameDelay?)` - run a sequence of A2 frames
- `waitDisplayReady()` - no-op compatibility helper; USB display commands wait internally
- `setVCOM(voltage)` / `getVCOM()` - set or return the current configured VCOM
- `standby()` / `sleep()` / `run()` - power-state helpers
- `getDeviceInfo()` - return initialized display metadata

Common properties after `init()`:

- `width`, `height`
- `imageBufferAddress`
- `firmwareVersion`, `lutVersion`
- `numBuffers`, `temperatureNo`, `modeNo`
- `currentVCOM`

### `USBInterface`

Low-level transport for diagnostics and protocol tests.

- `open()` / `close()`
- `identify()` / `scsiInquiry()`
- `getDeviceInfo()` / `getSystemInfo()`
- `loadImageArea(x, y, width, height, data)`
- `loadImageAreaIndexed(index, x, y, width, height, data)`
- `loadImageAreaAligned(x, y, width, height, data, bpp)`
- `displayArea(x, y, width, height, mode, waitReady?)`
- `displayAreaIndexed(index, x, y, width, height, mode, waitReady?)`
- `fastWriteMemory(address, data)`
- `setPowerVcom(vcomMillivolts, powerOn)`

Prefer `EPD` unless you are validating protocol behavior or debugging USB
transfers directly.

## Development

```bash
# Build TypeScript output
npm run build

# Watch mode
npm run dev

# Lint source
npm run lint

# Run all Jest tests with coverage
npm test

# Run one test file
npx jest src/__tests__/epd.test.ts

# Type-check examples
npx tsc --noEmit --target ES2022 --module NodeNext --moduleResolution NodeNext --esModuleInterop --skipLibCheck --strict examples/*.ts
```

The Jest tests use `src/__mocks__/usb.ts` and do not require a physical display.

## Protocol Notes

See [`docs/it8951-reference-analysis.md`](./docs/it8951-reference-analysis.md)
for the current protocol reference summary, implementation alignment notes, and
hardware verification guidance.

## License

MIT

## Acknowledgments

Based on the [pyit8951](https://github.com/GregDMeyer/IT8951) Python driver.
