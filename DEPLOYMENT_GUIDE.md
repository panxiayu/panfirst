# 兴利汽车模具 - 考试报餐系统部署指南

## 📋 系统要求

- Node.js 14+ 
- SQLite3
- npm 或 yarn
- Linux/Windows/macOS

## 🚀 快速启动

### 1. 环境准备

```bash
# 克隆项目
cd D:\exam\server

# 安装依赖
npm install

# 或使用 yarn
yarn install
```

### 2. 数据库初始化

```bash
# 初始化考试系统数据库
sqlite3 data/exam.db < data/init-exam.sql

# 初始化投票和报餐系统数据库
sqlite3 data/exam.db < data/init-voting-meal.sql

# 初始化人员管理、任务、设置数据库
sqlite3 data/exam.db < data/init-staff-task-settings.sql
```

### 3. 启动服务

```bash
# 开发环境
npm start

# 生产环境
NODE_ENV=production npm start
```

服务将在 `http://localhost:3000` 启动

### 4. 访问系统

- **首页**: http://localhost:3000/dashboard.html
- **登录**: http://localhost:3000/admin/login.html
- **考试系统**: http://localhost:3000/exam-list.html
- **投票系统**: http://localhost:3000/voting-list.html
- **报餐系统**: http://localhost:3000/meal-list.html
- **人员管理**: http://localhost:3000/staff-list.html
- **任务管理**: http://localhost:3000/task-list.html
- **系统设置**: http://localhost:3000/settings.html

## 📁 项目结构

```
D:\exam\server/
├── src/
│   ├── index.js                 # 主入口
│   ├── routes/
│   │   ├── auth.js              # 认证 API
│   │   ├── import.js            # 考试导入 API
│   │   ├── upload.js            # 文件上传 API
│   │   ├── voting.js            # 投票系统 API
│   │   ├── meal.js              # 报餐系统 API
│   │   ├── staff.js             # 人员管理 API
│   │   ├── task.js              # 工作任务 API
│   │   └── settings.js          # 系统设置 API
│   ├── models/
│   │   └── database.js          # 数据库连接
│   └── utils/
│       └── auth.js              # 认证工具
├── data/
│   ├── exam.db                  # SQLite 数据库
│   ├── init-exam.sql            # 考试系统初始化
│   ├── init-voting-meal.sql     # 投票报餐初始化
│   └── init-staff-task-settings.sql # 人员任务设置初始化
├── public/
│   ├── index.html               # 首页
│   ├── dashboard.html           # 仪表板
│   ├── admin/
│   │   ├── login.html           # 登录页
│   │   └── panel.html           # 管理面板
│   ├── exam-list.html           # 考试列表
│   ├── exam-doing.html          # 做题页面
│   ├── result.html              # 成绩结果
│   ├── voting-list.html         # 投票列表
│   ├── voting-detail.html       # 投票详情
│   ├── meal-list.html           # 报餐列表
│   ├── meal-detail.html         # 报餐详情
│   ├── staff-list.html          # 员工列表
│   ├── staff-detail.html        # 员工详情
│   ├── task-list.html           # 任务列表
│   ├── task-detail.html         # 任务详情
│   ├── settings.html            # 系统设置
│   ├── css/
│   │   └── style.css            # 全局样式
│   └── js/
│       └── common.js            # 公共脚本
├── package.json
├── .env                         # 环境变量
└── README.md

```

## 🔐 默认账户

| 用户名 | 密码 | 角色 |
|--------|------|------|
| admin | admin123 | 管理员 |

## 🔧 环境变量配置

创建 `.env` 文件：

```env
# 服务器配置
PORT=3000
NODE_ENV=development

# 数据库配置
DB_PATH=./data/exam.db

# JWT 配置
JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=7d

# 文件上传配置
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760

# 日志配置
LOG_LEVEL=info
```

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
  "msg": "success",
  "data": {
    "token": "eyJhbGc...",
    "user": { ... }
  }
}
```

### 人员管理 API

```
GET /api/staff
GET /api/staff/:id
POST /api/staff
PUT /api/staff/:id
DELETE /api/staff/:id
```

### 工作任务 API

```
GET /api/task
GET /api/task/:id
POST /api/task
PUT /api/task/:id
POST /api/task/:id/complete
DELETE /api/task/:id
```

### 系统设置 API

```
GET /api/settings
PUT /api/settings
GET /api/settings/exam
GET /api/settings/meal
```

## 🧪 测试

### 运行集成测试

```bash
bash test-integration.sh
```

### 手动测试

1. 打开浏览器访问 http://localhost:3000
2. 使用默认账户登录
3. 测试各个功能模块

## 📈 性能优化

### 数据库优化
- ✅ 已创建索引
- ✅ 使用参数化查询
- ✅ 连接池配置

### 前端优化
- ✅ 静态文件缓存
- ✅ 代码压缩
- ✅ 响应式设计

### 后端优化
- ✅ 请求限流
- ✅ 错误处理
- ✅ 日志记录

## 🐛 常见问题

### Q: 数据库连接失败
A: 检查 `data/exam.db` 文件是否存在，如不存在运行初始化脚本

### Q: 登录失败
A: 确保已运行数据库初始化脚本，默认账户为 admin/admin123

### Q: 前端页面加载失败
A: 检查 `public/` 目录下的 HTML 文件是否存在

### Q: API 返回 401 错误
A: 检查 token 是否有效，可能需要重新登录

## 📝 日志

日志文件位置: `logs/app.log`

查看日志:
```bash
tail -f logs/app.log
```

## 🔄 更新和维护

### 备份数据库
```bash
cp data/exam.db data/exam.db.backup
```

### 恢复数据库
```bash
cp data/exam.db.backup data/exam.db
```

### 清空数据库
```bash
rm data/exam.db
npm run init-db
```

## 🚀 生产部署

### Docker 部署

```dockerfile
FROM node:14-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
```

### 构建和运行

```bash
docker build -t exam-system .
docker run -p 3000:3000 exam-system
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

## 📞 技术支持

如有问题，请联系技术团队。

---

**最后更新**: 2026-03-25
**版本**: 1.0.0
