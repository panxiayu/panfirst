# 企业管理系统 - Claude Code 工作文档

> 本文件由 Claude Code 自动维护。每次对话结束时更新。

---

## 当前任务 & 待办

| 类型 | 内容 |
|------|------|
| **当前任务** | 暂无紧急任务 |
| **待办** | 食堂统计页面（总份数统计）、打卡对账功能（打卡数据导入/自动比对） |

## 培训系统架构（重要）

```
exam.html（PC培训管理）
├── 培训记录 Tab → GET /api/exam-trainings/records-summary
│   └── 显示：授权人数、已完成学习、参加考试、通过考试、参与率、通过率
├── 培训任务 Tab → GET /api/exam-trainings
│   └── 新建/编辑/启用/停用培训
├── 学习资料 Tab → GET /api/learning-materials
│   └── 上传视频到移动云
└── 题库管理 Tab → GET /api/question-banks
    └── 导入题目

mobile-training-list.html（员工培训列表）
└── GET /api/exam/list → 跳转 mobile-learning-materials-detail.html

mobile-learning-materials-detail.html（员工视频学习）
├── 4事件触发进度保存：play, pause, ended, beforeunload
├── sendBeacon 确保页面关闭时可靠保存
├── maxWatched 防止跳过观看
└── 进度>=99% 弹出参加考试提示

exam_permissions 表（培训授权）
├── exam_id → exam_trainings.id
└── staff_id → staff.id

learning_progress 表（学习进度）
├── task_id → learning_tasks.id
├── staff_id → staff.id
└── status: not_started, in_progress, completed
```

---

## 项目概述

### 技术栈

| 组件 | 技术 |
|------|------|
| 前端 | 原生 HTML/CSS/JavaScript，无框架 |
| 后端 | Express.js |
| 数据库 | SQLite |
| 文件服务 | 独立的 Express 服务（端口 3001） |
| 第三方库 | Sortable.js（拖拽排序） |

### 访问地址

| 服务 | 地址 |
|------|------|
| 主系统 | `http://112.16.178.98:3000` |
| 文件服务 | `http://112.16.178.98:3001` |
| 域名入口 | `https://xlmould.panxy.online` |

---

## 页面结构

### 核心页面

| 页面 | 路径 |
|------|------|
| 员工登录 | `index.html` |
| 管理员登录 | `admin/login.html` |
| 员工工作台 | `employee.html` |
| 仪表板 | `dashboard.html` |
| 员工列表 | `staff-list.html` |
| 员工详情 | `staff-detail.html` |
| 学习资料列表 | `learning-task-list.html` |
| 学习资料详情 | `learning-task-detail.html` |
| 考试管理 | `exam.html`（Tab整合） |
| 报餐列表 | `meal-list.html` |
| 投票列表 | `voting-list.html` |
| 权限管理 | `permission-list.html` |
| 6S检查 | `6s-list.html` |
| 文件管理 | `file-manager.html` |
| 系统设置 | `settings.html` |

### 移动端页面

| 页面 | 路径 |
|------|------|
| 移动端学习资料列表 | `mobile-learning-materials-list.html` |
| 移动端学习资料详情 | `mobile-learning-materials-detail.html` |
| 移动端报餐列表 | `mobile-meal-list.html` |
| 移动端食堂查看 | `mobile-meal-view.html` |
| 移动端投票列表 | `mobile-voting-list.html` |
| 移动端投票页 | `mobile-voting.html` |
| 移动端投票结果 | `mobile-voting-result.html` |

---

## 模块关系图

```
dashboard.html（仪表板）
    │
    ├── 员工管理 → staff-list.html → staff-detail.html
    ├── 学习资料 → learning-task-list.html → learning-task-detail.html
    ├── 考试管理 → exam.html → exam-doing.html
    ├── 报餐管理 → meal-list.html
    ├── 投票管理 → voting-list.html → voting-detail.html
    ├── 6S检查 → 6s-list.html
    ├── 权限管理 → permission-list.html
    └── 文件管理 → file-manager.html
```

### 认证流程

