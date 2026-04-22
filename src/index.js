// src/index.js
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

// 导入路由
const authRoutes = require('./routes/auth');
const importRoutes = require('./routes/import');
const uploadRoutes = require('./routes/upload');
const votingRoutes = require('./routes/voting');
const mealRoutes = require('./routes/meal');
const staffRoutes = require('./routes/staff');
const taskRoutes = require('./routes/task');
const learningMaterialRoutes = require('./routes/learning-material');
const settingsRoutes = require('./routes/settings');
const templatesRoutes = require('./routes/templates');
const adminRoutes = require('./routes/admin');
const examRoutes = require('./routes/exam');
const examAdminRoutes = require('./routes/exam-admin');
const permissionsRoutes = require('./routes/permissions');
const sixSRoutes = require('./routes/6s');
const homeworkTimerRoutes = require('./routes/homework-timer');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors({
  origin: [
    'http://112.16.178.98',
    'https://112.16.178.98',
    'http://112.16.178.98:3000',
    'https://112.16.178.98:3000'
  ],
  credentials: true
}));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// 静态文件服务（托管 H5 前端） - 禁用默认 index.html
const publicPath = path.join(__dirname, '../public');
app.use(express.static(publicPath, { index: false }));

// 上傳文件服务
const uploadsPath = path.join(__dirname, '../uploads');
app.use('/uploads', express.static(uploadsPath));

// 根路径：返回 index.html（考生入口）
app.get('/', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

// API 路由 (特定路由必须在通配符路由之前注册)
app.use('/api/auth', authRoutes);
app.use('/api/voting', votingRoutes); // 投票系统
app.use('/api/meal', mealRoutes); // 报餐系统
app.use('/api/staff', staffRoutes); // 人员管理
app.use('/api/task', taskRoutes); // 工作任务
app.use('/api/learning-materials', learningMaterialRoutes); // 学习资料
app.use('/api/settings', settingsRoutes); // 系统设置
app.use('/api/templates', templatesRoutes); // 模板下载
app.use('/api/admin', adminRoutes); // 管理员管理
app.use('/api/admin/permissions', permissionsRoutes); // 权限管理
app.use('/api/permissions', require('./routes/granular-permissions')); // 粒化权限管理
app.use('/api/exam', examRoutes); // 考试相关 API
app.use('/api/exam-admin', examAdminRoutes); // 考试管理后台 API
app.use('/api/import', uploadRoutes); // upload 路由
app.use('/api/files', require('./routes/file-manager')); // 文件管理
app.use('/api/6s', sixSRoutes); // 6S曝光管理
app.use('/api/homework-timer', homeworkTimerRoutes); // 作业计时器
app.use('/api', importRoutes); // import 通配符路由（必须在最后）

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 处理
app.use((req, res) => {
  res.status(404).json({
    code: -1,
    msg: '接口不存在',
    data: null
  });
});

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({
    code: -1,
    msg: '服务器内部错误',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`🚀 考试系统 API 服务已启动`);
  console.log(`📍 服务地址: http://localhost:${PORT}`);
  console.log(`📝 API 文档: http://localhost:${PORT}/health`);
  console.log(`🔧 环境: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
