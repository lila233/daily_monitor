# Chrome Monitor

这是一个用于监控和分析 Google Chrome 使用情况的全栈应用程序。它能够追踪您在 Chrome 中的活动，将数据存储在本地 SQLite 数据库中，并通过一个美观的 React 前端仪表盘展示您的使用统计信息。

## ✨ 功能特性

*   **实时监控**: 使用 `active-win` 实时检测当前活动的窗口和 Chrome 标签页。
*   **智能域名归类**: 自动将同一网站（如 Bilibili、YouTube）的不同页面访问合并为同一个会话，不再产生碎片化记录。
*   **数据持久化**: 使用 `better-sqlite3` 将监控数据安全地存储在本地 `history.db` 数据库中。
*   **可视化仪表盘**: 基于 React 和 Recharts 构建的现代化前端界面，直观展示您的浏览习惯。
*   **后台静默运行**: 提供 VBS 脚本，支持在 Windows 下无终端窗口后台启动监控。
*   **全栈开发**:
    *   **后端**: Node.js + Express
    *   **前端**: React + Vite
*   **开发便捷**: 使用 `concurrently` 一键同时启动前后端服务。

## 🛠️ 技术栈

### 后端 (Server)
*   **Node.js & Express**: 提供 API 接口和服务。
*   **active-win**: 获取当前活动窗口的详细信息。
*   **better-sqlite3**: 高性能的 SQLite 数据库驱动。
*   **date-fns**: 强大的日期处理库。

### 前端 (Client)
*   **React**: 用于构建用户界面的 JavaScript 库。
*   **Vite**: 超快的构建工具和开发服务器。
*   **Recharts**: 基于 React 的组合式图表库。
*   **Axios**: 用于发送 HTTP 请求。

## 🚀 快速开始

### 1. 环境准备
确保您的系统已安装 [Node.js](https://nodejs.org/) (推荐使用最新的 LTS 版本)。

### 2. 安装依赖

在项目根目录下运行以下命令来安装后端和前端的依赖：

```bash
# 安装根目录（后端）依赖
npm install

# 安装前端依赖
cd client
npm install
cd ..
```

> **注意**: 如果您在 Windows 上遇到 `better-sqlite3` 安装问题，通常是因为缺少构建工具。本项目已配置为尝试使用预编译版本，如果仍然失败，请确保您的 Node.js 版本与 `better-sqlite3` 兼容，或安装 Windows Build Tools。

### 3. 运行应用

**生产模式 (推荐)**：
在项目根目录下运行以下命令，将启动集成了前端界面的后端服务：

```bash
npm start
```

启动后：
*   **应用地址**: 访问 [http://localhost:3001](http://localhost:3001) 查看仪表盘。

**开发模式**:
如果您需要修改前端代码并实时预览：
```bash
npm run dev
```

## 👻 后台运行 (Windows)

如果您希望在不占用终端窗口的情况下运行监控程序：

1.  找到项目根目录下的 **`run_monitor_bg.vbs`** 文件。
2.  双击该文件即可在后台启动监控服务（包含 Web 界面）。
3.  您依然可以通过访问 [http://localhost:3001](http://localhost:3001) 来查看统计数据。
4.  如需停止服务，请打开任务管理器，结束 `node.exe` 进程。

## ❓ 常见问题 (Troubleshooting)

### PowerShell 脚本执行错误
如果您在 Windows PowerShell 中运行 `npm install` 或 `npm run` 时遇到类似以下的错误：
`npm : File ... cannot be loaded because running scripts is disabled on this system.`

这是因为 PowerShell 的执行策略限制。您可以尝试以下解决方法：

1.  **临时更改策略 (推荐)**:
    在管理员权限的 PowerShell 中运行：
    ```powershell
    Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
    ```

2.  **使用 cmd**:
    您可以直接使用 `npm.cmd` 代替 `npm`，例如 `npm.cmd install`。

### `better-sqlite3` 构建失败
如果在安装过程中遇到构建错误，请尝试更新 `better-sqlite3` 到最新版本，或者安装 Visual Studio Build Tools。

---
Happy Coding! 🚀