```
员工登录 (index.html) ──→ employee.html（员工工作台）
管理员登录 (admin/login.html) ──→ dashboard.html（仪表板）
```

---

## 路由文件对应

| 路由文件 | 管理的 API |
|----------|-----------|
| `src/routes/auth.js` | 登录、登出、Token刷新、员工登录、权限查询 |
| `src/routes/staff.js` | 员工 CRUD、批量导入、SMB同步、列配置 |
| `src/routes/learning-material.js` | 学习资料 CRUD、进度管理 |
| `src/routes/exam.js` | 考试答题（学生端） |
| `src/routes/exam-trainings.js` | 培训管理（创建/编辑/删除/启用停用） |
| `src/routes/question-banks.js` | 题库管理、exam_trainings 表初始化 |
| `src/routes/meal.js` | 报餐 CRUD、订单 |
| `src/routes/voting.js` | 投票 CRUD、投票 |
| `src/routes/file-manager.js` | 文件上传、下载、删除 |
| `src/routes/settings.js` | 系统设置 |

---

## 数据库 Schema

### staff 表

```
id, name, employee_id, phone, department_id, position_id, hire_date,
exam_permission, meal_permission, status, created_at, updated_at,
department(TEXT), team(TEXT), position(TEXT), id_card, gender,
birthday, nationality, household, address, education, major,
graduate_school, contract_signed, contract_period, category,
bank_account, task_permission, s6_permission, guest_meal_permission
```

### meal_signups_v4 表（报餐签到）

```
id, activity_id, user_id, signup_date, meal_type,
employee_count, guest_count, reason, created_at
```

**注意**：
- 用 `user_id` 不是 `staff_id`
- 用 `employee_count/guest_count` 不是 `employee_meal_lunch/dinner`
- 四种数据完全独立：员工午餐、员工晚餐、客餐午餐、客餐晚餐

### six_s_records 表（6S曝光）

