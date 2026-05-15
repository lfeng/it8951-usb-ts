# IT8951 USB SCSI 协议分析报告

## 📄 文档来源

> 维护说明：这是早期协议分析记录。2026-05-15 重构后的最新资料汇总、差距分析和验证建议见
> `docs/it8951-reference-analysis.md`。该新文档修正了 FAST_WRITE_MEM CDB 布局、60KiB USB
> 传输限制和像素格式枚举等问题。

**官方文档**: IT8951 USB Programming Guide v0.4 (2016-11-14)
**来源**: Waveshare Electronics
**参考**: https://files.waveshare.com/upload/c/c9/IT8951_USB_ProgrammingGuide_v.0.4_20161114.pdf

---

## 🔍 USB 设备识别

### 1. 设备信息

- **Vendor ID**: 0x048d (ITE Tech. Inc.)
- **Product ID**: 0x8951 (IT8951)
- **设备类型**: USB Mass Storage Device (无介质)
- **Inquiry 返回**: "Generic Storage RamDisc 1.00"

### 2. 工作原理

IT8951 通过 USB 连接时，会模拟成一个 **USB Mass Storage 设备**（类似 SD 卡读卡器），但实际上是通过 **自定义 SCSI 命令** 来控制显示屏。

**关键机制**:
- 设备显示为"无介质的存储设备"
- 通过 SCSI Command Block Wrapper (CBW) 发送自定义命令
- 使用 Bulk Transfer API 传输数据

---

## 📋 SCSI CBW 格式

### Command Block Wrapper (CBW) 结构

```
CBW[31 bytes]:
[0-3]   Signature: 0x55434253 ("USBC")
[4-7]   Tag: 任意值 (用于匹配 CSW)
[8-11]  Data Transfer Length (bytes)
[12]    Direction: 
        - 0x80 = Bulk-In (读)
        - 0x00 = Bulk-Out (写)
[13]    LUN: 0 (IT8951 只支持 LUN 0)
[14]    CDB Length: 0x10 (16 bytes)
[15-30] CDB[16] (SCSI 命令描述符)
```

---

## 🎯 IT8951 USB 命令列表

### 1. GET_SYS (0x80) - 获取系统信息

**CDB 格式**:
```
CDB[0]  = 0xFE (Customer command)
CDB[1]  = 0x00
CDB[2]  = 0x38 (Signature '8')
CDB[3]  = 0x39 (Signature '9')
CDB[4]  = 0x35 (Signature '5')
CDB[5]  = 0x31 (Signature '1')
CDB[6]  = 0x80 (Get System)
CDB[7]  = 0x00
CDB[8]  = 0x01 (Version high)
CDB[9]  = 0x00
CDB[10] = 0x02 (Version low)
CDB[11-15] = 0x00
```

**返回数据**: 112 bytes
```c
typedef struct {
    unsigned int standard_cmd_no;      // 标准命令号
    unsigned int extend_cmd_no;        // 扩展命令号
    unsigned int signature;            // 0x31353938 ("8951")
    unsigned int version;              // 命令表版本
    unsigned int width;                // 面板宽度
    unsigned int height;               // 面板高度
    unsigned int update_buf_base;      // 更新缓冲区地址
    unsigned int image_buf_base;       // 图像缓冲区地址 (index 0)
    unsigned int temperature_no;       // 温度段数
    unsigned int mode_no;              // 显示模式数
    unsigned int frame_count[8];       // 各模式的帧计数
    unsigned int num_img_buf;          // 图像缓冲区数量 (v0.3+)
    unsigned int reserved[9];
} TRSP_SYSTEM_INFO_DATA;
```

---

### 2. LD_IMAGE_AREA (0xA2) - 加载图像区域

**CDB 格式**:
```
CDB[0]  = 0xFE
CDB[1]  = 0x00
CDB[2-5] = 0x00
CDB[6]  = 0xA2 (Load Image)
CDB[7-15] = 0x00
```

