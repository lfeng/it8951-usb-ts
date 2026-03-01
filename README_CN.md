> ⚠️ **免责声明**：本项目目前仍处于开发验证阶段，功能可能不完整或不稳定。使用本项目的风险由用户自行承担，作者不对任何设备损坏负责。

[English Version](./README.md) | 中文版本

# IT8951 USB 显示驱动 (TypeScript)

基于 Node.js + TypeScript 的 IT8951 电子纸显示控制器 USB 驱动程序。

## 功能特性

- 📘 **TypeScript 支持** - 完整的类型定义，更好的 IDE 支持
- 🔌 **USB 接口** - 跨平台 USB 通信（无需树莓派）
- 🎨 **局部更新** - 自动检测并更新变化区域
- 🔄 **多种显示模式** - 支持 INIT、DU、GC16、A2 等模式
- ✅ **全面的测试** - Jest 测试套件，包含 60+ 测试用例和覆盖率报告
- 📝 **完善的文档** - 全面的示例和 API 文档
- 🚀 **现代 ES 模块** - 使用 ES 模块语法

## 安装

```bash
npm install
```

### 系统依赖

#### macOS
```bash
brew install libusb
```

#### Linux (Ubuntu/Debian)
```bash
sudo apt-get install libusb-1.0-0-dev
```

## 快速开始

```typescript
import { EPD, DisplayModes } from './src/index.js';

async function main() {
  const epd = new EPD({ vcom: -2.06 });
  await epd.init();

  console.log(`显示器：${epd.width} x ${epd.height}`);

  // 清屏
  await epd.clear();

  // 创建图像缓冲区
  const buffer = new Uint8Array(epd.width * epd.height);
  buffer.fill(255);

  // 显示
  await epd.loadImageArea(buffer);
  await epd.displayArea(0, 0, epd.width, epd.height, DisplayModes.GC16);
  
  epd.close();
}

main();
```

## 使用方法

### 基本显示控制

```typescript
import { EPD, DisplayModes } from './src/index.js';

const epd = new EPD({ vcom: -2.06 });
await epd.init();

// 清屏
await epd.clear();

// 显示模式：INIT, DU, GC16, GL16, A2, DU4
await epd.displayArea(0, 0, epd.width, epd.height, DisplayModes.GC16);

epd.close();
```

### 自动显示（局部更新）

```typescript
import { EPD, AutoEPDDisplay, DisplayModes } from './src/index.js';

const epd = new EPD();
await epd.init();

const autoDisplay = new AutoEPDDisplay(epd);

// 自动局部更新
await autoDisplay.drawPartial(DisplayModes.DU);

// 完整更新
await autoDisplay.drawFull(DisplayModes.GC16);

epd.close();
```

## 显示模式

| 模式 | 名称 | 速度 | 质量 | 使用场景 |
|------|------|-------|---------|----------|
| `INIT` | 初始化 | 慢 | 高 | 完整刷新 |
| `DU` | 直接更新 | 快 | 中 | 文本 |
| `GC16` | 16 级灰度 | 中 | 高 | 图像 |
| `A2` | 动画 | 非常快 | 低 | 视频 |

## 测试

本项目包含使用 Jest 和 TypeScript 支持的全面测试套件。

### 运行测试

```bash
# 运行所有测试并生成覆盖率报告
npm test

# 监听模式运行测试
npm run test:watch

# 详细输出运行测试
npm run test:verbose
```

### 测试覆盖率

测试套件包括：

- **单元测试**: 各个模块的测试（常量、USB 接口、EPD、自动显示）
- **集成测试**: 模块交互和错误处理测试
- **覆盖率报告**: 在 `coverage/` 目录中生成 HTML 和文本覆盖率报告

当前覆盖率：
- **语句**: 53%+
- **分支**: 49%+
- **函数**: 55%+
- **行**: 53%+

### 测试文件

- `src/__tests__/constants.test.ts` - 常量和枚举验证
- `src/__tests__/usb-interface.test.ts` - USB 通信层测试
- `src/__tests__/epd.test.ts` - EPD 控制器测试
- `src/__tests__/auto-display.test.ts` - 自动显示和局部更新测试
- `src/__tests__/integration.test.ts` - 集成和错误处理测试

### 覆盖率报告

