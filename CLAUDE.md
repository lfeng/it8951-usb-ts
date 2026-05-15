# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Build
npm run build

# Watch mode
npm run dev

# Run all tests with coverage
npm test

# Run tests in watch mode
npm run test:watch

# Run a single test file
npx jest src/__tests__/epd.test.ts

# Run tests with verbose output
npm run test:verbose

# Lint
npm run lint
```

## Architecture

This is a TypeScript driver for IT8951 e-paper display controllers via USB SCSI protocol.

### Module Structure

- **`usb-interface.ts`** - Low-level USB communication layer using SCSI over USB protocol. Handles device discovery, SCSI command transmission, and data transfer.
- **`epd.ts`** - High-level EPD controller that wraps `USBInterface`. Provides image loading, display updates, power management, and refresh rate protection.
- **`auto-display.ts`** - Automatic partial update system that tracks frame buffer changes and only updates modified regions. Supports rotation, mirroring, and grayscale change tracking.
- **`constants.ts`** - Display modes (INIT, DU, GC16, A2, etc.), USB IDs, SCSI commands, error classes, and utility functions for pixel manipulation.
- **`types.ts`** - Type definitions for device info, configuration options, and general types.

### Key Concepts

- **Display Modes**: Different waveform modes for various use cases - INIT (full refresh), DU (fast text), GC16 (high quality images), A2 (animation).
- **Index Mode**: Supports up to 16 separate image buffers (index 0-15) for double-buffering or multi-buffer scenarios.
- **VCOM**: Critical voltage setting for e-paper displays, typically -1.5V to -2.5V depending on display model.
- **SCSI Protocol**: All USB communication uses SCSI Command Block Wrapper (CBW) and Command Status Wrapper (CSW) protocol.

### Testing

Tests use Jest with USB mocking (`src/__mocks__/usb.ts`). Test files mirror the source structure in `src/__tests__/`.

## External Dependencies

- **`usb`** - Node.js USB library for device communication
- **libusb** - System-level USB library (install via `brew install libusb` on macOS or `apt-get install libusb-1.0-0-dev` on Linux)