**参数数据** (20 bytes + 图像数据):
```
Arg[0-3]:  图像缓冲区地址 (或 Index mode)
Arg[4-7]:  X 坐标
Arg[8-11]: Y 坐标
Arg[12-15]: 宽度
Arg[16-19]: 高度
Arg[20...]: 图像数据
```

**Index Mode** (v0.3+):
```
Bit[31] = 1: Index mode
Bit[3:0]: Image buffer index (0-15)
例如：0x80000001 = 使用 index 1 的缓冲区
```

---

### 3. DPY_AREA (0x94) - 显示区域

**CDB 格式**:
```
CDB[0]  = 0xFE
CDB[1]  = 0x00
CDB[2-5] = 0x00
CDB[6]  = 0x94 (Display Area)
CDB[7-15] = 0x00
```

**参数数据** (28 bytes):
```
Arg[0-3]:  图像缓冲区地址 (或 Index mode)
Arg[4-7]:  显示模式 (INIT=0, DU=1, GC16=2, ...)
Arg[8-11]: X 坐标
Arg[12-15]: Y 坐标
Arg[16-19]: 宽度
Arg[20-23]: 高度
Arg[24-27]: 等待标志 (1=等待完成，0=不等待)
```

---

### 4. PMIC_CTRL (0xA3) - 电源管理

**CDB 格式**:
```
CDB[0]  = 0xFE
CDB[1]  = 0x00
CDB[2-5] = 0x00
CDB[6]  = 0xA3 (PMIC Control)
CDB[7-8]: VCOM 值 (big-endian)
CDB[9]:   VCOM 标志 (1=设置 VCOM)
CDB[10]:  电源控制标志 (1=执行电源控制)
CDB[11]:  电源状态 (1=开启，0=关闭)
CDB[12-15] = 0x00
```

---

### 5. 其他命令

| 命令码 | 名称 | 说明 | 版本 |
|--------|------|------|------|
| 0x80 | GET_SYS | 获取系统信息 | v0.1 |
| 0x81 | READ_MEM | 读取内存 | v0.1 |
| 0x82 | WRITE_MEM | 写入内存 | v0.1 |
| 0x94 | DPY_AREA | 显示区域 | v0.1 |
| 0xA2 | LD_IMAGE_AREA | 加载图像区域 | v0.1 |
| 0xA3 | PMIC_CTRL | 电源管理 | v0.1 |
| 0xA5 | FAST_WRITE_MEM | 快速写入内存 | v0.4 |
| 0xA7 | AUTO_RESET | 自动复位 | v0.4 |

---

## ✅ 与 it8951-usb-ts 项目对比

### 1. 命令码验证

| 命令 | 官方值 | 项目实现 | 状态 |
|------|--------|----------|------|
| GET_SYS | 0x80 | ✅ `buildGetSystemInfoCommand()` / `SCSICommands.GET_SYS` | ✅ |
| LD_IMAGE_AREA | 0xA2 | ✅ `buildLoadImageAreaCommand()` / `SCSICommands.LD_IMG_AREA` | ✅ |
| DPY_AREA | 0x94 | ✅ `buildDisplayAreaCommand()` / `SCSICommands.DPY_AREA` | ✅ |
| PMIC_CTRL | 0xA3 | ✅ `buildPowerVcomCommand()` / `SCSICommands.PMIC_CTRL` | ✅ |

### 2. CBW 格式验证

**项目实现** (`usb-interface.ts`):
```typescript
const CBW_SIGNATURE = Buffer.from([0x55, 0x53, 0x42, 0x43]); // 'USBC' ✅
const CBW_LENGTH = 31; ✅
cbw.writeUInt32LE(this.tag, 4); ✅
cbw.writeUInt32LE(dataLength, 8); ✅
cbw.writeUInt8(direction, 12); // 0x80=In, 0x00=Out ✅
cbw.writeUInt8(0, 13); // LUN = 0 ✅
cbw.writeUInt8(16, 14); // CDB Length = 16 ✅
```

