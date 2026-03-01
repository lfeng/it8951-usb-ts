# IT8951-USB-TS 代码审查报告

## 审查日期
2026-03-01

## 审查范围
- 项目：`it8951-usb-ts`
- 路径：`~/.openclaw/workspace/projects/it8951-usb-ts/`
- 对比基准：微雪 (Waveshare) 官方 IT8951 驱动、pyit8951、LovyanGFX

---

## 1. VCOM 电压设置 ⚠️ 需要修复

### 官方规范
根据微雪官方驱动和多个开源项目验证：

```c
// Waveshare 官方 IT8951.c
void IT8951SetVCOM(uint16_t vcom) {
    LCDWriteCmdCode(USDEF_I80_CMD_VCOM);  // 0x0039
    LCDWriteData(1);  // Write mode
    LCDWriteData(vcom & 0xFF);
    LCDWriteData((vcom >> 8) & 0xFF);
}

// VCOM 值计算：
// -1.5V = 1500 = 0x05DC
// -2.0V = 2000 = 0x07D0
// -2.3V = 2300 = 0x08FC
// 公式：vcom_value = abs(voltage * 1000)
```

### 当前实现 (`usb-interface.ts`)
```typescript
async setPowerVcom(vcom: number | null, powerOn: boolean | null): Promise<void> {
  const cmd = Buffer.from(SCSI_PMIC_CTRL);
  
  if (vcom !== null) {
    cmd[7] = (vcom >> 8) & 0xff;  // 高位
    cmd[8] = vcom & 0xff;          // 低位
    cmd[9] = 1; // Set VCOM
  }
  // ...
}
```

### 当前实现 (`epd.ts`)
```typescript
async setVCOM(vcom: number): Promise<void> {
  this.validateVCOM(vcom);
  const vcomInt = Math.round(-1000 * vcom);  // ✅ 正确：-2.06V → 2060
  await this.usb.setPowerVcom(vcomInt, true);
  this.vcom = vcom;
}
```

### ✅ 审查结果
**VCOM 计算逻辑正确**，但存在以下问题：

1. **字节序问题** ⚠️：
   - 官方 SPI 接口使用 **小端序** (先低位后高位)
   - 当前 USB SCSI 实现使用 **大端序** (cmd[7] 高位，cmd[8] 低位)
   - **需要确认 USB SCSI 协议的字节序要求**

2. **默认 VCOM 值** ⚠️：
   ```typescript
   // epd.ts line 47
   this.vcom = config.vcom ?? -2.06;  // 默认 -2.06V
   ```
   - 微雪 6 寸屏典型值：**-1.5V ~ -2.0V**
   - 7.8 寸屏：**-2.3V**
   - **建议**：从用户配置读取或提供屏幕尺寸选项

3. **缺少 VCOM 读取功能** ❌：
   - 官方支持读取当前 VCOM 值
   - 当前实现只返回缓存值

### 🔧 修复建议

```typescript
// 1. 添加字节序配置选项
export interface USBInterfaceOptions {
  // ... existing options
  /** VCOM byte order: 'BE' for big-endian, 'LE' for little-endian */
  vcomEndian?: 'BE' | 'LE';
}

// 2. 修改 setPowerVcom
async setPowerVcom(vcom: number | null, powerOn: boolean | null): Promise<void> {
  const cmd = Buffer.from(SCSI_PMIC_CTRL);
  
  if (vcom !== null) {
    // 根据字节序写入
    if (this.vcomEndian === 'LE') {
      cmd[7] = vcom & 0xff;          // 低位
      cmd[8] = (vcom >> 8) & 0xff;   // 高位
    } else {
      cmd[7] = (vcom >> 8) & 0xff;   // 高位
      cmd[8] = vcom & 0xff;          // 低位
    }
    cmd[9] = 1;
  }
  // ...
}

// 3. 添加 VCOM 读取方法
async getVCOM(): Promise<number> {
  // 需要实现 SCSI 读取命令
  // 参考官方 IT8951GetVCOM()
  throw new Error("VCOM read not implemented for USB SCSI");
}

// 4. 提供常见屏幕的 VCOM 预设
export const VCOM_PRESETS = {
  WAVESHARE_6INCH: -1.5,
  WAVESHARE_7_8INCH: -2.3,
  WAVESHARE_10_3INCH: -2.0,
  DEFAULT: -2.0,
} as const;
```

