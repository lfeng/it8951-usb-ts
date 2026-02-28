# IT8951 USB Display Driver (TypeScript)

Node.js + TypeScript driver for IT8951 e-paper display controllers via USB.

## Features

- 📘 **TypeScript Support** - Full type definitions for better IDE support
- 🔌 **USB Interface** - Cross-platform USB communication (no Raspberry Pi required)
- 🎨 **Partial Updates** - Automatic detection and update of changed regions
- 🔄 **Multiple Display Modes** - Support for INIT, DU, GC16, A2, and more
- 📝 **Well Documented** - Comprehensive examples and API documentation
- 🚀 **Modern ES Modules** - Uses ES module syntax

## Installation

```bash
npm install
```

### System Dependencies

#### macOS
```bash
brew install libusb
```

#### Linux (Ubuntu/Debian)
```bash
sudo apt-get install libusb-1.0-0-dev
```

## Quick Start

```typescript
import { EPD, DisplayModes } from './src/index.js';

async function main() {
  const epd = new EPD({ vcom: -2.06 });
  await epd.init();

  console.log(`Display: ${epd.width} x ${epd.height}`);

  // Clear display
  await epd.clear();

  // Create image buffer
  const buffer = new Uint8Array(epd.width * epd.height);
  buffer.fill(255);

  // Display
  await epd.loadImageArea(buffer);
  await epd.displayArea(0, 0, epd.width, epd.height, DisplayModes.GC16);
  
  epd.close();
}

main();
```

## Usage

### Basic Display Control

```typescript
import { EPD, DisplayModes } from './src/index.js';

const epd = new EPD({ vcom: -2.06 });
await epd.init();

// Clear
await epd.clear();

// Display modes: INIT, DU, GC16, GL16, A2, DU4
await epd.displayArea(0, 0, epd.width, epd.height, DisplayModes.GC16);

epd.close();
```

### Auto Display (Partial Updates)

```typescript
import { EPD, AutoEPDDisplay, DisplayModes } from './src/index.js';

const epd = new EPD();
await epd.init();

const autoDisplay = new AutoEPDDisplay(epd);

// Automatic partial updates
await autoDisplay.drawPartial(DisplayModes.DU);

// Full update
await autoDisplay.drawFull(DisplayModes.GC16);

epd.close();
```

## Display Modes

| Mode | Name | Speed | Quality | Use Case |
|------|------|-------|---------|----------|
| `INIT` | Initialization | Slow | High | Full refresh |
| `DU` | Direct Update | Fast | Medium | Text |
| `GC16` | Grayscale 16 | Medium | High | Images |
| `A2` | Animation | Very Fast | Low | Video |

## Development

```bash
# Build
npm run build

# Watch mode
npm run dev

# Run example
node examples/basic.js
```

## API Reference

### EPD Class

- `init()` - Initialize display
- `close()` - Close connection
- `clear()` - Clear display
- `loadImageArea(buffer, options)` - Load image
- `displayArea(x, y, w, h, mode)` - Display region
- `waitDisplayReady()` - Wait for ready
- `setVCOM(voltage)` / `getVCOM()` - VCOM control

### Properties

- `width`, `height` - Display dimensions
- `firmwareVersion`, `lutVersion` - Version info

## License

MIT

## Acknowledgments

Based on the [pyit8951](https://github.com/GregDMeyer/IT8951) Python driver.