**结论**: CBW 结构与 USB Mass Storage Bulk-Only Transport 规格一致；更高层的 CDB 与参数布局已集中到
`src/protocol.ts` 并由回归测试覆盖。✅

### 3. CDB 格式验证

**官方 GET_SYS**:
```
[0xFE, 0x00, 0x38, 0x39, 0x35, 0x31, 0x80, 0x00, 0x01, 0x00, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00]
```

**项目实现**:
```typescript
const command = buildGetSystemInfoCommand();
// [0xfe, 0x00, 0x38, 0x39, 0x35, 0x31, 0x80, 0x00,
//  0x01, 0x00, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00]
```

### 4. VCOM 字节序

**官方文档** (PMIC_CTRL):
```
CDB[7-8]: VCOM 值 (文档未明确字节序)
```

**项目实现**:
```typescript
const command = buildPowerVcomCommand(vcomMillivolts, powerOn, EndianTypes.BIG);
// 默认使用大端序：CDB[7] = high byte, CDB[8] = low byte
```

**建议**: 根据官方文档，IT8951 内存地址使用 **Big Endian**，但 VCOM 设置需要实际测试验证。当前实现支持配置字节序是明智的！✅

---

## 📊 关键发现

### 1. USB 设备识别流程

```
1. 插入 USB 设备
2. 枚举为 Mass Storage Device
3. 发送 SCSI Inquiry 命令 (0x12)
4. 检查返回字符串："Generic Storage RamDisc 1.00"
5. 确认是 IT8951 设备
6. 发送 GET_SYS (0x80) 获取设备信息
```

### 2. 多缓冲区支持 (v0.3+)

- **Index Mode**: 可以使用多个图像缓冲区
- **优势**: 支持预加载、双缓冲等高级功能
- **实现**: Bit[31]=1 启用 Index mode，Bit[3:0] 指定索引

### 3. 快速写入 (v0.4+)

- **命令**: 0xA5 FAST_WRITE_MEM
- **速度**: 最高 30MB/s
- **用途**: 全宽图像快速加载

---

## 🎯 最终结论

### 2026-05-15 复核结论

项目已完成一次协议层重构：CBW/CSW、CDB、参数编码、系统信息解析和 60KiB 分块规则集中到
`src/protocol.ts`，`USBInterface` 改为传输编排层。复核时发现并修正了三个早期误判：

1. **FAST_WRITE_MEM**: 地址应位于 CDB[2..5]，长度应位于 CDB[7..8]。
2. **LD_IMG_AREA**: 参数头是 20 bytes，不是 28 bytes；28 bytes 是 DPY_AREA 参数。
3. **PixelModes**: datasheet 枚举为 2/3/4/8bpp = 0/1/2/3，旧实现遗漏 3bpp 并导致 4bpp/8bpp 错位。

### 🔧 已落地的改进

1. **设备识别流程**:
   ```typescript
   async identify(): Promise<IdentifyResult> {
     const inquiry = await this.scsiInquiry();
     return parseInquiryResponse(inquiry);
   }
   ```

2. **Index Mode**:
   ```typescript
   async loadImageAreaIndexed(index: number, ...) {
     const addr = indexedBufferAddress(index);
     // ...
   }
   ```

3. **FAST_WRITE_MEM 快速写入命令**:
   ```typescript
   async fastWriteMemory(addr: number, data: Buffer) {
     // CDB[2..5] = address, CDB[7..8] = chunk length
   }
   ```

---

## 📖 参考资源

1. **官方文档**: [IT8951 USB Programming Guide v0.4](https://files.waveshare.com/upload/c/c9/IT8951_USB_ProgrammingGuide_v.0.4_20161114.pdf)
2. **开源实现**: 
   - [rust-it8951](https://github.com/faassen/rust-it8951)
   - [it8951 (martijnbraam)](https://git.sr.ht/~martijnbraam/it8951)
   - [it8951usb ( petrkr)](https://github.com/petrkr/it8951usb)

---

**分析时间**: 2026-05-15 GMT+8  
**状态**: ✅ USB SCSI 协议已按公开资料复核并重构