```sql
CREATE TABLE IF NOT EXISTS six_s_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_code TEXT,
  description TEXT,
  person_charge TEXT,
  status TEXT DEFAULT 'pending',
  before_image TEXT,
  after_image TEXT,
  area TEXT,
  created_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

---

## 注意事项

- **只使用 `theme.css`**（浅色主题），不要引入 `linear.css`
- **冻结列实现使用 `position: sticky`**
- **列配置通过 `POST /api/staff/column-config` 持久化到后端**
- **筛选器有 200ms 防抖**，不要手动加 setTimeout
- **数据库 staff 表没有 `s6_permission` 列**
- **路由顺序**：`/:id` 必须放在特定路径（如 `/permission-fields`）后面

---

## 开发进度

### 2026-04-27 完成

**培训记录标签页重构**
- 新增 `GET /api/exam-trainings/records-summary` 接口，只返回已启用的培训任务
- 添加 `is_archived` 字段，启用培训时自动设置
- 培训任务停用后记录永久保留（基于 `is_archived` 标记）
- 优化培训记录卡片样式：圆角、渐变、进度条、数据网格

**文件**：
- `src/routes/exam-trainings.js` - records-summary 接口、is_archived 逻辑
- `public/js/exam.js` - 培训记录卡片样式、showTrainingRecordDetail 函数

**云存储配置**
- 移动云 EOS（移动云）已配置
- 学习资料视频上传到移动云，公开访问URL
- 配置：`src/config/cloud-storage.js`

**MiniMax MCP 已集成**
- MCP 服务器：`minimax-coding-plan-mcp`
- 工具：`web_search`（网络搜索）、`understand_image`（图像理解）
- 配置：~/.claude.json

### 2026-04-26 完成

**培训管理系统修复**
- exam-trainings.js：修复确认启用报错（PUT API 要求 title 必须存在）
- exam-trainings.js：添加 start_time/end_time 字段支持
- question-banks.js：exam_trainings 表添加 start_time/end_time 列迁移
- exam.js：修复 previewPaper 解构 `{ training: exam, questions }`
- exam.js：修复 openExamSettings 使用 `question_bank_id`
- exam.js：修复 showTrainingRecordDetail 解构 `users` 而非 `usersWithProgress`
- exam.js：修复 deleteQuestionBank/deleteTask 显示关联培训信息
- exam.js：修复 stats/user API 返回值 `.summary` 访问

### 2026-04-21 完成

**报餐系统**
- meal.js 后端修复：INSERT OR REPLACE 语句列顺序、变量名不匹配
- 数据库迁移：添加 reason 列，移除 UNIQUE 约束中的 meal_type
- 报餐数据独立性：员工/客餐数据独立，互不影响
- mobile-meal-list.html UI优化
- 客餐申请优化：数字框重置、显示已报人数

### 2026-04-22 完成

**移动端报餐卡片滑动优化**
- 删除 `.swipe-container.swiped-left .swipe-card` CSS规则（!important覆盖inline style）
- 左滑无限制：移除 max(-80px) 限制，可无限左滑
- 松手回弹到固定位置 -60px
- 右滑恢复逻辑修复
- 滑动时卡片变色（#E5E5E5）+ 变圆角（16px）+ 缩小90%
- 滑动时 info-row 内容右移5px，info-count 左移15px，info-reason 左移5px
- 绿色勾和红圈删除按钮透明度联动
- 点击其他区域恢复卡片时绿圈也恢复
- 日期卡片高度固定64px不变
- 日历月卡片弹跳动画（6px），下滑提示箭头一起弹跳

**日期卡片**
- 已过报餐时间时状态文字右移 -100px

**API连通性验证**
- 确认 Joi schema 中 `dinner_employee` 字段已存在
- 客餐权限逻辑正确

### 2026-04-20 完成

**报餐系统**（9条需求全部完成）
- 新建报餐数据覆盖修复
- 右滑取消报餐
- 客餐页面午餐/晚餐按钮
- PC端特殊报餐卡片独立显示
- 字段独立性
- 日历标记规则（午餐黄/晚餐蓝/客餐绿）
- 日历上方统计卡片
- 日期格子点击动画
- 日历下滑膨胀

### 2026-04-16 完成

**学习资料路由重构**
- 路由路径：`/api/learning-tasks` → `/api/learning-materials`
- 新增移动端页面
- 视频播放/禁止快进功能

**权限管理页面重构**
- 报餐权限标签页重构
- 6S权限标签页重构
- 添加管理员弹窗优化

**投票系统功能**
- 匿名投票、设备Token
- 编辑功能、移动端页面

### 2026-04-14 完成

- 页面样式优化
- API修复（多个模块）

### 2026-04-10 完成

- staff-list.html 显示列功能优化
- staff-list.html 筛选功能优化

### 2026-04-09 完成

- 登录跳转地址改为域名

### 2026-04-08 完成

- 服务器安全加固（fail2ban）
- SMB自动同步任务

---

## 版本历史

| 版本 | 日期 | 主要内容 |
|------|------|----------|
| v0.0.8 | 2026-04-04 | 粒化权限管理系统、题库管理（粘贴/上传docx导入） |
| v0.0.7 | 2026-04-03 | 筛选栏优化、登录样式统一、侧边栏展开动画 |
| v0.0.6 | 2026-04-01 | 表头拖拽排序、LocalStorage持久化 |
| v0.0.5 | 2026-03-31 | 显示列/冻结列下拉菜单、批量操作优化 |
| v0.0.4 | 2026-03-30 | 字号缩小、工号列、职位改班组、SMB同步 |
| v0.0.3 | 2026-03-29 | exam.html Tab整合 |
| v0.0.2 | 2026-03-28 | 页面逻辑关系图、样式统一、清理废弃页面 |
| v0.0.1 | 2026-03-28 | 初始版本 |

---

## 项目关键路径

| 资源 | 路径 |
|------|------|
| 主系统 | `http://112.16.178.98:3000` |
| 文件服务 | `http://112.16.178.98:3001` |
| 员工列表页 | `public/staff-list.html` |
| API 封装 | `public/js/api.js` |
| 主题样式 | `public/css/theme.css` |
| 页面关系图 | `public/page-relationship.html` |

---

> 最后更新：2026-04-26
