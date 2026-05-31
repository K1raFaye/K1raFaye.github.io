# CQB Simulator — 室内近距离战斗模拟器

**Ciallo～(∠・ω< )⌒☆ Author / 作者：KiraFaye** | **Version / 版本：Ver 2.0** | **Date / 日期：2026-05-02**

> A pure frontend tactical mapping & CQB planning tool. Open in browser, ready to use. No installation required.
>
> 一款纯前端战术标图与 CQB 战术规划工具。打开浏览器即可使用，无需安装任何依赖。

---

## Table of Contents / 目录

- [English](#english)
  - [Overview](#overview)
  - [Tech Stack](#tech-stack)
  - [Core Features](#core-features)
  - [Data Architecture](#data-architecture)
  - [UI Design](#ui-design)
  - [Keyboard Shortcuts](#keyboard-shortcuts)
  - [File Structure](#file-structure)
  - [Version History](#version-history)
- [中文](#中文)
  - [项目概述](#项目概述)
  - [技术架构](#技术架构)
  - [核心功能](#核心功能)
  - [数据架构](#数据架构)
  - [用户界面](#用户界面)
  - [快捷键一览](#快捷键一览)
  - [文件说明](#文件说明)
  - [版本更新记录](#版本更新记录)

---

# English

## Overview

**CQB Simulator** is a browser-based tactical planning and Close Quarters Battle simulation tool. It allows users to draw building floor plans, deploy personnel (operators, hostiles, hostages), analyze line-of-sight with real-time occlusion, and plan assault routes — all within a pure black, SpaceX-inspired aerospace UI.

Use cases include: tactical planning, indoor combat rehearsal, CQB training & education, and scenario walkthroughs.

### Live Demo / 在线演示

👉 [https://k1rafaye.github.io](https://k1rafaye.github.io)

### Source Code / 源代码

👉 [https://github.com/K1raFaye/K1raFaye.github.io](https://github.com/K1raFaye/K1raFaye.github.io)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Markup** | HTML5 |
| **Styling** | CSS3 (responsive, mobile-first) |
| **Logic** | Vanilla JavaScript (ES6 Class, ~3,510 lines) |
| **Rendering** | Canvas 2D API — all elements self-drawn, zero third-party dependencies |
| **State Management** | In-memory tree: `Layer → Scene → Elements[] + Gunlines[]`, with JSON snapshot history stack (50 steps) for undo/redo |
| **UI Theme** | SpaceX aerospace aesthetic — pure black (`#000000`) + spectral white (`#f0f0fa`) + ghost borders |

**Zero dependencies. No npm, no build step. Just open `index.html`.**

---

## Core Features

### 1. Multi-Floor, Multi-Scene System 🏢

- Create and manage multiple floors (1F, 2F, 3F…)
- Each floor supports **multiple independent scenes** — elements and gunlines are fully isolated per scene
- New scenes auto-copy all content from the previous scene
- Scene management: double-click to rename (desktop) / long-press action sheet (mobile), hover × to delete
- Stairs can link to target floors for cross-level navigation
- Floors can be reordered, renamed, and deleted

### 2. Building Elements 🧱

| Element | Description |
|---------|-------------|
| 🧱 Wall | Rectangle, freely rotatable, blocks line-of-sight |
| 🚪 Door | 4-way hinge (left/right/top/bottom) + adjustable swing angle 0°–360° |
| 🪟 Window | Semi-transparent, does **not** block vision |
| 🪜 Stairs | Cross-floor connector with target layer binding |
| 🚧 Obstacle | Rectangle or circle, rotatable |

All elements support: drag, rotate, resize, recolor, and custom labels.

### 3. Personnel Units 👤💀🙋

| Unit | Description |
|------|-------------|
| 👤 Operator | Friendly CQB operator — name / callsign / position fields, can serve as gunline origin |
| 💀 Hostile | Enemy target — hidden in Combat Mode, can serve as gunline origin |
| 🙋 Hostage | Civilian to rescue — cannot serve as gunline origin |

- Global operator size control (10px–30px)
- Hover tooltip shows name, callsign, position, and FOV info

### 4. Line-of-Sight / FOV Occlusion System 👁️ *(Signature Feature)*

- **Raycasting algorithm**: 72 rays scan all obstacles in real time
- Each operator has a configurable FOV cone (default 120°, range 30°–180°)
- Vision distance: finite or infinite
- Rotated building elements calculate occlusion polygons at each angle
- Door swing angle dynamically affects vision penetration (all 4 hinge positions supported)
- Windows allow vision to pass through
- Global occlusion toggle (keyboard `O`)

### 5. Drawing / Whiteboard Tools ✏️

| Tool | Description |
|------|-------------|
| ✏️ Freehand | Free-draw path |
| ▭ Rectangle | Draw rectangle annotations |
| ⭕ Circle | Draw circle annotations |
| 📏 Line | Draw straight line segments |
| 🗑️ Area Erase | Drag-select to erase drawing elements in area |
| 🧹 Clear All | Clear all drawing elements in current scene |

- Configurable color (color picker) and line width (1px–20px)
- Draw elements are separate from building elements; area erase only affects drawings

### 6. Canvas Zoom & Pan 🔍 *(Seewo Whiteboard Mode)*

| Action | Desktop | Mobile |
|--------|---------|--------|
| Zoom | Mouse wheel (cursor-centered) | Two-finger pinch |
| Pan | Select tool + drag on empty area | Single-finger drag on empty area |

- Zoom range: 25% – 500%
- All mouse/touch coordinates auto-converted via `screenToCanvas()`

### 7. Smart Snapping 🔗

- Grid snapping + element edge/corner snapping (threshold: 8px)
- **Dimension snapping**: new building elements auto-match existing element widths/heights
- Toggle with keyboard `S`

### 8. Gunline System 🔫

- Draw fire-direction lines from operators or hostiles
- Desktop: right-click long-press + drag → release to place
- Mobile: long-press personnel (350ms) + drag → release to place
- Gunlines display as directional arrows, color-matched to source
- Click to select and delete individual gunlines

### 9. Combat Mode ⚔️

- Toggle with keyboard `M`
- When enabled, all hostile units are hidden from the canvas
- Simulates real-world intelligence uncertainty
- Banner indicator: "实战模式已启用 - execute! execute! execute!"

### 10. Undo / Redo ↩️↪️

- Full snapshot history stack (up to 50 steps)
- Captures complete state of all floors and all scenes
- Desktop: `Ctrl+Z` undo / `Ctrl+Y` redo
- Mobile: dedicated circular undo/redo buttons at bottom

### 11. Export 💾

- Export current canvas to PNG image
- `Ctrl+S` or click export button
- Clean export mode hides all UI overlays for clean output

---

## Data Architecture

```
Layers[]
  └─ Layer { id, name, scenes[], currentSceneId, sceneCounter }
       └─ Scene { id, name, elements[], gunlines[] }
            ├─ Element { id, type, x, y, width, height, rotation,
            │            color, label, fovAngle, fovRange, ... }
            └─ Gunline { id, fromX, fromY, toX, toY,
                         sourceType, sourceId, color }
```

Undo/redo snapshots store the complete `scenes[]` structure as JSON, enabling full cross-scene operation rollback.

---

## UI Design

### Visual Style

- **Pure black background** `#000000` + **spectral white text** `#f0f0fa`
- Semi-transparent ghost borders/surfaces
- Uppercase lettering with tracking (letter-spacing)
- Pill-shaped active states (white background + black text + glow)
- Inspired by SpaceX aerospace dashboard aesthetics

### Layout (Desktop)

```
┌─────────────┬──────────────────────────┬─────────────┐
│  Left       │                          │  Right      │
│  Toolbar    │    Main Canvas Area      │  Properties │
│  (220px)    │    (Flexible)            │  Panel      │
│             │                          │  (300px)    │
└─────────────┴──────────────────────────┴─────────────┘
```

**Left Toolbar:**
- Floor management (add/switch/sort/delete floors + scene tabs)
- Operation tools (select, delete, combat mode toggle)
- Building elements (wall, door, window, stairs, obstacle)
- Drawing tools (freehand, rect, circle, line + color/width controls)
- Personnel units (operator, hostile, hostage)
- Vision system toggle
- View controls (clear, export, grid toggle)

**Right Properties Panel:**
- Element property editing (position, size, rotation, color, label)
- Door-specific controls (swing angle slider, 4-way hinge selector)
- FOV parameters (angle, range type)
- Personnel info (name, callsign, position)
- Legend & shortcut reference
- Global settings

### Mobile Responsive

- Toolbar becomes a horizontal scroll bar at the top
- Properties panel slides in from the right side
- Bottom circular undo/redo buttons
- Touch gestures: single tap (select), single drag (pan), two-finger pinch (zoom), long-press (gunline / scene action sheet)
- Gesture hint overlay on mobile mode activation

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl + Z` | Undo |
| `Ctrl + Y` | Redo |
| `Delete` / `Backspace` | Delete selected element |
| `Esc` | Deselect |
| `G` | Toggle grid |
| `S` | Toggle smart snapping |
| `O` | Toggle FOV occlusion |
| `D` | Toggle selected door open/close (15° increments) |
| `M` | Toggle combat mode |
| `Ctrl + S` | Export PNG (clean, no UI) |
| Right-click drag on personnel | Draw gunline |

---

## File Structure

| File | Description | Size |
|------|-------------|------|
| `index.html` | Main page — full UI structure definition | ~365 lines |
| `app.js` | Core logic — `CQBTacticalBoard` class | ~3,510 lines |
| `spacex-ui.css` | SpaceX-themed stylesheet (desktop + mobile responsive) | ~1,346 lines |

---

## Version History

### Ver 2.0 (Current — 2026-05-02)

- 🆕 **Multi-scene system**: each floor supports multiple independent scenes, new scenes auto-copy previous scene
- 🆕 **Canvas zoom & pan**: scroll-wheel zoom, select+drag pan, two-finger pinch
- 🆕 **Smart dimension snapping**: new elements auto-match existing element sizes
- 🆕 **4-way door hinge**: left/right/top/bottom with correct occlusion calculation
- 🆕 **SpaceX UI theme**: complete visual redesign
- 🆕 **Floor management UI redesign**: transparent cards, pill tabs, hover-reveal buttons
- 🐛 Fixed: scene name editing, floor name editing
- Default tool changed to "Select"

### Ver 1.0 (Initial)

- Multi-floor system, building elements, personnel units, gunline system
- Drawing tools, FOV occlusion with raycasting, combat mode
- Smart snapping, undo/redo, PNG export
- Mobile responsive with touch gestures

---

# 中文

## 项目概述

**CQB Simulator（室内近距离战斗模拟器）** 是一款基于浏览器的战术标图与室内近距离战斗推演工具。用户可以在纯黑 SpaceX 风格界面上绘制建筑平面图、部署人员（操作员、敌人、人质）、实时分析视野遮挡，并规划突击路线。

适用场景：战术规划、室内作战推演、CQB 训练教学、方案演示。

### 在线演示

👉 [https://k1rafaye.github.io](https://k1rafaye.github.io)

### 源代码

👉 [https://github.com/K1raFaye/K1raFaye.github.io](https://github.com/K1raFaye/K1raFaye.github.io)

---

## 技术架构

| 层级 | 技术 |
|------|------|
| **结构** | HTML5 |
| **样式** | CSS3（响应式，移动端优先） |
| **逻辑** | 原生 JavaScript（ES6 Class，约 3,510 行） |
| **渲染** | Canvas 2D API — 所有元素自绘，零第三方依赖 |
| **状态管理** | 内存树结构：`楼层 → 场景 → 元素[] + 枪线[]`，配合 JSON 快照历史栈（50 步）实现撤销/重做 |
| **UI 主题** | SpaceX 航空航天美学 — 纯黑背景 (`#000000`) + 光谱白文字 (`#f0f0fa`) + 幽灵边框 |

**零依赖。无需 npm、无需构建。直接用浏览器打开 `index.html` 即可。**

---

## 核心功能

### 1. 多楼层多场景系统 🏢

- 支持创建多个楼层（1F、2F、3F……），可增删移动重命名
- 每个楼层内支持**多个独立场景**，场景间完全隔离存储元素与枪线
- 新建场景自动复制前一场景的全部内容
- 场景管理：双击重命名（桌面端）/ 长按弹窗操作（移动端），悬停 × 删除
- 楼梯可绑定目标楼层实现跨层连接

### 2. 建筑元素 🧱

| 元素 | 说明 |
|------|------|
| 🧱 墙体 | 矩形，任意旋转，遮挡视野 |
| 🚪 门 | 4 向铰链（左/右/上/下）+ 开合角度 0°–360° 可调 |
| 🪟 窗户 | 半透明，**不**阻挡视线穿透 |
| 🪜 楼梯 | 跨楼层通道，可绑定目标楼层 |
| 🚧 遮挡物 | 矩形或圆形，支持旋转 |

所有元素均支持拖拽、旋转、缩放、改色、标注标签。

### 3. 人员单位 👤💀🙋

| 单位 | 说明 |
|------|------|
| 👤 操作员 | 我方 CQB 操作员 — 可设置名称/呼号/职位，可作为枪线起点 |
| 💀 敌人 | 敌对目标 — 实战模式下隐藏，可作为枪线起点 |
| 🙋 人质 | 需要救援的目标 — 不可作为枪线起点 |

- 操作员大小全局可调（10px–30px）
- 悬停浮窗显示名称、呼号、职位、FOV 信息

### 4. 视野遮挡系统 👁️ *(核心特色)*

- **射线投射算法（Raycasting）**：72 条射线实时扫描所有障碍物
- 每位操作员拥有可配置的扇形视野锥（默认 120°，范围 30°–180°）
- 视野距离：有限或无限
- 旋转的建筑元素按每个角度实时计算遮挡多边形
- 门的开合状态动态影响视野穿透（4 向铰链完整支持）
- 窗户允许视野穿透
- 全局开关（快捷键 `O`）

### 5. 画板工具 ✏️

| 工具 | 说明 |
|------|------|
| ✏️ 自由画笔 | 自由手绘路径 |
| ▭ 矩形 | 绘制矩形标注框 |
| ⭕ 圆形 | 绘制圆形标注 |
| 📏 直线 | 绘制直线段 |
| 🗑️ 区域删除 | 框选区域擦除画板内容 |
| 🧹 清空 | 一键清空当前场景所有画板内容 |

- 颜色自由选取 + 线宽 1px–20px 可调
- 画板元素与建筑元素独立管理，区域删除仅影响画板内容

### 6. 画布缩放与平移 🔍 *(希沃白板模式)*

| 操作 | 桌面端 | 移动端 |
|------|--------|--------|
| 缩放 | 鼠标滚轮（以光标为中心） | 双指捏合 |
| 平移 | 选择模式 + 空白处拖拽 | 单指拖动空白区域 |

- 缩放范围：25% – 500%
- 所有坐标通过 `screenToCanvas()` 自动转换

### 7. 智能对齐 🔗

- 网格吸附 + 元素边缘/角点吸附（阈值 8px）
- **尺寸吸附**：新建建筑元素时自动匹配已有元素的宽高
- 快捷键 `S` 切换开关

### 8. 枪线系统 🔫

- 从操作员或敌人拖出射击方向线
- 桌面端：右键长按拖动 → 松开完成
- 移动端：长按人员（350ms）→ 拖动 → 松开完成
- 枪线显示为带箭头方向线，颜色与来源人员一致
- 点击选中后可单独删除

### 9. 实战模式 ⚔️

- 快捷键 `M` 切换
- 开启后敌方目标自动隐藏，模拟真实情报不确定性
- 顶部横幅提示："实战模式已启用 - execute! execute! execute!"

### 10. 撤销 / 重做 ↩️↪️

- 完整快照历史栈（最多 50 步）
- 记录所有楼层、所有场景的完整状态
- 桌面端：`Ctrl+Z` 撤销 / `Ctrl+Y` 重做
- 移动端：底部独立圆形按钮

### 11. 导出 💾

- 导出当前画布为 PNG 图片
- `Ctrl+S` 或点击导出按钮
- 纯净导出模式自动隐藏所有 UI 叠加层

---

## 数据架构

```
Layers[]
  └─ Layer { id, name, scenes[], currentSceneId, sceneCounter }
       └─ Scene { id, name, elements[], gunlines[] }
            ├─ Element { id, type, x, y, width, height, rotation,
            │            color, label, fovAngle, fovRange, ... }
            └─ Gunline { id, fromX, fromY, toX, toY,
                         sourceType, sourceId, color }
```

撤销/重做快照以 JSON 格式保存完整的 `scenes[]` 结构，确保跨场景操作可完整回溯。

---

## 用户界面

### 视觉风格

- **纯黑背景** `#000000` + **光谱白文字** `#f0f0fa`
- 半透明幽灵边框 / 幽灵表面（Ghost Surface）
- 大写字母铭牌风格（字间距、全大写）
- 药丸形激活态（白底黑字 + 光晕）
- 灵感来源于 SpaceX 航空航天仪表板美学

### 桌面端布局

```
┌─────────────┬──────────────────────────┬─────────────┐
│  左侧工具栏  │                          │  右侧属性面板 │
│  (220px)    │      主画布区域           │  (300px)    │
│             │    (Canvas 自适应)        │             │
└─────────────┴──────────────────────────┴─────────────┘
```

**左侧工具栏：**
- 楼层管理（新建/切换/排序/删除楼层 + 场景标签栏）
- 操作工具（选择、删除、实战模式开关）
- 建筑元素（墙体、门、窗户、楼梯、遮挡物）
- 画板工具（画笔、矩形、圆形、直线 + 颜色/线宽控制）
- 人员单位（操作员、敌人、人质）
- 视野系统开关
- 视图控制（清空、导出、网格切换）

**右侧属性面板：**
- 元素属性编辑（位置、尺寸、旋转、颜色、标签）
- 门专属控制（开合角度滑块、4 向铰链选择器）
- 视野参数（FOV 角度、距离类型）
- 人员信息（名称、呼号、职位）
- 图例说明 & 快捷键参考
- 全局设置

### 移动端适配

- 工具栏变为顶部横向滚动条
- 属性面板从右侧滑入
- 底部独立圆形撤回/取消撤回按钮
- 触摸手势：单击（选择）、单指拖动（平移）、双指捏合（缩放）、长按（枪线 / 场景操作面板）
- 切换移动端时弹出操作提示浮窗（3 秒后自动消失）

---

## 快捷键一览

| 快捷键 | 功能 |
|--------|------|
| `Ctrl + Z` | 撤销 |
| `Ctrl + Y` | 重做 |
| `Delete` / `Backspace` | 删除选中元素 |
| `Esc` | 取消选择 |
| `G` | 切换网格 |
| `S` | 切换智能对齐 |
| `O` | 切换视野遮挡 |
| `D` | 开关选中的门（每次 15°） |
| `M` | 切换实战模式 |
| `Ctrl + S` | 导出 PNG（纯净无 UI） |
| 右键长按人员并拖动 | 拖出枪线 |

---

## 文件说明

| 文件 | 说明 | 规模 |
|------|------|------|
| `index.html` | 应用主页面，完整 UI 结构定义 | ~365 行 |
| `app.js` | 核心逻辑，`CQBTacticalBoard` 类 | ~3,510 行 |
| `spacex-ui.css` | SpaceX 风格样式表（桌面端 + 移动端响应式） | ~1,346 行 |

---

## 版本更新记录

### Ver 2.0（当前版本 — 2026-05-02）

- 🆕 **多场景系统**：每个楼层支持多个独立场景，新建自动复制前一场景
- 🆕 **画布缩放平移**：滚轮缩放、选择+拖拽平移、双指捏合
- 🆕 **智能尺寸吸附**：新建元素自动匹配已有元素尺寸
- 🆕 **门 4 向铰链**：左/右/上/下均有正确遮挡计算
- 🆕 **SpaceX 风格 UI**：完整视觉重设计
- 🆕 **楼层管理 UI 重设计**：透明卡片、药丸标签、hover 显隐按钮
- 🐛 修复：场景名称编辑、楼层名称编辑
- 默认工具改为"选择"

### Ver 1.0（初始版本）

- 多楼层系统、建筑元素、人员单位、枪线系统
- 画板工具、视野遮挡（Raycasting）、实战模式
- 智能对齐、撤销重做、导出 PNG
- 移动端适配（手势操作 + 响应式布局）

---

> **Zero dependencies. No installation. Just open `index.html` in your browser.**
>
> **零依赖。无需安装。直接用浏览器打开 `index.html` 即可使用。**