运行测试后，查看 HTML 覆盖率报告：

```bash
open coverage/index.html
```

## 开发

```bash
# 构建
npm run build

# 监听模式
npm run dev

# 运行测试
npm test

# 运行示例
node examples/basic.js
```

## API 参考

### EPD 类

- `init()` - 初始化显示器
- `close()` - 关闭连接
- `clear()` - 清屏
- `loadImageArea(buffer, options)` - 加载图像
- `displayArea(x, y, w, h, mode)` - 显示区域
- `waitDisplayReady()` - 等待显示就绪
- `setVCOM(voltage)` / `getVCOM()` - VCOM 控制

### 属性

- `width`, `height` - 显示器尺寸
- `firmwareVersion`, `lutVersion` - 版本信息

## 许可证

MIT

## 致谢

基于 [pyit8951](https://github.com/GregDMeyer/IT8951) Python 驱动程序。

## VCOM 电压设置指南

### 什么是 VCOM？

VCOM 是墨水屏的驱动电压，直接影响显示质量。不当的 VCOM 值可能导致：
- 显示残影（ghosting）
- 对比度下降
- 白色发灰
- 极端情况下可能损坏屏幕

### 查找你的屏幕 VCOM 值

1. **检查屏幕排线**：微雪屏幕的 FPC 排线上通常贴有标签，标注 VCOM 值
2. **查看产品页面**：商品详情页通常会标注推荐 VCOM
3. **参考预设值**：

```typescript
import { VCOM_PRESETS } from './constants';

// 常见屏幕的 VCOM 预设
const vcom6inch = VCOM_PRESETS.WAVESHARE_6INCH;     // -1.5V
const vcom7_8inch = VCOM_PRESETS.WAVESHARE_7_8INCH; // -2.3V
const vcom10_3inch = VCOM_PRESETS.WAVESHARE_10_3INCH; // -2.0V
```

### 设置 VCOM

```typescript
import { EPD } from './epd';

// 方法 1：使用预设
const epd = new EPD({ vcom: 'WAVESHARE_6INCH' });

// 方法 2：直接设置电压值
const epd = new EPD({ vcom: -1.5 });

// 方法 3：使用默认值（-2.0V，适合大多数屏幕）
const epd = new EPD();
```

### VCOM 调整技巧

如果你的显示出现以下问题，可以尝试调整 VCOM：

| 问题 | 可能原因 | 调整方向 |
|------|----------|----------|
| 白色发灰 | VCOM 绝对值过大 | 减小（如 -2.3V → -2.0V） |
| 黑色不够深 | VCOM 绝对值过小 | 增大（如 -1.5V → -1.8V） |
| 残影严重 | VCOM 不匹配 | 尝试 ±0.1V 微调 |
| 闪烁 | VCOM 波动 | 检查电源稳定性 |

### 刷新频率限制

为防止频繁刷新损坏屏幕，默认设置了 1000ms 的最小刷新间隔：

```typescript
// 调整刷新间隔（单位：毫秒）
const epd = new EPD({ 
  vcom: -1.5,
  minRefreshInterval: 2000, // 2 秒间隔，更安全
});

// 禁用限制（不推荐）
const epd = new EPD({ 
  minRefreshInterval: 0,
});
```

⚠️ **警告**：频繁刷新会显著缩短墨水屏寿命！

## 常见问题

### Q: 如何读取当前 VCOM 值？

```typescript
const currentVcom = await epd.getVCOM();
console.log(`Current VCOM: ${currentVcom / 1000}V`);
```

### Q: 显示出现条纹或花屏

1. 检查 USB 连接是否稳定
2. 确认 VCOM 值是否正确
3. 尝试降低刷新频率
4. 检查像素数据是否正确对齐

### Q: 部分更新后有残影

执行一次全屏刷新：

```typescript
await epd.clear(); // 清除残影
```

## 更新日志

### 2026-03-01
- ✅ 添加 VCOM 预设配置
- ✅ 支持 VCOM 字节序配置（小端/大端）
- ✅ 添加刷新频率限制保护
- ✅ 添加像素 4 字节对齐检查
- ✅ 增强错误处理（5 种自定义错误类）
- ✅ 添加缓冲区复用优化
- ✅ 移除不标准的 3bpp 格式

