# 兴利汽车模具 - 员工管理系统 开发日志

> 最后更新：2026-04-03
> 当前版本：v0.0.6

---

## 一、项目概述

### 1.1 项目组成

| 服务 | 路径 | 说明 |
|------|------|------|
| 主系统 | `/home/openclaw/apps/server` | 员工管理系统（Express + SQLite） |
| 文件服务 | `/home/openclaw/file-server` | 文件上传下载服务（Express） |

### 1.2 访问地址

- 主系统：http://112.16.178.98:3000
- 文件服务：http://112.16.178.98:3001

### 1.3 技术栈

- **前端**：原生 HTML/CSS/JavaScript，无框架
- **后端**：Express.js
- **数据库**：SQLite
- **文件服务**：独立的 Express 服务
- **第三方库**：Sortable.js（拖拽排序）

---

## 二、页面结构

### 2.1 文件路径

所有页面位于 `/home/openclaw/apps/server/public/`

| 页面 | 路径 | 说明 |
|------|------|------|
| 员工登录 | `index.html` | 工号+姓名登录 |
| 管理员登录 | `admin/login.html` | 用户名+密码登录 |
| 员工工作台 | `employee.html` | 员工首页（权限化入口） |
| 仪表板 | `dashboard.html` | 管理员首页，6个模块入口卡片 |
| 管理员面板 | `admin/panel.html` | 管理员侧边栏面板 |
| 管理员管理 | `admin-list.html` | 管理员CRUD |
| 员工列表 | `staff-list.html` | 员工管理核心页面 |
| 员工详情 | `staff-detail.html` | 员工详情+编辑 |
| 学习任务列表 | `learning-task-list.html` | |
| 学习任务详情 | `learning-task-detail.html` | |
| 考试管理（整合） | `exam.html` | Tab整合：试卷/题目/记录 |
| 答题界面 | `exam-doing.html` | |
| 报餐列表 | `meal-list.html` | |
| 报餐详情 | `meal-detail.html` | |
| 创建报餐 | `meal-create.html` | |
| 投票列表 | `voting-list.html` | |
| 投票详情 | `voting-detail.html` | |
| 文件管理 | `file-manager.html` | |
| 系统设置 | `settings.html` | |
| 页面关系图 | `page-relationship.html` | 系统页面关系可视化 |

### 2.2 侧边栏导航（staff-list.html）

路径：`/home/openclaw/apps/server/public/staff-list.html`

侧边栏 9 个菜单项（图标 + 中文标签）：

| 菜单 | 图标 | 目标页面 | 当前图标 |
|------|------|----------|----------|
| 首页 | 🏠 | dashboard.html | 🏠 |
| 员工管理 | 👥 | staff-list.html | 👥 |
| 6S检查 | 📋 | 6s-list.html | 📋 |
| 文件管理 | 📁 | file-manager.html | 📁 |
| 考试管理 | 📝 | exam-list.html | 📝 |
| 报餐管理 | 🍱 | meal-list.html | 🍱 |
| 投票管理 | 🗳️ | voting-list.html | 🗳️ |
| 任务管理 | 📌 | task-list.html | 📌 |
| 权限管理 | 🔐 | permission-list.html | 🔐 |

**侧边栏交互行为**：
- 正常状态：56px 宽度，仅显示图标（居中）
- 鼠标悬停：展开到 130px，同时显示图标 + 中文标签
- 展开延迟：通过 CSS `width` 和 `opacity` transition 实现，0.25s ease

---

## 三、员工列表页（staff-list.html）核心功能

### 3.1 冻结列

**功能**：勾选框、工号、姓名三列始终固定在左侧

**实现方式**：CSS `position: sticky` + `left` 定位

```css
th.frozen, td.frozen { position: sticky; z-index: 5; background: rgba(255,255,255,0.98); }
th.frozen { z-index: 10; }
th.frozen[data-key="checkbox"], td.frozen[data-key="checkbox"] { left: 0; width: 40px; min-width: 40px; }
th.frozen[data-key="employee_id"], td.frozen[data-key="employee_id"] { left: 40px; width: 90px; min-width: 90px; }
th.frozen[data-key="name"], td.frozen[data-key="name"] { left: 130px; width: 80px; min-width: 80px; }
```

### 3.2 显示列下拉菜单

**功能**：允许用户勾选显示/隐藏哪些列

**组件结构**：
- 按钮：`☰ 显示列`
- 下拉菜单：列勾选列表 + 搜索输入框
- 支持拖拽调整列顺序（Sortable.js）

**配置持久化**：
- 保存到后端：`POST /api/staff/column-config`
- 备份到 LocalStorage：`staffColumns` key
- 格式：`{ key: visible, _order: [...] }`

**下拉菜单关闭行为**：
- 鼠标离开菜单区域后 400ms 延迟关闭
- 搜索框获得焦点时取消关闭计时器
- 点击外部关闭菜单

### 3.3 Toast 通知

**样式**：白色毛玻璃效果，居中显示在顶部

```css
toast.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);padding:8px 16px;border-radius:6px;z-index:9999;font-size:12px;transition:opacity 0.2s, transform 0.2s;opacity:0;transform:translateX(-50%) translateY(-10px);backdrop-filter:blur(10px);background:rgba(255,255,255,0.7);box-shadow:0 2px 12px rgba(0,0,0,0.08);color:#333';
```

- 显示时长：1000ms（1秒）
- 动画：淡入淡出 + 轻微上移

### 3.4 列拖拽排序

**库**：Sortable.js

