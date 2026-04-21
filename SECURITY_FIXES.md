# 代码修复说明

## 修复内容

### 1. JWT 安全修复 ✅
- **问题**：手写 JWT 实现有 bug，签名计算错误
- **解决**：使用 `jsonwebtoken` 库
- **文件**：`src/utils/auth.js`
- **变化**：
  - 使用标准 JWT 库
  - 添加 token 过期时间 (7 天)
  - 修复签名算法

### 2. 密码安全修复 ✅
- **问题**：支持明文密码存储
- **解决**：使用 bcrypt 加密
- **文件**：`src/utils/auth.js`
- **变化**：
  - 添加 `hashPassword()` 函数
  - 添加 `verifyPassword()` 函数
  - 密码使用 bcrypt 加密存储

### 3. 速率限制 ✅
- **问题**：没有防止暴力破解
- **解决**：添加 express-rate-limit
- **文件**：`src/routes/auth.js`
- **变化**：
  - 登录端点限制：15 分钟内最多 5 次尝试
  - 管理员登录也受限制

### 4. 输入验证 ✅
- **问题**：没有验证输入数据
- **解决**：使用 Joi 库
- **文件**：`src/routes/auth.js`
- **变化**：
  - 验证 openid、username、password 格式
  - 返回清晰的错误消息

### 5. 环境变量管理 ✅
- **问题**：硬编码 secret key
- **解决**：使用 .env 文件
- **文件**：`.env`
- **变化**：
  - JWT_SECRET 从环境变量读取
  - 支持不同环境配置

## 安装步骤

### 在 Linux 上执行

```bash
cd /home/openclaw/apps/server

# 1. 拉取最新代码
git pull origin master

# 2. 安装新依赖
npm install

# 3. 配置环境变量
cp .env.example .env  # 如果有的话
# 或编辑 .env 文件，修改 JWT_SECRET

# 4. 重启服务
docker-compose down
docker-compose up -d

# 5. 查看日志
docker-compose logs -f
```

### 在 Windows 上执行

```bash
cd D:\exam\server

# 1. 替换文件
# - src/utils/auth.js (用 auth-fixed.js 替换)
# - src/routes/auth.js (用 auth-fixed.js 替换)

# 2. 提交代码
git add .
git commit -m "安全修复：JWT、密码加密、速率限制、输入验证"

# 3. 推送到 Linux
git push origin master

# 4. Linux 自动部署
```

## 文件对应关系

| 原文件 | 修复文件 | 说明 |
|--------|---------|------|
| src/utils/auth.js | src/utils/auth-fixed.js | JWT + 密码加密 |
| src/routes/auth.js | src/routes/auth-fixed.js | 速率限制 + 输入验证 |
| package.json | (已修改) | 添加新依赖 |
| (新建) | .env | 环境变量配置 |

## 测试

### 测试登录速率限制

```bash
# 快速发送 6 个登录请求，第 6 个应该被限制
for i in {1..6}; do
  curl -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"openid":"test"}'
done
```

### 测试密码验证

```bash
# 创建管理员用户（需要先在数据库中创建）
# 然后测试登录
curl -X POST http://localhost:3000/api/auth/admin-login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password123"}'
```

### 测试 Token 过期

```bash
# 生成的 token 7 天后过期
# 可以修改 auth.js 中的 expiresIn 来测试
```

## 下一步

1. ✅ 在 Windows 上替换文件
2. ✅ git push 到 Linux
3. ✅ Linux 自动部署
4. ✅ 测试 API
5. ⏳ 完成其他页面开发

## 注意事项

- **JWT_SECRET**：生产环境必须修改，不要使用默认值
- **bcrypt**：密码加密需要时间，不要在循环中使用
- **速率限制**：可根据需要调整 windowMs 和 max 参数
- **环境变量**：.env 文件不要提交到 Git（添加到 .gitignore）
