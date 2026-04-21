# 兴利汽车模具 - 考试报餐系统

> 一个完整的企业级在线考试、投票、报餐管理系统

## 🚀 快速开始

### 1. 环境要求

- Node.js 14+
- npm 或 yarn
- Git (可选)

### 2. 安装和启动

**Windows (PowerShell 或 Git Bash):**

```bash
# 进入项目目录
cd D:\exam\server

# 安装依赖
npm install

# 启动服务
npm start
```

**Linux/macOS:**

```bash
# 进入项目目录
cd /home/openclaw/apps/server

# 安装依赖
npm install

# 启动服务
npm start
```

### 3. 访问系统

打开浏览器访问:
```
http://localhost:3000/admin/login.html
```

### 4. 默认账户

- **用户名**: admin
- **密码**: admin123

## 📁 项目结构

```
exam-system/
├── src/                          # 后端源代码
│   ├── routes/                   # API 路由
│   │   ├── auth.js              # 认证 API
│   │   ├── staff.js             # 人员管理 API
│   │   ├── task.js              # 工作任务 API
│   │   ├── settings.js          # 系统设置 API
│   │   ├── voting.js            # 投票系统 API
│   │   ├── meal.js              # 报餐系统 API
│   │   ├── import.js            # 考试导入 API
│   │   └── upload.js            # 文件上传 API
│   ├── models/
│   │   └── database.js          # 数据库连接
│   ├── utils/
│   │   └── auth.js              # 认证工具
│   └── index.js                 # 主入口
├── public/                       # 前端文件
│   ├── admin/
│   │   └── login.html           # 登录页
│   ├── dashboard.html           # 仪表板
│   ├── staff-list.html          # 员工列表
│   ├── staff-detail.html        # 员工详情
│   ├── task-list.html           # 任务列表
│   ├── task-detail.html         # 任务详情
│   ├── settings.html            # 系统设置
│   ├── exam-list.html           # 考试列表
│   ├── exam-doing.html          # 做题页面
│   ├── result.html              # 成绩结果
│   ├── voting-list.html         # 投票列表
│   ├── voting-detail.html       # 投票详情
│   ├── meal-list.html           # 报餐列表
│   └── meal-detail.html         # 报餐详情
├── data/                         # 数据库
│   ├── exam.db                  # SQLite 数据库
│   └── init.sql                 # 初始化脚本
├── package.json                 # 项目配置
├── .env                         # 环境变量
├── start.sh                     # 启动脚本
└── README.md                    # 本文件
```

## 🎯 核心功能

### 考试系统
- ✅ 创建和管理考试
- ✅ 在线答题
- ✅ 自动评分
- ✅ 成绩统计

### 投票系统
- ✅ 创建投票
- ✅ 单选/多选
- ✅ 实时统计
- ✅ 防重复投票

### 报餐系统
- ✅ 报餐管理
- ✅ 菜单管理
- ✅ 价格计算
- ✅ 统计分析

### 人员管理
- ✅ 员工信息
- ✅ 部门管理
- ✅ 职位管理
- ✅ 成绩查询

### 任务管理
- ✅ 任务分配
- ✅ 进度跟踪
- ✅ 完成管理
- ✅ 统计分析

### 系统设置
- ✅ 功能配置
- ✅ 公司信息
- ✅ 权限管理
- ✅ 参数设置

## 🔐 安全特性

- ✅ JWT 认证
- ✅ 密码加密（bcrypt）
- ✅ 权限控制
- ✅ 输入验证
- ✅ SQL 注入防护
- ✅ CORS 配置

## 📊 API 文档

### 认证 API

```
POST /api/auth/login
{
  "username": "admin",
  "password": "admin123"
}

响应:
{
  "code": 0,
  "msg": "登录成功",
  "data": {
    "token": "eyJhbGc...",
    "user": { ... }
  }
}
```

### 人员管理 API

```
GET /api/staff - 获取员工列表
GET /api/staff/:id - 获取员工详情
POST /api/staff - 添加员工
PUT /api/staff/:id - 编辑员工
DELETE /api/staff/:id - 删除员工
```

### 工作任务 API

```
GET /api/task - 获取任务列表
GET /api/task/:id - 获取任务详情
POST /api/task - 创建任务
PUT /api/task/:id - 编辑任务
POST /api/task/:id/complete - 完成任务
DELETE /api/task/:id - 删除任务
```

### 系统设置 API

```
GET /api/settings - 获取所有设置
PUT /api/settings - 更新设置
GET /api/settings/exam - 获取考试设置
GET /api/settings/meal - 获取报餐设置
```

## 🧪 测试

### 运行集成测试

```bash
bash test-integration.sh
```

## 🚀 生产部署

### Linux 部署

```bash
# 1. 克隆项目
git clone <repo-url> /home/openclaw/apps/server
cd /home/openclaw/apps/server

# 2. 安装依赖
npm install

# 3. 启动服务
npm start

# 或使用 PM2 管理进程
npm install -g pm2
pm2 start src/index.js --name "exam-system"
pm2 save
pm2 startup
```

### Nginx 反向代理

```nginx
server {
    listen 80;
    server_name example.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 🐛 常见问题

### Q: 如何重置密码？
A: 联系管理员重置密码。

### Q: 如何导出数据？
A: 在系统设置中选择"导出数据"。

### Q: 如何备份数据？
A: 定期备份 `data/exam.db` 文件。

### Q: 系统支持多少用户？
A: 系统可支持数千用户，具体取决于服务器配置。

## 📞 技术支持

如有问题，请查看文档或联系技术团队。

---

**版本**: 1.0.0
**最后更新**: 2026-03-25
**状态**: ✅ 生产就绪