**约束**：
- 冻结列（checkbox、employee_id、name）禁止拖拽
- 拖拽到冻结列位置时自动恢复到原位置

**持久化**：拖拽结束后调用 `saveColumnConfig()`

### 3.5 表格 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/staff | 获取员工列表（支持 search、departments、teams、hire_date_from、hire_date_to 参数） |
| POST | /api/staff | 添加员工 |
| DELETE | /api/staff/:id | 删除员工 |
| POST | /api/staff/bulk-import | 批量导入 Excel |
| POST | /api/staff/sync-from-smb | 从 SMB 共享同步 |
| GET | /api/staff/column-config | 获取列配置 |
| POST | /api/staff/column-config | 保存列配置 |

**筛选参数说明**：
- `departments`: 逗号分隔的部门列表，如 `部门1,部门2`
- `teams`: 逗号分隔的班组列表，如 `班组1,班组2`
- `hire_date_from`: 入职日期起（YYYY-MM-DD）
- `hire_date_to`: 入职日期止（YYYY-MM-DD）

---

## 四、样式系统

### 4.1 CSS 文件

| 文件 | 路径 | 说明 |
|------|------|------|
| linear.css | `public/css/linear.css` | 基础样式重置和工具类 |
| theme.css | `public/css/theme.css` | CSS 变量定义（颜色、圆角、阴影等） |

### 4.2 CSS 变量（theme.css）

```css
--bg-page: #f0f2f5
--bg-surface: #fafbfc
--bg-card: rgba(255,255,255,0.85)
--bg-input: rgba(244,245,248,0.9)
--bg-hover: rgba(59,130,246,0.06)
--border: rgba(0,0,0,0.08)
--border-dark: rgba(0,0,0,0.15)
--accent: #3b82f6
--accent-light: rgba(59,130,246,0.15)
--primary: #4f46e5
--success: #22c55e
--danger: #ef4444
--text-primary: #1f2937
--text-secondary: #6b7280
--text-muted: #9ca3af
--radius: 8px
--radius-md: 10px
--radius-lg: 14px
--shadow: 0 1px 3px rgba(0,0,0,0.08)
--shadow-lg: 0 4px 20px rgba(0,0,0,0.12)
```

---

## 五、版本历史

### v0.0.7 (2026-04-03)

**员工管理列表**：
- 搜索栏改为筛选栏：工号/姓名搜索 + 部门（复选框下拉）+ 班组（复选框下拉）+ 入职日期范围
- 部门/班组下拉支持多选，选中数量实时显示在按钮上
- 筛选自动触发（200ms防抖），下拉选项从员工数据动态提取

**登录页面样式统一**：
- 移除 `linear.css`（深色主题），只使用 `theme.css`（浅色主题）
- 登录框样式与系统整体风格一致：毛玻璃背景、圆角、阴影
- 右上角按钮改为 `<button class="btn btn-secondary btn-sm">` 统一样式

**仪表板**：
- 右上角添加"员工登录"和"管理员"按钮

**侧边栏**：
- 鼠标悬停时宽度从 56px 展开到 130px
- 同时显示图标 + 中文标签
- CSS transition 实现平滑展开动画

### v0.0.6 (2026-04-01)

**员工管理列表**：
- 表头支持拖拽排序（Sortable.js）
- 拖拽时平滑"挤过"动画效果
- 列顺序配置持久化到 LocalStorage
- 冻结列保持 sticky 定位
- 下拉菜单添加淡入动画
- 下拉菜单关闭延迟 0.4 秒

**文件服务**：
- 初始版本
- 文件上传、列表、下载、删除功能

### v0.0.5 (2026-03-31)

- 新增"显示列"下拉菜单
- 新增"冻结列"下拉菜单（已移除，功能合并到显示列）
- 员工详情页新增编辑功能
- 批量删除、导入、同步功能交互优化

### v0.0.4 (2026-03-30)

- 员工列表字号改小（13px → 12px）
- 工号列显示在姓名前
- 移除邮箱、状态、操作列
- 工号、姓名可点击打开详情

### v0.0.3 (2026-03-29)

- 合并 exam-list/exam-records/question-bank 为 exam.html（Tab整合）

### v0.0.2 (2026-03-28)

- 确定页面逻辑关系图作为唯一标准
- 样式统一以 learning-task-list.html 为基准
- CSS 只保留 linear.css，删除多余文件
- 清理 13 个废弃页面

### v0.0.1 (2026-03-28)

- 初始版本
- 员工登录系统
- 管理员仪表板
- 6 个业务模块

---

## 六、已知问题与待办

### 6.1 待办事项

- [ ] 左侧边栏图标修改（用户提供新图标后实施）
- [x] 左侧边栏展开动画效果（悬停展开显示中文标签）
- [ ] 6S列表页面（6s-list.html）未确认功能

### 6.2 技术债

- 部分页面仍使用旧样式，未统一到 theme.css
- `admin.js`、`admin-new.js` 两个管理员脚本待清理

---

## 七、关键文件索引

| 文件 | 说明 |
|------|------|
| `public/staff-list.html` | 员工列表页（本次主要工作区） |
| `public/page-relationship.html` | 页面关系图 |
| `public/css/linear.css` | 基础样式 |
| `public/css/theme.css` | 主题变量 |
| `public/js/api.js` | API 封装（getToken 等） |
| `public/js/sortable.min.js` | 拖拽排序库 |
| `CHANGELOG.md` | 更新日志 |
| `DEVLOG.md` | 本开发日志 |
