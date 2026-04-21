# 投票系统和报餐系统 - 开发总结

## 📋 功能概述

### 投票系统
- ✅ 创建投票（支持单选和多选）
- ✅ 获取投票列表
- ✅ 获取投票详情
- ✅ 用户投票
- ✅ 获取投票结果（管理员）
- ✅ 防止重复投票
- ✅ 投票过期检查

### 报餐系统
- ✅ 创建报餐活动
- ✅ 获取报餐活动列表
- ✅ 获取报餐活动详情
- ✅ 用户报餐
- ✅ 获取报餐统计（管理员）
- ✅ 防止重复报餐
- ✅ 报餐过期检查
- ✅ 支持备注和数量

---

## 📁 文件结构

```
D:\exam\server\
├── src/
│   ├── routes/
│   │   ├── voting.js          # 投票系统路由
│   │   └── meal.js            # 报餐系统路由
│   └── index.js               # 已更新，注册新路由
├── data/
│   └── init-voting-meal.sql   # 数据库初始化脚本
├── VOTING_MEAL_API.md         # API 文档
├── test-voting-meal.sh        # 测试脚本
└── VOTING_MEAL_SUMMARY.md     # 本文件
```

---

## 🗄️ 数据库设计

### 投票系统表

#### votings 表
```sql
CREATE TABLE votings (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  deadline DATETIME NOT NULL,
  multiple_choice INTEGER DEFAULT 0,
  created_by INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### voting_options 表
```sql
CREATE TABLE voting_options (
  id INTEGER PRIMARY KEY,
  voting_id INTEGER NOT NULL,
  option_text TEXT NOT NULL,
  votes INTEGER DEFAULT 0
);
```

#### voting_records 表
```sql
CREATE TABLE voting_records (
  id INTEGER PRIMARY KEY,
  voting_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  option_ids TEXT NOT NULL,  -- 逗号分隔
  voted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(voting_id, user_id)
);
```

### 报餐系统表

#### meal_activities 表
```sql
CREATE TABLE meal_activities (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  deadline DATETIME NOT NULL,
  created_by INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### meal_menus 表
```sql
CREATE TABLE meal_menus (
  id INTEGER PRIMARY KEY,
  activity_id INTEGER NOT NULL,
  menu_name TEXT NOT NULL,
  price REAL NOT NULL,
  description TEXT
);
```

#### meal_orders 表
```sql
CREATE TABLE meal_orders (
  id INTEGER PRIMARY KEY,
  activity_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  menu_id INTEGER NOT NULL,
  quantity INTEGER DEFAULT 1,
  remarks TEXT,
  ordered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(activity_id, user_id)
);
```

---

## 🔌 API 端点

### 投票系统

| 方法 | 端点 | 权限 | 说明 |
|------|------|------|------|
| POST | `/api/voting/create` | 管理员 | 创建投票 |
| GET | `/api/voting/list` | 已登录 | 获取投票列表 |
| GET | `/api/voting/:id` | 已登录 | 获取投票详情 |
| POST | `/api/voting/:id/vote` | 已登录 | 投票 |
| GET | `/api/voting/:id/results` | 管理员 | 获取投票结果 |

### 报餐系统

| 方法 | 端点 | 权限 | 说明 |
|------|------|------|------|
| POST | `/api/meal/create` | 管理员 | 创建报餐活动 |
| GET | `/api/meal/list` | 已登录 | 获取报餐活动列表 |
| GET | `/api/meal/:id` | 已登录 | 获取报餐活动详情 |
| POST | `/api/meal/:id/order` | 已登录 | 报餐 |
| GET | `/api/meal/:id/statistics` | 管理员 | 获取报餐统计 |

---

## 🔐 权限控制

- **管理员**: 创建投票/报餐、查看结果/统计
- **已登录用户**: 查看列表、参与投票/报餐
- **未登录**: 无权访问

---

## ✨ 特性

### 投票系统特性
1. **单选和多选支持**: 创建时可指定 `multipleChoice` 参数
2. **防止重复投票**: 使用 UNIQUE 约束 `(voting_id, user_id)`
3. **投票过期检查**: 自动检查 deadline
4. **实时统计**: 获取投票结果时计算百分比
5. **灵活的选项**: 支持任意数量的选项

### 报餐系统特性
1. **菜单管理**: 支持多个菜单，每个菜单有价格和描述
2. **防止重复报餐**: 使用 UNIQUE 约束 `(activity_id, user_id)`
3. **报餐过期检查**: 自动检查 deadline
4. **数量和备注**: 支持报餐数量和特殊备注
5. **统计分析**: 
   - 每个菜单的订单数
   - 总销售量
   - 总收入
   - 百分比分布

---

## 🧪 测试

### 使用测试脚本
```bash
cd D:\exam\server
bash test-voting-meal.sh
```

### 手动测试

**1. 登录获取 token**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"openid":"test_user"}'
```

**2. 创建投票**
```bash
curl -X POST http://localhost:3000/api/voting/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "title": "午餐投票",
    "options": ["红烧肉", "清蒸鱼"],
    "deadline": "2026-03-26T12:00:00Z"
  }'
