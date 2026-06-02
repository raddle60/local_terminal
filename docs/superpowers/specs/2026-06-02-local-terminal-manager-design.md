# Local Terminal Manager - 设计文档

## 1. 项目概述

基于 Electron 的本地终端管理器，参考 VSCode 的 shell 集成方式。左侧为树形结构的 profile 定义，右侧为 tab 页形式的 shell 命令窗口。

## 2. 技术栈

| 组件 | 技术选型 |
|------|----------|
| 桌面框架 | Electron |
| Shell 进程 | node-pty |
| 终端渲染 | xterm.js |
| 配置存储 | JSON |

**架构参考：** VSCode 原生 shell 集成（node-pty + xterm.js）

## 3. 功能需求

### 3.1 Profile 管理

- 树形结构展示 profile 定义
- 支持文件夹分组
- 双击 profile 启动新 shell tab

### 3.2 Profile 配置

每个 profile 包含以下配置：

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 唯一标识 |
| name | string | 显示名称 |
| type | string | `folder` 或 `profile` |
| icon | string | 图标文件路径（可选） |
| children | array | 子节点（仅 folder 有） |
| config.shell | string | 执行的 shell 程序 |
| config.args | array | shell 参数 |
| config.cwd | string | 启动目录 |
| config.autoScripts | array | 自动脚本序列 |

### 3.3 自动脚本

支持两种脚本类型：

```json
{
  "autoScripts": [
    { "command": "cd D:\\workspace", "waitFor": null },
    { "command": "echo started", "waitFor": "started" }
  ]
}
```

| 字段 | 说明 |
|------|------|
| command | 要执行的命令 |
| waitFor | 等待输出的字符串（null 表示立即执行） |

**执行逻辑：**
1. 发送命令
2. 若 waitFor 不为 null，等待输出匹配该字符串后发送下一条
3. 若 waitFor 为 null，等待固定 100ms 后发送下一条
4. 超时时间 5 秒，超时自动继续

### 3.4 Shell 类型图标

- 始终显示 shell 类型图标
- 可为每个 profile 自定义图标文件路径
- 默认使用系统 shell 的图标
- 未定义的 shell 类型使用默认图标（📦）

## 4. UI 设计

### 4.1 整体布局

```
┌─────────────────────────────────────────────────────────┐
│  Window Title: "Local Terminal" [输出中]               │
├──────────────┬──────────────────────────────────────────┤
│              │  ┌─────┬─────┬─────┐                     │
│  Profiles    │  │ Tab │ Tab │ Tab │  ← 标签栏           │
│  📁 分组1    │  ├─────┴─────┴─────┤                     │
│    📝 ssh    │  │                 │                     │
│    📝 local  │  │  Terminal       │                     │
│  📁 分组2    │  │  Content        │                     │
│    📝 debug  │  │  (xterm.js)     │                     │
│              │  │                 │                     │
│  [+][-]      │  └─────────────────┘                     │
├──────────────┴──────────────────────────────────────────┤
│  Status Bar: 活动会话数 | 当前用户@主机                 │
└─────────────────────────────────────────────────────────┘
```

### 4.2 Tab 结构

```
┌──────────────────────────────┐
│ [图标] profile-name     [×] │
└──────────────────────────────┘
```

### 4.3 Tab 状态视觉

| Tab 状态 | 背景色 | 边框/指示器 |
|----------|--------|-------------|
| 空闲（无输出） | `#2d2d2d` | 无 |
| 输出中 | `#2d2d2d` | 左侧 `#1e6a4a` 竖条 |
| 选中 | `#2d2d2d` | 顶部 `#0078d4` 边框 |
| 已断开 | `#2d2d2d` | 左侧 `#dc3545` 竖条 |

**示意图：**

```
空闲:    ┌─────────────────┐
         │ ● name     [×] │
输出中:  ┌█────────────────┐   ← 左侧绿色竖条
         │█● name     [×]  │
选中:    ┌─────────────────┐   ← 顶部蓝色边框
         │● name     [×]  │
         └─────────────────┘
```

### 4.4 窗口标题动态更新

| 状态 | 标题 |
|------|------|
| 无活动 tab | `"Local Terminal"` |
| 任意 tab 有新输出 | `"Local Terminal ● 输出中"` |
| 输出结束 | `"Local Terminal"` |

## 5. 项目结构

```
local_terminal/
├── src/
│   ├── main/                 # Electron 主进程
│   │   ├── index.ts
│   │   ├── pty-manager.ts    # node-pty 管理
│   │   └── ipc-handlers.ts   # 主进程 IPC
│   ├── renderer/             # 渲染进程
│   │   ├── index.html
│   │   ├── index.ts
│   │   ├── components/
│   │   │   ├── ProfileTree.ts
│   │   │   ├── TabBar.ts
│   │   │   └── TerminalView.ts
│   │   └── services/
│   │       └── ipc-client.ts
│   └── preload/
│       └── index.ts
├── profiles.json              # Profile 配置
├── package.json
└── README.md
```

## 6. IPC 通信设计

| 通道 | 方向 | 说明 |
|------|------|------|
| `profile:load` | renderer → main | 加载 profile 配置 |
| `profile:save` | renderer → main | 保存 profile 配置 |
| `shell:create` | renderer → main | 创建新 shell |
| `shell:write` | renderer → main | 向 shell 写入数据 |
| `shell:resize` | renderer → main | 调整终端大小 |
| `shell:data` | main → renderer | shell 输出数据 |
| `shell:exit` | main → renderer | shell 退出 |
| `shell:output-start` | main → renderer | shell 开始输出 |
| `shell:output-end` | main → renderer | shell 输出结束 |

## 7. 数据流

```
用户双击 profile
    ↓
renderer 发送 shell:create (profileId)
    ↓
main 创建 node-pty 进程
    ↓
main 发送 shell:data 到 renderer
    ↓
xterm.js 渲染输出
    ↓
用户输入 → shell:write → node-pty 输入
```

## 8. 默认 Profile 配置 (profiles.json)

```json
{
  "profileTree": [
    {
      "id": "folder-dev",
      "name": "开发环境",
      "type": "folder",
      "children": [
        {
          "id": "profile-powershell",
          "name": "PowerShell",
          "type": "profile",
          "icon": null,
          "config": {
            "shell": "powershell.exe",
            "args": [],
            "cwd": "%USERPROFILE%",
            "autoScripts": []
          }
        },
        {
          "id": "profile-cmd",
          "name": "CMD",
          "type": "profile",
          "icon": null,
          "config": {
            "shell": "cmd.exe",
            "args": [],
            "cwd": "%USERPROFILE%",
            "autoScripts": []
          }
        },
        {
          "id": "profile-git-bash",
          "name": "Git Bash",
          "type": "profile",
          "icon": null,
          "config": {
            "shell": "C:\\Program Files\\Git\\bin\\bash.exe",
            "args": [],
            "cwd": "%USERPROFILE%",
            "autoScripts": []
          }
        }
      ]
    }
  ]
}
```

## 9. 实现要点

1. **node-pty 多实例管理**：每个 tab 对应一个 pty 实例
2. **xterm.js FitAddon**：终端大小自适应容器
3. **输出状态检测**：通过 data 事件判断是否有新输出
4. **窗口标题更新**：主进程维护全局输出状态，标题变化时通知 renderer
5. **profile 配置持久化**：使用 electron-store 或直接读写 JSON 文件
