# IT8951 资料汇总与实现对齐分析

更新时间：2026-05-15

## 资料来源

### 官方/微雪资料

- Waveshare IT8951 USB Programming Guide v0.4 (2016-11-14)  
  https://files.waveshare.com/upload/c/c9/IT8951_USB_ProgrammingGuide_v.0.4_20161114.pdf
- ITE IT8951 D Version datasheet v0.2.4.3 (2017-07-28)  
  https://www.waveshare.net/w/upload/1/18/IT8951_D_V0.2.4.3_20170728.pdf
- Waveshare 6inch HD e-Paper HAT Wiki  
  https://www.waveshare.com/wiki/6inch_HD_e-Paper_HAT
- Waveshare 6inch e-Paper HAT Wiki  
  https://www.waveshare.com/wiki/6inch_e-Paper_HAT
- Waveshare 7.8inch e-Paper HAT Wiki  
  https://www.waveshare.com/wiki/7.8inch_e-Paper_HAT
- Waveshare 7.8inch e-Paper HAT product page  
  https://www.waveshare.net/shop/7.8inch-e-Paper-HAT.htm
- Waveshare 7.8inch e-Paper HAT Wiki (CN mirror)  
  https://www.waveshare.net/wiki/7.8inch_e-Paper_HAT
- Waveshare 9.7inch e-Paper HAT Wiki  
  https://www.waveshare.com/wiki/9.7inch_e-Paper_HAT
- Waveshare 10.3inch e-Paper HAT Wiki  
  https://www.waveshare.com/wiki/10.3inch_e-Paper_HAT
- Waveshare 10.3inch e-Paper HAT (D) Wiki  
  https://www.waveshare.com/wiki/10.3inch_e-Paper_HAT_(D)
- Waveshare 13.3inch e-Paper HAT Wiki  
  https://www.waveshare.com/wiki/13.3inch_e-Paper_HAT
- Waveshare IT8951 Raspberry Pi demo  
  https://github.com/waveshare/IT8951
- Waveshare IT8951-ePaper universal driver demo  
  https://github.com/waveshareteam/IT8951-ePaper

### 交叉参考实现

- Rust `it8951` crate 文档，基于微雪 IT8951 编程指南  
  https://docs.rs/it8951/latest/it8951/
- ESP32 IT8951 driver API reference  
  https://pvginkel.github.io/it8951-esp32/it8951_8h_source.html
- Go IT8951 package API reference  
  https://pkg.go.dev/github.com/peergum/IT8951-go

## 关键事实

- USB 连接时 IT8951 以 USB Mass Storage 形态枚举，主机通过 Bulk-Only Transport 的 CBW/CSW 包发送自定义 SCSI CDB。
- 官方识别路径是先发标准 SCSI INQUIRY，再检查返回产品字符串是否为 `Generic Storage RamDisc 1.00` 一类身份。
- 自定义 USB CDB 固定 16 字节。IT8951 私有命令以 `CDB[0] = 0xFE` 起始，具体操作码放在 `CDB[6]`。
- `GET_SYS` 使用签名字节 `38 39 35 31` 和操作码 `0x80`，返回 112 字节 `TRSP_SYSTEM_INFO_DATA`。多字节字段需要按 big-endian 解释。
- USB Programming Guide 明确最大单次传输大小为 60 KiB。超过时必须拆成多个不超过 60 KiB 的事务。
- `LD_IMG_AREA (0xA2)` 的数据阶段是 20 字节区域参数加 8bpp raw pixel 数据。像素数据长度必须等于 `width * height`。
- `DPY_AREA (0x94)` 和 `DPY_BUF_AREA (0x97)` 的数据阶段是 28 字节参数，顺序为内存地址、波形模式、x、y、width、height、waitReady。
- Index mode 使用地址参数 bit 31 置位，低 4 bit 表示 image buffer index，也就是 `0x80000000 + index`。
- `PMIC_CTRL (0xA3)` 中 VCOM 以 mV 为单位，`CDB[7]` 是高字节，`CDB[8]` 是低字节；例如 -2.5V 写入 `09 C4`。
- `FAST_WRITE_MEM (0xA5)` 是增强版内存写入命令，地址在 `CDB[2..5]`，长度在 `CDB[7..8]`，数据阶段长度必须和该长度一致。
- Datasheet 的主机接口像素格式枚举包含 2bpp、3bpp、4bpp、8bpp，对应值为 0、1、2、3；之前项目把 4bpp/8bpp 向前错位了。
- 微雪 Wiki 明确：Windows USB 接口开发源码 E-LINK-TCON-DEMO 需要联系微雪并签 NDA，当前开源实现只能依赖公开 USB Programming Guide 与交叉实现验证。

## 微雪 IT8951 常见屏幕尺寸

