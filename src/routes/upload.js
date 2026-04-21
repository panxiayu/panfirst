// src/routes/upload.js - 文件上传相关接口
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const mammoth = require('mammoth');
const { spawnSync } = require('child_process');
const db = require('../models/database');

// 配置 multer 存储
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.txt' || ext === '.docx' || ext === '.doc') {
      cb(null, true);
    } else {
      cb(new Error('只支持 .txt, .docx, .doc 文件'));
    }
  }
});

// 学习任务文件上传配置
const learningStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/learning');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});

const learningUpload = multer({
  storage: learningStorage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.ppt' || ext === '.pptx' || ext === '.mp4') {
      cb(null, true);
    } else {
      cb(new Error('只支持 .ppt, .pptx, .mp4 文件'));
    }
  }
});

const { authMiddleware, adminMiddleware } = require('../middleware/auth');

// POST /api/import/upload
// 上传文件并提取文本内容
router.post('/upload', authMiddleware, adminMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        code: -1,
        msg: '未上传文件',
        data: null
      });
    }

    const filePath = req.file.path;
    const ext = path.extname(req.file.originalname).toLowerCase();
    let text = '';

    if (ext === '.txt') {
      text = fs.readFileSync(filePath, 'utf-8');
    } else if (ext === '.docx' || ext === '.doc') {
      try {
        if (ext === '.docx') {
          const result = await mammoth.extractRawText({ path: filePath });
          text = result.value;
        } else if (ext === '.doc') {
          // 使用 antiword 解析 .doc 文件
          const result = spawnSync('antiword', ['-m', 'UTF-8', filePath]);
          if (result.error) {
            throw result.error;
          }
          if (result.status !== 0) {
            throw new Error(result.stderr ? result.stderr.toString() : 'antiword 解析失败');
          }
          text = result.stdout.toString('utf-8');
        }
      } catch (err) {
        console.error('解析失败:', err);
        return res.status(400).json({
          code: -1,
          msg: '解析文件失败：' + err.message,
          data: null
        });
      }
    }

    fs.unlinkSync(filePath);

    res.json({
      code: 0,
      msg: '文件解析成功',
      data: {
        text,
        filename: req.file.originalname,
        size: req.file.size
      }
    });
  } catch (err) {
    console.error('文件上传失败:', err);
    res.status(500).json({
      code: -1,
      msg: '文件上传失败：' + err.message,
      data: null
    });
  }
});

// POST /api/learning/upload
// 上传学习任务文件（PPT/MP4），自动转换PPT为MP4
router.post('/learning/upload', authMiddleware, adminMiddleware, learningUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        code: -1,
        msg: '未上传文件',
        data: null
      });
    }

    const filePath = req.file.path;
    const ext = path.extname(req.file.originalname).toLowerCase();
    // 只支持 MP4 文件，不再转换 PPT
    let finalFileType = 'mp4';
    let finalFilePath = filePath;
    let finalFilename = req.file.filename;

    // 不再支持 PPT 转换，只接受 MP4 文件
    if (ext === '.ppt' || ext === '.pptx') {
      // 删除上传的 PPT 文件
      fs.unlinkSync(filePath);
      return res.status(400).json({
        code: -1,
        msg: '请上传 MP4 格式视频文件，PPT 转换功能已停用',
        data: null
      });
    }

    const fileUrl = `/uploads/learning/${finalFilename}`;
    const fileStats = fs.statSync(finalFilePath);

    // 生成安全的显示文件名（只保留英文、数字、下划线）
    const safeOriginalName = req.file.originalname.replace(/[^\w\s.-]/g, '_');
    
    res.json({
      code: 0,
      msg: '文件上传成功',
      data: {
        file_url: fileUrl,
        filename: finalFilename,  // 服务器存储的文件名（UUID）
        original_name: safeOriginalName,  // 原始文件名的安全版本
        size: fileStats.size,
        file_type: finalFileType,
        converted: false  // 不再转换
      }
    });
  } catch (err) {
    console.error('学习任务文件上传失败:', err);
    res.status(500).json({
      code: -1,
      msg: '文件上传失败：' + err.message,
      data: null
    });
  }
});

// Multer 错误处理中间件
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        code: -1,
        msg: '文件太大，最大支持 100MB',
        data: null
      });
    }
    return res.status(400).json({
      code: -1,
      msg: '文件上传失败：' + err.message,
      data: null
    });
  } else if (err) {
    return res.status(400).json({
      code: -1,
      msg: err.message,
      data: null
    });
  }
  next();
});

module.exports = router;
