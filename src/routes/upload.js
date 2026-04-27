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
// 上传文件并导入题目到题库（支持文件上传或文本直接导入）
router.post('/upload', authMiddleware, adminMiddleware, upload.single('file'), async (req, res) => {
  try {
    let text = '';
    let paperId = req.body.paperId || '';
    const paperTitle = req.body.paperTitle;

    // 文件上传模式
    if (req.file) {
      const filePath = req.file.path;
      const ext = path.extname(req.file.originalname).toLowerCase();

      if (ext === '.txt') {
        text = fs.readFileSync(filePath, 'utf-8');
      } else if (ext === '.docx' || ext === '.doc') {
        try {
          if (ext === '.docx') {
            const result = await mammoth.extractRawText({ path: filePath });
            text = result.value;
          } else if (ext === '.doc') {
            const result = spawnSync('antiword', ['-m', 'UTF-8', filePath]);
            if (result.error) throw result.error;
            if (result.status !== 0) throw new Error(result.stderr ? result.stderr.toString() : 'antiword 解析失败');
            text = result.stdout.toString('utf-8');
          }
        } catch (err) {
          console.error('解析失败:', err);
          try { fs.unlinkSync(filePath); } catch(e) {}
          return res.status(400).json({ code: -1, msg: '解析文件失败：' + err.message, data: null });
        }
      }
      try { fs.unlinkSync(filePath); } catch(e) {}
    }
    // 文本直接上传模式
    else if (req.body.text) {
      text = req.body.text;
    }
    else {
      return res.status(400).json({ code: -1, msg: '请上传文件或输入题目文本', data: null });
    }

    if (!text.trim()) {
      return res.status(400).json({ code: -1, msg: '题目内容为空', data: null });
    }

    // 如果没有指定 paperId，但有 paperTitle，则创建新题库
    if (!paperId && paperTitle) {
      const result = db.prepare(`
        INSERT INTO exam_banks (title, description, created_by)
        VALUES (?, ?, ?)
      `).run(paperTitle, '', req.user.userId);
      paperId = result.lastInsertRowid;
    }

    if (!paperId) {
      return res.status(400).json({ code: -1, msg: '请指定题库ID', data: null });
    }

    // 验证题库存在
    const bank = db.prepare('SELECT id FROM exam_banks WHERE id = ?').get(paperId);
    if (!bank) {
      return res.status(400).json({ code: -1, msg: '题库不存在', data: null });
    }

    // 解析并导入题目
    const wordParser = require('../utils/wordParser');
    const parseResult = wordParser.parse(text);
    const questions = parseResult.questions;

    if (questions.length === 0) {
      return res.status(400).json({ code: -1, msg: '未识别到题目', data: null });
    }

    let successCount = 0;
    for (const q of questions) {
      try {
        db.prepare(
          `INSERT INTO questions (exam_id, type, content, options, answer, score, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).run(paperId, q.type, q.content, JSON.stringify(q.options), q.answer, q.score, q.sort_order || 0);
        successCount++;
      } catch (err) {
        console.error('插入题目失败:', err);
      }
    }

    res.json({
      code: 0,
      msg: '导入成功',
      data: { questionCount: successCount, paperId: paperId }
    });
  } catch (err) {
    console.error('导入失败:', err);
    res.status(500).json({ code: -1, msg: '导入失败：' + err.message, data: null });
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

    // 使用 ffprobe 提取视频时长
    let duration = null;
    try {
      const { spawnSync } = require('child_process');
      const ffprobeResult = spawnSync('ffprobe', [
        '-v', 'error',
        '-show_entries', 'format=duration',
        '-of', 'default=noprint_wrappers=1:nokey=1',
        finalFilePath
      ]);
      if (ffprobeResult.error) {
        console.error('ffprobe error:', ffprobeResult.error);
      } else {
        const durationStr = ffprobeResult.stdout.toString().trim();
        duration = parseInt(parseFloat(durationStr));
        if (isNaN(duration)) duration = null;
      }
    } catch (e) {
      console.error('提取视频时长失败:', e);
    }

    // 上传到移动云对象存储
    let fileUrl;
    try {
      const { uploadToCloud } = require('../utils/cloud-storage');
      fileUrl = await uploadToCloud(finalFilePath, req.file.originalname, 'learning/');
      console.log('文件已上传到移动云:', fileUrl);
    } catch (cloudErr) {
      console.error('上传到云存储失败，保留本地文件:', cloudErr.message);
      // 失败时使用本地路径
      fileUrl = `/uploads/learning/${finalFilename}`;
    }

    // 生成安全的显示文件名（只保留英文、数字、下划线）
    const safeOriginalName = req.file.originalname.replace(/[^\w\s.-]/g, '_');

    res.json({
      code: 0,
      msg: '文件上传成功',
      data: {
        file_url: fileUrl,
        filename: finalFilename,  // 服务器存储的文件名（UUID）
        original_name: safeOriginalName,  // 原始文件名的安全版本
        size: req.file.size,
        file_type: finalFileType,
        converted: false,  // 不再转换
        duration: duration,  // 视频时长（秒）
        storage: fileUrl.startsWith('http') ? 'cloud' : 'local'
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
