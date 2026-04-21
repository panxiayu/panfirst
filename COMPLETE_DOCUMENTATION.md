# 兴利汽车模具 - 考试报餐系统完整文档

## 📖 目录

1. [系统概述](#系统概述)
2. [功能模块](#功能模块)
3. [技术架构](#技术架构)
4. [API 文档](#api-文档)
5. [部署指南](#部署指南)
6. [用户手册](#用户手册)

---

## 系统概述

### 项目背景

兴利汽车模具公司需要一个成熟的企业级考试和报餐系统，用于：
- 员工在线考试和成绩管理
- 员工投票和民主决策
- 员工报餐和食堂管理
- 员工信息和任务管理

### 系统特点

- ✅ **生产级别**: 完整的错误处理和安全机制
- ✅ **易于使用**: 直观的用户界面和操作流程
- ✅ **高性能**: 数据库优化和缓存机制
- ✅ **可扩展**: 模块化架构，易于添加新功能
- ✅ **安全可靠**: JWT 认证、密码加密、权限控制

### 核心功能

| 模块 | 功能 | 状态 |
|------|------|------|
| 考试系统 | 在线考试、成绩管理、统计分析 | ✅ 完成 |
| 投票系统 | 创建投票、投票统计、结果分析 | ✅ 完成 |
| 报餐系统 | 报餐管理、菜单管理、统计分析 | ✅ 完成 |
| 人员管理 | 员工信息、部门管理、职位管理 | ✅ 完成 |
| 任务管理 | 任务分配、进度跟踪、完成管理 | ✅ 完成 |
| 系统设置 | 功能配置、公司信息、权限管理 | ✅ 完成 |

---

## 功能模块

### 1. 考试系统

#### 功能描述
- 创建和管理考试
- 员工在线答题
- 自动评分和成绩统计
- 成绩查询和分析

#### 主要页面
- `exam-list.html` - 考试列表
- `exam-doing.html` - 做题页面
- `result.html` - 成绩结果

#### API 端点
```
GET /api/import/exams - 获取考试列表
GET /api/import/exams/:id - 获取考试详情
POST /api/import/start - 开始考试
POST /api/import/submit - 提交答卷
GET /api/import/grades - 获取成绩
```

### 2. 投票系统

#### 功能描述
- 创建单选和多选投票
- 实时投票统计
- 防止重复投票
- 投票结果分析

#### 主要页面
- `voting-list.html` - 投票列表
- `voting-detail.html` - 投票详情

#### API 端点
```
GET /api/voting - 获取投票列表
GET /api/voting/:id - 获取投票详情
POST /api/voting - 创建投票
POST /api/voting/:id/vote - 投票
GET /api/voting/:id/results - 获取投票结果
```

### 3. 报餐系统

#### 功能描述
- 创建报餐活动
- 菜单管理和价格设置
- 员工报餐和数量管理
- 报餐统计和分析

#### 主要页面
- `meal-list.html` - 报餐列表
- `meal-detail.html` - 报餐详情

#### API 端点
```
GET /api/meal - 获取报餐列表
GET /api/meal/:id - 获取报餐详情
POST /api/meal - 创建报餐活动
POST /api/meal/:id/order - 报餐
GET /api/meal/:id/stats - 获取统计
```

### 4. 人员管理

#### 功能描述
- 员工信息管理
- 部门和职位管理
- 员工成绩和报餐记录查询
- 员工状态管理

#### 主要页面
- `staff-list.html` - 员工列表
- `staff-detail.html` - 员工详情

#### API 端点
```
GET /api/staff - 获取员工列表
GET /api/staff/:id - 获取员工详情
POST /api/staff - 添加员工
PUT /api/staff/:id - 编辑员工
DELETE /api/staff/:id - 删除员工
```

### 5. 任务管理

#### 功能描述
- 创建和分配任务
- 任务进度跟踪
- 任务完成管理
- 任务统计分析

#### 主要页面
- `task-list.html` - 任务列表
- `task-detail.html` - 任务详情

#### API 端点
```
GET /api/task - 获取任务列表
GET /api/task/:id - 获取任务详情
POST /api/task - 创建任务
PUT /api/task/:id - 编辑任务
POST /api/task/:id/complete - 完成任务
DELETE /api/task/:id - 删除任务
```

### 6. 系统设置

#### 功能描述
- 考试系统配置
- 报餐系统配置
- 投票系统配置
- 公司信息管理

#### 主要页面
- `settings.html` - 系统设置

#### API 端点
```
GET /api/settings - 获取所有设置
PUT /api/settings - 更新设置
GET /api/settings/exam - 获取考试设置
GET /api/settings/meal - 获取报餐设置
```

---

## 技术架构

### 系统架构图

```
┌─────────────────────────────────────────────────────────┐
│                    前端 (H5 网页)                        │
│  ┌──────────────┬──────────────┬──────────────────────┐ │
│  │ 考试系统     │ 投票系统     │ 报餐系统             │ │
│  │ 人员管理     │ 任务管理     │ 系统设置             │ │
│  └──────────────┴──────────────┴──────────────────────┘ │
└─────────────────────────────────────────────────────────┘
                          ↓ HTTP/HTTPS
┌─────────────────────────────────────────────────────────┐
│              后端 (Node.js + Express)                    │
│  ┌──────────────┬──────────────┬──────────────────────┐ │
│  │ 认证服务     │ 业务逻辑     │ 数据验证             │ │
│  │ 权限控制     │ 错误处理     │ 日志记录             │ │
│  └──────────────┴──────────────┴──────────────────────┘ │
└─────────────────────────────────────────────────────────┘
                          ↓ SQL
┌─────────────────────────────────────────────────────────┐
│              数据库 (SQLite)                             │
│  ┌──────────────┬──────────────┬──────────────────────┐ │
│  │ 考试数据     │ 投票数据     │ 报餐数据             │ │
│  │ 员工数据     │ 任务数据     │ 设置数据             │ │
│  └──────────────┴──────────────┴──────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### 技术栈

**前端**:
- HTML5 + CSS3 + JavaScript (Vanilla)
- 响应式设计
- Fetch API

**后端**:
- Node.js 14+
- Express.js
- SQLite3
- JWT 认证
- Bcrypt 密码加密

**工具**:
- npm/yarn
- Git
- Docker (可选)

### 数据库设计

#### 核心表

```sql
-- 用户表
users (id, username, password, email, role, created_at)

-- 员工表
staff (id, name, email, phone, department_id, position_id, hire_date, status)

-- 考试表
exams (id, title, description, duration, pass_score, created_at)

-- 投票表
votings (id, title, description, type, created_at)

-- 报餐表
meal_activities (id, title, description, created_at)

-- 任务表
tasks (id, title, description, type, assigned_to, assigned_by, due_date, priority, status)

-- 设置表
settings (id, key, value, updated_at)
```

---

## API 文档

### 认证 API

#### 登录
```
POST /api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "admin123"
}

响应:
{
  "code": 0,
  "msg": "success",
  "data": {
    "token": "eyJhbGc...",
    "user": {
      "id": 1,
      "username": "admin",
      "email": "admin@example.com",
      "role": "admin"
    }
  }
}
```

### 人员管理 API

#### 获取员工列表
```
GET /api/staff?search=&department=&status=
Authorization: Bearer {token}

响应:
{
  "code": 0,
  "msg": "success",
  "data": [
    {
      "id": 1,
      "name": "张三",
      "email": "zhangsan@example.com",
      "phone": "13800138000",
      "status": "active"
    }
  ]
}
```

#### 获取员工详情
```
GET /api/staff/:id
Authorization: Bearer {token}

响应:
{
  "code": 0,
  "msg": "success",
  "data": {
    "id": 1,
    "name": "张三",
    "email": "zhangsan@example.com",
    "examScores": [...],
    "mealOrders": [...]
  }
}
```

#### 添加员工
```
POST /api/staff
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "李四",
  "email": "lisi@example.com",
  "phone": "13900139000",
  "status": "active"
}

响应:
{
  "code": 0,
  "msg": "员工添加成功",
  "data": { ... }
}
```

### 工作任务 API

#### 获取任务列表
```
GET /api/task?status=&type=
Authorization: Bearer {token}

响应:
{
  "code": 0,
  "msg": "success",
  "data": [
    {
      "id": 1,
      "title": "完成Q1报告",
      "type": "exam",
      "status": "pending",
      "priority": "high"
    }
  ]
}
```

#### 创建任务
```
POST /api/task
Authorization: Bearer {token}
Content-Type: application/json

{
  "title": "参加员工培训",
  "type": "exam",
  "assigned_to": 1,
  "priority": "medium",
  "due_date": "2026-03-31"
}

响应:
{
  "code": 0,
  "msg": "任务创建成功",
  "data": { ... }
}
```

#### 完成任务
```
POST /api/task/:id/complete
Authorization: Bearer {token}

响应:
{
  "code": 0,
  "msg": "任务已完成",
  "data": null
}
```

### 系统设置 API

#### 获取所有设置
```
GET /api/settings
Authorization: Bearer {token}

响应:
{
  "code": 0,
  "msg": "success",
  "data": {
    "exam_enabled": true,
    "exam_max_duration": 120,
    "meal_enabled": true,
    "company_name": "兴利汽车模具"
  }
}
```

#### 更新设置
```
PUT /api/settings
Authorization: Bearer {token}
Content-Type: application/json

{
  "exam_enabled": true,
  "exam_max_duration": 120,
  "company_name": "兴利汽车模具"
}

响应:
{
  "code": 0,
  "msg": "设置更新成功",
  "data": null
}
```

---

## 部署指南

详见 `DEPLOYMENT_GUIDE.md`

---

## 用户手册

### 管理员操作

#### 1. 添加员工
1. 登录系统
2. 进入"人员管理"
3. 点击"+ 添加员工"
4. 填写员工信息
5. 点击"添加"

#### 2. 创建考试
1. 进入"考试系统"
2. 点击"+ 创建考试"
3. 填写考试信息
4. 上传试题
5. 点击"发布"

#### 3. 创建投票
1. 进入"投票系统"
2. 点击"+ 创建投票"
3. 填写投票信息
4. 添加投票选项
5. 点击"发布"

#### 4. 创建报餐活动
1. 进入"报餐系统"
2. 点击"+ 创建报餐"
3. 填写活动信息
4. 添加菜单和价格
5. 点击"发布"

#### 5. 分配任务
1. 进入"任务管理"
2. 点击"+ 创建任务"
3. 选择任务类型
4. 选择分配对象
5. 点击"创建"

### 员工操作

#### 1. 参加考试
1. 登录系统
2. 进入"考试系统"
3. 选择考试
4. 点击"开始考试"
5. 答题并提交

#### 2. 参与投票
1. 进入"投票系统"
2. 选择投票
3. 选择投票选项
4. 点击"投票"

#### 3. 报餐
1. 进入"报餐系统"
2. 选择报餐活动
3. 选择菜单和数量
4. 点击"报餐"

#### 4. 查看任务
1. 进入"任务管理"
2. 查看分配给自己的任务
3. 完成任务后点击"完成"

---

## 常见问题

### Q: 如何重置密码？
A: 联系管理员重置密码。

### Q: 如何导出数据？
A: 在系统设置中选择"导出数据"。

### Q: 如何备份数据？
A: 定期备份 `data/exam.db` 文件。

### Q: 系统支持多少用户？
A: 系统可支持数千用户，具体取决于服务器配置。

---

## 技术支持

如有问题，请联系技术团队。

---

**文档版本**: 1.0.0
**最后更新**: 2026-03-25
**作者**: AI Assistant