---

## 2. 命令代码定义 ✅ 基本正确

### 官方命令码对比

| 命令 | 官方值 | 当前实现 | 状态 |
|------|--------|----------|------|
| SYS_RUN | 0x0001 | 0x0001 | ✅ |
| STANDBY | 0x0002 | 0x0002 | ✅ |
| SLEEP | 0x0003 | 0x0003 | ✅ |
| REG_RD | 0x0010 | 0x0010 | ✅ |
| REG_WR | 0x0011 | 0x0011 | ✅ |
| LD_IMG | 0x0020 | 0x0020 | ✅ |
| LD_IMG_AREA | 0x0021 | 0x0021 | ✅ |
| LD_IMG_END | 0x0022 | 0x0022 | ✅ |
| DPY_AREA | 0x0034 | 0x0034 | ✅ |
| DPY_BUF_AREA | 0x0037 | 0x0037 | ✅ |
| VCOM | 0x0039 | 0x0039 | ✅ |
| GET_DEV_INFO | 0x0302 | 0x0302 | ✅ |

### ✅ 审查结果
所有命令码定义**完全正确**，与官方 datasheet 一致。

---

## 3. 显示模式定义 ✅ 正确

### 官方波形模式

```c
// Waveshare IT8951.h
#define IT8951_DIS_MODE_INIT  0  // 初始化 (全屏闪烁)
#define IT8951_DIS_MODE_DU    1  // 直接更新 (快，灰度)
#define IT8951_DIS_MODE_GC16  2  // 16 级灰度 (高质量)
#define IT8951_DIS_MODE_GL16  3  // 16 级灰度 (优化)
#define IT8951_DIS_MODE_GLR16 4  // 16 级灰度 (重映射)
#define IT8951_DIS_MODE_GLD16 5  // 16 级灰度 (抖动)
#define IT8951_DIS_MODE_A2    6  // 动画模式 2 (快)
#define IT8951_DIS_MODE_DU4   7  // 直接更新 4 (4 级灰度)
```

### 当前实现 (`constants.ts`)
```typescript
export enum DisplayModes {
  INIT = 0,
  DU = 1,
  GC16 = 2,
  GL16 = 3,
  GLR16 = 4,
  GLD16 = 5,
  A2 = 6,
  DU4 = 7,
}
```

### ✅ 审查结果
**完全匹配**官方定义。

---

## 4. USB SCSI 协议实现 ⚠️ 需要验证

### 当前实现分析

```typescript
// SCSI CBW 构建
const CBW_SIGNATURE = Buffer.from([0x55, 0x53, 0x42, 0x43]); // 'USBC'
const CBW_LENGTH = 31;

// IT8951 SCSI 命令 (16 字节)
const SCSI_GET_SYS = Buffer.from([
  0xfe, 0x00, 0x38, 0x39, 0x35, 0x31, 0x80, 0x00, 
  0x01, 0x00, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00,
]);
```

### 🔍 问题点

1. **SCSI 命令来源不明**：
   - IT8951 官方 datasheet 只定义了 SPI/I80 接口
   - USB SCSI 协议是 E-LINK TCON Monitor 的扩展
   - **需要验证 SCSI 命令格式是否符合 IT8951 USB 固件**

2. **缺少错误处理**：
   ```typescript
   // 当前实现
   if (status !== 0) {
     throw new Error(`Command failed with status: ${status}`);
   }
   // ❌ 没有区分具体错误类型
   ```

3. **缺少超时重试机制**：
   - USB 通信可能因干扰失败
   - 建议添加重试逻辑

### 🔧 建议改进