| 型号 | 分辨率 | 公开资料 |
| --- | ---: | --- |
| 6inch e-Paper HAT | 800 x 600 | Waveshare 6inch e-Paper HAT Wiki |
| 6inch HD e-Paper HAT | 1448 x 1072 | Waveshare 6inch HD e-Paper HAT Wiki |
| 7.8inch e-Paper HAT | 1872 x 1404 | Waveshare 7.8inch e-Paper HAT Wiki |
| 9.7inch e-Paper HAT | 1200 x 825 | Waveshare 9.7inch e-Paper HAT Wiki |
| 10.3inch e-Paper HAT / HAT (D) | 1872 x 1404 | Waveshare 10.3inch e-Paper HAT Wiki |
| 13.3inch e-Paper HAT | 1600 x 1200 | Waveshare 13.3inch e-Paper HAT Wiki |

## 7.8inch e-Paper HAT 设备档案

当前 examples 主要按微雪 `7.8inch e-Paper HAT` / SKU `16766` 补充文档。
该产品页和 Wiki 都说明控制板引出 USB/SPI/I80 接口；本项目只实现 USB SCSI 路径。

| 项目 | 参数 |
| --- | --- |
| 控制器 | IT8951 |
| 屏幕尺寸 | 7.8 英寸 |
| 分辨率 | 1872 x 1404 |
| 显示颜色 | 黑、白 |
| 灰度等级 | 2-16 级，1-4 bpp |
| 通信接口 | USB / SPI / I80 |
| 工作电压 | 5V |
| 外形尺寸 | 173.8 x 127.6 x 0.78 mm |
| 显示尺寸 | 158.184 x 118.638 mm |
| 点距 | 0.0845 x 0.0845 mm |
| 可视角度 | >170 度 |
| 全局刷新 | 商城页标注 <1s；Wiki 参数表标注 450ms 测试值 |
| 总刷新功耗 | 1.2W typ. |
| 总待机功耗 | 0.1W typ. |
| 工作温度 | 0 ~ 50 ℃ |
| 存储温度 | -25 ~ 70 ℃ |
| 配置清单 | 7.8inch e-Paper、e-Paper IT8951 Driver HAT (B)、7.8inch e-Paper Adapter、40PIN FFC、USB A 转 micro 线、RPi 铜柱包、PH2.0 8PIN 线 |

硬件注意事项：

- 7.8inch e-Paper 尺寸较大，面板和 FPC 排线都比较脆弱；研发调试时建议在 FPC 排线处贴透明胶加固。
- 不可带电插拔 e-paper。
- VCOM 应从 FPC 线上查看实际数值，并作为运行参数传入；README 中的 `WAVESHARE_7_8INCH` 只是项目预设值。

## 当前项目对齐结果

### 已重构

- 新增 `src/protocol.ts`，集中封装：
  - CBW 编码；
  - INQUIRY / GET_SYS / LD_IMG_AREA / DPY_AREA / PMIC / memory command CDB；
  - 系统信息与 INQUIRY 解析；
  - Index mode 地址生成；
  - 60 KiB USB 传输分块；
  - 图像区域参数与长度校验。
- `USBInterface` 已退回到设备枚举、bulk endpoint 管理和传输编排，不再手写分散的 CDB 字节。
- `loadImageArea` 和 `loadImageAreaIndexed` 自动按行分块，避免全屏图像超过 60 KiB 限制。
- `fastWriteMemory` 修正为官方 CDB 布局，并对大 buffer 分块。
- `setPowerVcom` 默认 big-endian，符合 USB Programming Guide；如需兼容旧实验固件仍可显式传 `EndianTypes.LITTLE`。
- `PixelModes` 修正为 2/3/4/8bpp = 0/1/2/3。
- `DISPLAY_PRESETS` 修正 7.8inch 宽高为 `1872 x 1404`，并补齐 6inch HD、9.7inch、13.3inch 常见预设。
- 补充协议级与 USBInterface 回归测试，覆盖关键字节布局和分块行为。

### 保留但降级为实验/兼容

- `loadImageEnd()` 保留为低级实验接口。公开 USB `LD_IMG_AREA` 流程不要求它；它更接近 I80/SPI 主机接口里的 `LD_IMG_END`。
- `firmwareVersion` 字段在 USB `GET_SYS` 路径上只能表达 command table version；USB 文档没有提供 SPI `GET_DEV_INFO` 里的 FW/LUT 字符串。

## 后续硬件验证建议

没有连接真实 IT8951 板卡时，当前验证只能证明协议帧、分块和 API 行为正确，不能证明某个具体固件接受所有命令。接硬件后建议按顺序验证：

1. `USBInterface.open()` 能找到 VID `0x048d` / PID `0x8951` 的 bulk endpoints。
2. `identify()` 返回 `Generic Storage RamDisc` 或等价 IT8951 身份。
3. `getSystemInfo()` 返回签名 `8951`、真实分辨率和 image buffer base。
4. `setPowerVcom()` 使用排线标注 VCOM 值，只做一次上电。
5. 先用小区域 `loadImageArea + displayArea` 验证坐标、黑白极性和 waitReady。
6. 再用全屏图像验证自动 60 KiB 分块。
7. 最后验证 `fastWriteMemory`，因为它需要固件支持 `0xA5`。
