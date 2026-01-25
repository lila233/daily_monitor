# Daily Monitor (电脑使用时长监测系统)

[English](./README.md)

一个自动化、本地化的电脑使用行为追踪系统，用于记录并可视化每日应用使用情况和网页浏览时长。专为 Windows 优化，确保极低的性能开销。

## 预览

| Modern (现代) | Industrial (工业) | Terminal (终端) |
|---------------|-------------------|-----------------|
| ![Modern](./docs/modern.png) | ![Industrial](./docs/industrial.png) | ![Terminal](./docs/terminal.png) |

## 功能特性

- **实时追踪**：每秒监测当前活动的应用程序和浏览器标签页
- **智能挂机检测**：离开电脑时自动暂停（支持键鼠/手柄/媒体播放检测）
- **多主题切换**：Modern（现代）、Industrial（工业）、Terminal（终端）三种风格
- **自动识别网站名**：从页面标题中智能提取网站名称
- **交互式筛选**：点击图表筛选活动日志，支持按应用/标题/URL搜索
- **日期范围选择**：查看今天、昨天、近7天/30天或自定义范围
- **本地隐私**：所有数据存储在本地 SQLite，无云端同步

---

## 快速开始

### 环境要求

- **Node.js**：v16 或更高版本
- **Windows 系统**：必须（依赖 Windows 原生 API）
- **.NET Framework**：用于编译 C# 工具

# 1. 克隆仓库
git clone https://github.com/lila233/daily_monitor.git
cd daily_monitor

# 2. 安装服务端依赖
npm install

# 3. 安装前端依赖
npm install --prefix client

# 4. 编译原生工具（首次运行必须）
cd server/tools
C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe /out:IdleCheck.exe IdleCheck.cs
C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe /out:GamepadCheck.exe GamepadCheck.cs
cd ../..

# 5. 构建前端
npm run build --prefix client
```

### 运行方式

#### 方式 A：后台静默运行（推荐日常使用）

双击根目录下的 **`run_monitor_bg.vbs`**
- 在后台启动服务端，不显示命令行窗口
- 访问 `http://localhost:3001` 查看仪表盘

**开机自启动（推荐）：**
1. 按 `Win + R`，输入 `shell:startup`，回车
2. 将 `run_monitor_bg.vbs` 复制到打开的启动文件夹中
3. 之后每次开机都会自动启动监控服务

#### 方式 B：开发模式

```bash
npm run dev
```
- 服务端和前端均支持热重载
- 适合调试开发

#### 方式 C：生产模式

```bash
npm start
```

### 停止服务

双击根目录下的 **`stop_monitor.bat`** 即可关闭服务。

---

## Chrome 扩展安装

Chrome 扩展可以上报精确的 URL（而不仅仅是窗口标题），增强监测精度。

1. 打开 Chrome，访问 `chrome://extensions/`
2. 开启右上角的 **开发者模式**
3. 点击 **加载已解压的扩展程序**
4. 选择本项目中的 `chrome-extension` 文件夹
5. 确保扩展已启用

**验证方法**：扩展会自动工作。在扩展页面点击 "Service Worker" 可查看是否有报错。

---

## 项目架构

```
daily_monitor/
├── server/                 # Node.js 后端
│   ├── index.js           # Express 服务器 & API 接口
│   ├── monitor.js         # 核心追踪逻辑
│   ├── db.js              # SQLite 数据库 & 网站名识别
│   └── tools/             # Windows 原生工具
│       ├── IdleCheck.cs   # 键鼠挂机检测
│       ├── GamepadCheck.cs # Xbox 手柄检测
│       └── MediaCheck.ps1 # 媒体播放检测
├── client/                 # React 前端
│   └── src/
│       ├── App.jsx        # 主仪表盘组件
│       ├── themes.css     # 主题样式定义
│       └── context/       # 主题上下文
└── chrome-extension/       # 浏览器扩展
    ├── manifest.json
    └── background.js
```

### 组件说明

| 组件 | 技术栈 | 功能 |
|------|--------|------|
| 服务端 | Node.js, Express, SQLite | 窗口追踪、API、数据持久化 |
| 前端 | React, Vite, Recharts | 数据可视化仪表盘 |
| 扩展 | Chrome MV3 | 浏览器 URL 上报 |

---

## 主题切换

点击右上角的主题按钮可循环切换：

| 主题 | 风格 |
|------|------|
| **Modern** | 紫色玻璃态，简洁现代 |
| **Industrial** | 复古航空仪表盘，暖琥珀色调 |
| **Terminal** | CRT 终端/黑客风格，绿色荧光 |

主题偏好会保存到浏览器本地存储。

---

## 性能优化

确保对游戏等高性能任务零影响：

- **挂机检测**：离开 120 秒后自动暂停追踪
- **智能轮询**：前端标签页隐藏时停止刷新
- **WAL 模式**：SQLite 写前日志，避免 I/O 阻塞
- **常驻子进程**：原生工具通过 stdio 通信，无进程启动开销
- **写入缓冲**：数据库每秒批量写入一次

---

## 配置参数

`server/monitor.js` 中的关键常量：

```javascript
IDLE_THRESHOLD_SECONDS = 120  // 挂机 2 分钟后暂停追踪
POLL_INTERVAL = 1000          // 每 1 秒检测一次活动窗口
```

---

## 常见问题

### "ENOENT: IdleCheck.exe not found"
需要编译 C# 工具：
```bash
cd server/tools
C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe /out:IdleCheck.exe IdleCheck.cs
C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe /out:GamepadCheck.exe GamepadCheck.cs
```

### "Cannot find client/dist/index.html"
需要构建前端：
```bash
npm run build --prefix client
```

### Chrome 扩展不工作
1. 确认服务器正在端口 3001 运行
2. 在 `chrome://extensions/` 确认扩展已启用
3. 点击 "Service Worker" 查看错误日志

---

## 开源协议

MIT License
