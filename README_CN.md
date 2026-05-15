> ⚠️ **免责声明**：本项目仍处于硬件验证阶段。运行真实刷屏示例前，请先确认
> 屏幕排线或产品页面标注的 VCOM。错误 VCOM 或过于频繁的刷新可能缩短屏幕寿命，
> 甚至损坏硬件。

[English Version](./README.md) | 中文版本

# IT8951 USB 显示驱动 (TypeScript)

基于 Node.js + TypeScript 的 IT8951 电子纸显示控制器 USB SCSI 驱动。项目面向
微雪/Waveshare 风格的 IT8951 USB 控制板，同时提供高层 `EPD` API 和底层
`USBInterface` API。

## 功能特性

- TypeScript 优先的公开 API，并生成类型声明
- 基于 `usb` 包和 libusb 的 USB SCSI 传输层
- 通过 SCSI INQUIRY 识别 IT8951 设备
- 高层图像加载、显示刷新、VCOM 和电源控制
- 局部刷新工具和自动变化区域追踪
- 支持控制器暴露的多图像缓冲区 indexed buffer 操作
- 支持 FAST_WRITE_MEM 大块内存写入
- 支持官方波形模式：`INIT`、`DU`、`GC16`、`GL16`、`GLR16`、`GLD16`、`A2`、`DU4`
- 使用 USB mock 的 Jest 测试套件
- 可直接通过 `tsx` 运行的硬件 examples

## 安装

```bash
npm install
```

### 系统依赖

macOS:

```bash
brew install libusb
```

Ubuntu / Debian:

```bash
sudo apt-get install libusb-1.0-0-dev
```

需要 Node.js 18 或更高版本。

## 硬件安全与 VCOM

1. 按控制板文档连接 IT8951 USB 控制器并给屏幕供电。
2. 找到屏幕 FPC 排线标签或产品页面标注的 VCOM。
3. 真实刷新前通过 `IT8951_VCOM` 传入该值。

examples 默认使用 `WAVESHARE_7_8INCH` 预设（`-2.3V`），但应以你手头屏幕的
标签为准：

```bash
sudo env "PATH=$PATH" IT8951_VCOM=-2.3 npx tsx examples/basic.ts
```

如果你习惯输入正数，也可以写成下面这样；example helper 会在内部转成负 VCOM：

```bash
sudo env "PATH=$PATH" IT8951_VCOM=2.3 npx tsx examples/basic.ts
```

多数系统上，硬件 examples 需要 `sudo`。如果你已经为 VID `0x048d`、PID
`0x8951` 配置了 udev 或等价 USB 权限，则可以不使用 `sudo`。

## 快速开始

作为包使用时：

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

在本仓库内运行 examples 时，示例会从 `../src/index.js` 导入源码，并通过
`npx tsx` 直接执行 TypeScript。

## 运行 Examples

examples 都是 TypeScript 文件。除非你自己构建或编写了 JavaScript 输出，否则不要用
`node examples/*.js` 运行。

不访问硬件的安全数据准备检查：

```bash
npx tsx examples/test-prepare-data.ts
```

推荐的硬件冒烟测试顺序：

```bash
# 1. 最小初始化 / 清屏路径
sudo env "PATH=$PATH" IT8951_VCOM=-2.3 npx tsx examples/test-epd-minimal.ts

# 2. 基础全屏渐变
sudo env "PATH=$PATH" IT8951_VCOM=-2.3 npx tsx examples/basic.ts

# 3. 显示 examples/pic 中匹配分辨率的 BMP，或指定自定义路径
sudo env "PATH=$PATH" IT8951_VCOM=-2.3 npx tsx examples/show-bmp.ts
sudo env "PATH=$PATH" IT8951_VCOM=-2.3 npx tsx examples/show-bmp.ts ./examples/pic/1872x1404_0.bmp
```

其他硬件 examples：

| Example | 用途 |
| --- | --- |
| `examples/display-modes.ts` | 用同一测试图对比不同波形模式 |
| `examples/partial-update.ts` | 测试局部区域刷新 |
| `examples/animation.ts` | 运行 A2 模式动画帧 |
| `examples/slideshow.ts` | 轮播 `examples/pic` 下的 BMP 文件 |
| `examples/test-black.ts` | 白底清屏后绘制小黑块 |
| `examples/test-gradient.ts` | 底层 USB 渐变测试 |
| `examples/test-usb-direct.ts` | 底层 USB load/display 路径 |
| `examples/test-with-identify.ts` | 先做 identity check 的底层 USB 路径 |
| `examples/test-alignment.ts` | 诊断行对齐问题 |
| `examples/test-flip.ts` | 诊断方向和镜像问题 |
| `examples/test-pixel-format.ts` | 检查像素格式行为 |
| `examples/test-debug.ts` / `examples/test-epd-debug.ts` | 聚焦调试探针 |

所有硬件 examples 都可能刷新屏幕。手动重复运行时请保留间隔，调试 VCOM、动画或局部
刷新时不要长时间连续刷屏。