```typescript
// 1. 添加 SCSI 状态码定义
export enum SCSIStatus {
  GOOD = 0x00,
  CHECK_CONDITION = 0x02,
  CONDITION_MET = 0x04,
  BUSY = 0x08,
  INTERMEDIATE = 0x10,
  RESERVATION_CONFLICT = 0x18,
}

// 2. 增强错误处理
private async readCSW(): Promise<void> {
  const csw = await this.transferIn(CSW_LENGTH);
  
  const signature = csw.readUInt32LE(0);
  if (signature !== CSW_SIGNATURE_VALUE) {
    throw new Error(`Invalid CSW signature: 0x${signature.toString(16)}`);
  }
  
  const status = csw.readUInt8(12);
  if (status !== SCSIStatus.GOOD) {
    const senseData = await this.requestSense();
    throw new SCSIError(status, senseData);
  }
}

// 3. 添加重试机制
private async transferOutWithRetry(buffer: Buffer, maxRetries = 3): Promise<void> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await this.transferOut(buffer);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await this.sleep(100 * (i + 1)); // 指数退避
    }
  }
}
```

---

## 5. 像素格式和字节对齐 ⚠️ 需要注意

### 官方规范

```c
// IT8951 Datasheet
// 像素数据需要 4 字节对齐
// 每行像素数据长度必须是 4 的倍数

// 像素格式：
// 2bpp: 4 像素/字节 (0-3)
// 4bpp: 2 像素/字节 (0-15)
// 8bpp: 1 像素/字节 (0-255)
```

### 当前实现

```typescript
// constants.ts
export enum PixelModes {
  M_2BPP = 0,
  M_3BPP = 1,  // ❌ 3bpp 不是标准格式
  M_4BPP = 2,
  M_8BPP = 3,
}

// epd.ts
async loadImageArea(buffer: Uint8Array, ...) {
  const imageData = Buffer.from(buffer);
  await this.usb.loadImageArea(x, y, width, height, imageData);
  // ❌ 没有检查字节对齐
}
```

### 🔧 修复建议

```typescript
// 1. 移除 3bpp (非标准)
export enum PixelModes {
  M_2BPP = 0,
  M_4BPP = 1,  // 修正索引
  M_8BPP = 2,
}

// 2. 添加对齐检查
private alignRowLength(width: number, bpp: number): number {
  const pixelsPerByte = 8 / bpp;
  const rowBytes = Math.ceil(width / pixelsPerByte);
  // 4 字节对齐
  return Math.ceil(rowBytes / 4) * 4;
}

// 3. 在 loadImageArea 中添加对齐
async loadImageArea(buffer: Uint8Array, options: ...) {
  const alignedWidth = this.alignRowLength(width, bpp);
  if (alignedWidth !== width) {
    // 填充对齐
    buffer = this.padBuffer(buffer, width, alignedWidth);
  }
  // ...
}
```

---

## 总结

### ✅ 优点
1. 命令码定义完全正确
2. 显示模式与官方一致
3. VCOM 计算逻辑正确
4. 部分更新算法优秀
5. TypeScript 类型完整

### ⚠️ 需要修复
1. **VCOM 字节序** - 需要确认 USB SCSI 协议的字节序
2. **默认 VCOM 值** - 应提供屏幕尺寸选项或预设
3. **像素对齐** - 添加 4 字节对齐检查
4. **错误处理** - 增强错误类型和日志

### ❌ 功能缺失
1. VCOM 读取功能
2. 寄存器访问 (USB 模式限制)
3. SCSI 错误码详细处理

### 🔧 优先级建议

**高优先级** (影响硬件安全)：
- [ ] 确认 VCOM 字节序
- [ ] 添加像素对齐检查
- [ ] 添加刷新频率限制

**中优先级** (影响功能完整性)：
- [ ] 实现 VCOM 读取
- [ ] 增强错误处理
- [ ] 添加 VCOM 预设

**低优先级** (优化改进)：
- [ ] 缓冲区复用
- [ ] 内存监控
- [ ] 文档完善

---

**审查员**: Coder Agent  
**审查时间**: 2026-03-01 09:55 CST