```

**3. 投票**
```bash
curl -X POST http://localhost:3000/api/voting/1/vote \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"optionIds": [1]}'
```

---

## 📝 使用说明

### 初始化数据库

```bash
# 在 Linux 上执行
cd /home/openclaw/apps/server
sqlite3 data/exam.db < data/init-voting-meal.sql
```

### 启动服务

```bash
# 在 Linux 上
docker-compose up -d

# 或本地运行
npm start
```

### 验证服务

```bash
curl http://localhost:3000/health
```

---

## 🚀 部署步骤

### 第 1 步：在 Windows 上提交代码
```bash
cd /d/exam/server
git add src/routes/voting.js src/routes/meal.js src/index.js
git add data/init-voting-meal.sql
git add VOTING_MEAL_API.md test-voting-meal.sh
git commit -m "feat: 添加投票系统和报餐系统"
git push origin feature/voting-and-meal-system
```

### 第 2 步：在 Linux 上测试
```bash
# SSH 连接到 Linux
ssh -p 2222 openclaw@192.168.110.22

# 切换到新分支
cd /home/openclaw/apps/server
git fetch origin
git checkout feature/voting-and-meal-system

# 初始化数据库
sqlite3 data/exam.db < data/init-voting-meal.sql

# 重启服务
docker-compose down
docker-compose up -d

# 查看日志
docker-compose logs -f
```

### 第 3 步：测试 API
```bash
# 运行测试脚本
bash test-voting-meal.sh
```

### 第 4 步：合并到主分支
```bash
# 在 Windows 上
git checkout master
git merge feature/voting-and-meal-system
git push origin master
```

---

## 📊 数据流

### 投票流程
```
用户登录 → 获取投票列表 → 查看投票详情 → 投票 → 查看结果（管理员）
```

### 报餐流程
```
用户登录 → 获取报餐列表 → 查看报餐详情 → 报餐 → 查看统计（管理员）
```

---

## 🔧 配置

### 环境变量
```
JWT_SECRET=your-secret-key
NODE_ENV=production
PORT=3000
```

### 数据库
- 类型: SQLite
- 位置: `data/exam.db`
- 初始化: `data/init-voting-meal.sql`

---

## 📚 相关文档

- [API 文档](./VOTING_MEAL_API.md)
- [测试脚本](./test-voting-meal.sh)
- [安全修复](./SECURITY_FIXES.md)
- [项目状态](./PROJECT_STATUS.md)

---

## ✅ 检查清单

- [x] 投票系统 API 完成
- [x] 报餐系统 API 完成
- [x] 数据库设计完成
- [x] API 文档完成
- [x] 测试脚本完成
- [x] 权限控制完成
- [x] 错误处理完成
- [ ] 在 Linux 上测试（待明天）
- [ ] 合并到主分支（待明天）

---

## 🎯 下一步

1. ✅ 代码已完成，在 `feature/voting-and-meal-system` 分支
2. ⏳ 明天在 Linux 上测试
3. ⏳ 测试通过后合并到 master
4. ⏳ 推送到生产环境

---

**创建时间**: 2026-03-25 01:32 GMT+8
**分支**: `feature/voting-and-meal-system`
**状态**: 待测试