## 图像数据格式

高层 API 使用 8-bit 灰度图像数据：

- `0x00` = 黑
- `0xff` = 白
- 每像素 1 字节
- 全屏 buffer 长度 = `epd.width * epd.height`

`loadImageArea(buffer, options)` 接受 `Buffer` 或 `Uint8Array`。如果传入 `x`、
`y`、`width` 或 `height`，驱动会裁剪落在可视屏幕范围之外的数据。

## 显示模式

| 模式 | 典型时间 | 质量 | 用途 |
| --- | ---: | --- | --- |
| `INIT` | ~2000 ms | 完整重置 | 初始清屏和残影清理 |
| `DU` | ~260 ms | 快速近似黑白 | 文本和线条 |
| `GC16` | ~450 ms | 高质量 16 灰阶 | 图片和最终刷新 |
| `GL16` | ~450 ms | 16 灰阶优化 | 白底文字 |
| `GLR16` | ~450 ms | 16 灰阶 remap | 配合预处理减少伪影 |
| `GLD16` | ~450 ms | 16 灰阶 dither | 抖动高质量图片 |
| `A2` | ~120 ms | 快速黑白 | 动画和快速变化 |
| `DU4` | ~290 ms | 快速 4 灰阶 | 有限灰阶快速刷新 |

`EPD` 默认启用最小刷新间隔保护。做更保守的硬件实验时可以调大：

```typescript
const epd = new EPD({
  vcom: -2.3,
  minRefreshInterval: 2000,
});
```

## VCOM 预设

```typescript
import { EPD, VCOM_PRESETS } from "it8951-usb-ts";

const epdFromPreset = new EPD({ vcom: "WAVESHARE_7_8INCH" });
const epdFromVolts = new EPD({ vcom: -2.3 });

console.log(VCOM_PRESETS.WAVESHARE_7_8INCH); // -2.3
```

可用预设：

| 预设 | VCOM |
| --- | ---: |
| `WAVESHARE_6INCH` | `-1.5V` |
| `WAVESHARE_7_8INCH` | `-2.3V` |
| `WAVESHARE_10_3INCH` | `-2.0V` |
| `DEFAULT` | `-2.0V` |

## API 参考

### `EPD`

面向大多数应用的高层控制器。

- `new EPD(config?)`
- `init()` - 打开 USB、识别设备、读取系统信息、设置 VCOM
- `close()` - 释放 USB 资源
- `clear()` - 使用 `INIT` 和 `GC16` 白底清屏
- `loadImageArea(buffer, options?)` - 加载灰度像素到设备内存
- `loadImageAreaIndexed(index, buffer, options?)` - 加载像素到 indexed buffer
- `loadImageAreaFast(buffer, options?)` - 使用 FAST_WRITE_MEM 直接写入
- `displayArea(x, y, width, height, mode)` - 刷新区域
- `displayAreaIndexed(index, x, y, width, height, mode)` - 从 indexed buffer 刷新
- `display(buffer, mode?)` - 加载并显示全屏图像
- `displayPartial(buffer, x, y, width, height, mode?)` - 加载并显示局部区域
- `displayWithGhostRemoval(buffer, mode)` - 快速模式后追加一次 GC16 稳定刷新
- `enterA2Mode()` / `exitA2Mode()` - A2 过渡辅助方法
- `displayA2Sequence(frames, frameDelay?)` - 运行一组 A2 帧
- `waitDisplayReady()` - 兼容辅助方法；USB display command 内部会等待
- `setVCOM(voltage)` / `getVCOM()` - 设置或返回当前配置的 VCOM
- `standby()` / `sleep()` / `run()` - 电源状态辅助方法
- `getDeviceInfo()` - 返回初始化后的显示信息

`init()` 后常用属性：

- `width`, `height`
- `imageBufferAddress`
- `firmwareVersion`, `lutVersion`
- `numBuffers`, `temperatureNo`, `modeNo`
- `currentVCOM`

### `USBInterface`

用于诊断和协议测试的底层传输 API。

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

除非你在验证协议行为或直接调试 USB 传输，否则优先使用 `EPD`。

## 开发

```bash
# 构建 TypeScript 输出
npm run build

# 监听模式
npm run dev

# Lint 源码
npm run lint

# 运行全部 Jest 测试并生成覆盖率
npm test

# 运行单个测试文件
npx jest src/__tests__/epd.test.ts

# 类型检查 examples
npx tsc --noEmit --target ES2022 --module NodeNext --moduleResolution NodeNext --esModuleInterop --skipLibCheck --strict examples/*.ts
```

Jest 测试使用 `src/__mocks__/usb.ts`，不需要连接真实屏幕。

## 协议资料

当前协议资料汇总、实现对齐和硬件验证建议见
[`docs/it8951-reference-analysis.md`](./docs/it8951-reference-analysis.md)。

## 许可证

MIT

## 致谢

基于 [pyit8951](https://github.com/GregDMeyer/IT8951) Python 驱动程序。
