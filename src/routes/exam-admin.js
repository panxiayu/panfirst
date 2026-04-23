// src/routes/exam-admin.js - 考试管理后台 API
const express = require('express');
const router = express.Router();
const db = require('../models/database');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// 配置 multer 存储
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/exam');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

// 确保 source_exam_id 列存在（如果不存在则添加）
try {
  const columns = db.prepare("PRAGMA table_info(exams)").all();
  const hasSourceExamId = columns.some(col => col.name === 'source_exam_id');
  if (!hasSourceExamId) {
    db.exec("ALTER TABLE exams ADD COLUMN source_exam_id INTEGER REFERENCES exams(id)");
    console.log('✅ 已添加 source_exam_id 列到 exams 表');
  }
} catch (err) {
  console.error('⚠️ 检查/添加 source_exam_id 列失败:', err.message);
}

// ============ 试卷管理 API ============

// GET /api/exam-admin/papers - 获取所有试卷
router.get('/papers', authMiddleware, adminMiddleware, (req, res) => {
  try {
    const papers = db.prepare(`
      SELECT e.*, u.nickname as creator_name,
        (SELECT COUNT(*) FROM questions WHERE exam_id = COALESCE(e.source_exam_id, e.id)) as question_count,
        (SELECT COALESCE(SUM(score), 0) FROM questions WHERE exam_id = COALESCE(e.source_exam_id, e.id)) as total_score
      FROM exams e
      LEFT JOIN users u ON e.created_by = u.id
      GROUP BY e.id
      ORDER BY e.created_at DESC
    `).all();

    res.json({ code: 0, msg: 'success', data: papers });
  } catch (err) {
    console.error('获取试卷列表失败:', err);
    res.status(500).json({ code: -1, msg: '服务器错误', data: null });
  }
});

// GET /api/exam-admin/paper/:id - 获取试卷详情
router.get('/paper/:id', authMiddleware, adminMiddleware, (req, res) => {
  try {
    const exam = db.prepare('SELECT * FROM exams WHERE id = ?').get(req.params.id);
    if (!exam) {
      return res.status(404).json({ code: -1, msg: '试卷不存在', data: null });
    }

    // 如果有 source_exam_id，从源考试获取题目
    const actualExamId = exam.source_exam_id || exam.id;

    const questions = db.prepare(`
      SELECT * FROM questions WHERE exam_id = ? ORDER BY sort_order ASC, id ASC
    `).all(actualExamId);

    res.json({ code: 0, msg: 'success', data: { exam, questions } });
  } catch (err) {
    console.error('获取试卷详情失败:', err);
    res.status(500).json({ code: -1, msg: '服务器错误', data: null });
  }
});

// POST /api/exam-admin/paper - 创建试卷
router.post('/paper', authMiddleware, adminMiddleware, (req, res) => {
  try {
    const { title, description, duration, pass_score, is_active, learning_task_id, source_exam_id } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ code: -1, msg: '试卷标题不能为空', data: null });
    }

    // 如果启用了学习任务但学习任务已过期，提示错误
    if (is_active && learning_task_id) {
      const task = db.prepare('SELECT * FROM learning_tasks WHERE id = ?').get(learning_task_id);
      if (!task) {
        return res.status(400).json({ code: -1, msg: '学习任务不存在', data: null });
      }
      if (task.end_time) {
        const now = new Date();
        const endTime = new Date(task.end_time);
        if (now > endTime) {
          return res.status(400).json({ code: -1, msg: '学习任务已到期，无法启用', data: null });
        }
      }
    }

    // 如果选择了已有题库（source_exam_id），直接复用不创建新试卷
    // 只有创建新题库时才需要复制题目
    const result = db.prepare(`
      INSERT INTO exams (title, description, duration, pass_score, is_active, learning_task_id, created_by, source_exam_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      title.trim(),
      description || '',
      duration || 60,
      pass_score || 60,
      is_active ? 1 : 0, // 默认停止状态
      learning_task_id || null,
      req.user.userId,
      source_exam_id || null
    );

    const exam = db.prepare('SELECT * FROM exams WHERE id = ?').get(result.lastInsertRowid);
    res.json({ code: 0, msg: '试卷创建成功', data: exam });
  } catch (err) {
    console.error('创建试卷失败:', err);
    res.status(500).json({ code: -1, msg: '服务器错误', data: null });
  }
});

// PUT /api/exam-admin/paper/:id - 更新试卷
router.put('/paper/:id', authMiddleware, adminMiddleware, (req, res) => {
  try {
    const { title, description, duration, pass_score, is_active, learning_task_id } = req.body;

    const exam = db.prepare('SELECT * FROM exams WHERE id = ?').get(req.params.id);
    if (!exam) {
      return res.status(404).json({ code: -1, msg: '试卷不存在', data: null });
    }

    // 如果启用了学习任务但学习任务已过期，提示错误
    if (is_active && learning_task_id) {
      const task = db.prepare('SELECT * FROM learning_tasks WHERE id = ?').get(learning_task_id);
      if (!task) {
        return res.status(400).json({ code: -1, msg: '学习任务不存在', data: null });
      }
      if (task.end_time) {
        const now = new Date();
        const endTime = new Date(task.end_time);
        if (now > endTime) {
          return res.status(400).json({ code: -1, msg: '学习任务已到期，无法启用', data: null });
        }
      }
    }

    db.prepare(`
      UPDATE exams SET title = ?, description = ?, duration = ?, pass_score = ?, is_active = ?, learning_task_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      title || exam.title,
      description !== undefined ? description : exam.description,
      duration !== undefined ? duration : exam.duration,
      pass_score !== undefined ? pass_score : exam.pass_score,
      is_active !== undefined ? (is_active ? 1 : 0) : exam.is_active,
      learning_task_id !== undefined ? learning_task_id : exam.learning_task_id,
      req.params.id
    );

    const updated = db.prepare('SELECT * FROM exams WHERE id = ?').get(req.params.id);
    res.json({ code: 0, msg: '试卷更新成功', data: updated });
  } catch (err) {
    console.error('更新试卷失败:', err);
    res.status(500).json({ code: -1, msg: '服务器错误', data: null });
  }
});

// DELETE /api/exam-admin/paper/:id - 删除试卷
router.delete('/paper/:id', authMiddleware, adminMiddleware, (req, res) => {
  try {
    const examId = req.params.id;
    const exam = db.prepare('SELECT * FROM exams WHERE id = ?').get(examId);
    if (!exam) {
      return res.status(404).json({ code: -1, msg: '试卷不存在', data: null });
    }

    // 临时禁用外键检查
    db.pragma('foreign_keys = OFF');

    db.prepare('DELETE FROM questions WHERE exam_id = ?').run(examId);
    db.prepare('DELETE FROM exam_records WHERE exam_id = ?').run(examId);
    db.prepare('DELETE FROM exam_permissions WHERE exam_id = ?').run(examId);
    db.prepare('DELETE FROM exams WHERE id = ?').run(examId);

    // 恢复外键检查
    db.pragma('foreign_keys = ON');

    res.json({ code: 0, msg: '试卷删除成功', data: { id: examId } });
  } catch (err) {
    db.pragma('foreign_keys = ON');
    console.error('删除试卷失败:', err);
    res.status(500).json({ code: -1, msg: '服务器错误', data: null });
  }
});

// ============ 题库管理 API ============

// GET /api/exam-admin/questions - 获取所有题目（可选按试卷筛选）
router.get('/questions', authMiddleware, adminMiddleware, (req, res) => {
  try {
    const { exam_id } = req.query;
    
    let query = `
      SELECT q.*, e.title as exam_title
      FROM questions q
      LEFT JOIN exams e ON q.exam_id = e.id
    `;
    const params = [];
    
    if (exam_id) {
      query += ' WHERE q.exam_id = ?';
      params.push(exam_id);
    }
    
    query += ' ORDER BY q.exam_id, q.sort_order ASC, q.id ASC';
    
    const questions = db.prepare(query).all(...params);
    res.json({ code: 0, msg: 'success', data: questions });
  } catch (err) {
    console.error('获取题目列表失败:', err);
    res.status(500).json({ code: -1, msg: '服务器错误', data: null });
  }
});

// POST /api/exam-admin/question - 添加题目
router.post('/question', authMiddleware, adminMiddleware, (req, res) => {
  try {
    const { exam_id, type, content, options, answer, score } = req.body;

    if (!exam_id) {
      return res.status(400).json({ code: -1, msg: '请选择所属试卷', data: null });
    }
    if (!content || !content.trim()) {
      return res.status(400).json({ code: -1, msg: '题目内容不能为空', data: null });
    }
    if (!type) {
      return res.status(400).json({ code: -1, msg: '请选择题目类型', data: null });
    }

    const exam = db.prepare('SELECT * FROM exams WHERE id = ?').get(exam_id);
    if (!exam) {
      return res.status(404).json({ code: -1, msg: '试卷不存在', data: null });
    }

    const result = db.prepare(`
      INSERT INTO questions (exam_id, type, content, options, answer, score, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      exam_id,
      type,
      content.trim(),
      options ? JSON.stringify(options) : null,
      answer || '',
      score || 5,
      0
    );

    const question = db.prepare('SELECT * FROM questions WHERE id = ?').get(result.lastInsertRowid);
    res.json({ code: 0, msg: '题目添加成功', data: question });
  } catch (err) {
    console.error('添加题目失败:', err);
    res.status(500).json({ code: -1, msg: '服务器错误', data: null });
  }
});

// PUT /api/exam-admin/question/:id - 更新题目
router.put('/question/:id', authMiddleware, adminMiddleware, (req, res) => {
  try {
    const { type, content, options, answer, score } = req.body;

    const question = db.prepare('SELECT * FROM questions WHERE id = ?').get(req.params.id);
    if (!question) {
      return res.status(404).json({ code: -1, msg: '题目不存在', data: null });
    }

    db.prepare(`
      UPDATE questions SET type = ?, content = ?, options = ?, answer = ?, score = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      type !== undefined ? type : question.type,
      content !== undefined ? content : question.content,
      options !== undefined ? JSON.stringify(options) : question.options,
      answer !== undefined ? answer : question.answer,
      score !== undefined ? score : question.score,
      req.params.id
    );

    const updated = db.prepare('SELECT * FROM questions WHERE id = ?').get(req.params.id);
    res.json({ code: 0, msg: '题目更新成功', data: updated });
  } catch (err) {
    console.error('更新题目失败:', err);
    res.status(500).json({ code: -1, msg: '服务器错误', data: null });
  }
});

// DELETE /api/exam-admin/question/:id - 删除题目
router.delete('/question/:id', authMiddleware, adminMiddleware, (req, res) => {
  try {
    const question = db.prepare('SELECT * FROM questions WHERE id = ?').get(req.params.id);
    if (!question) {
      return res.status(404).json({ code: -1, msg: '题目不存在', data: null });
    }

    db.prepare('DELETE FROM questions WHERE id = ?').run(req.params.id);
    res.json({ code: 0, msg: '题目删除成功', data: { id: req.params.id } });
  } catch (err) {
    console.error('删除题目失败:', err);
    res.status(500).json({ code: -1, msg: '服务器错误', data: null });
  }
});

// ============ 成绩管理 API ============

// GET /api/exam-admin/records - 获取所有成绩记录
router.get('/records', authMiddleware, adminMiddleware, (req, res) => {
  try {
    const { exam_id, user_id } = req.query;

    let query = `
      SELECT er.*, e.title as exam_title, e.duration, e.pass_score,
             u.nickname, u.username,
             s.name as staff_name, s.employee_id as staff_employee_id, s.department as staff_department
      FROM exam_records er
      JOIN exams e ON er.exam_id = e.id
      LEFT JOIN users u ON er.user_id = u.id AND er.staff_id IS NULL
      LEFT JOIN staff s ON er.staff_id = s.id
    `;
    const params = [];

    if (exam_id) {
      query += ' WHERE er.exam_id = ?';
      params.push(exam_id);
    }

    if (user_id) {
      query += params.length ? ' AND (er.user_id = ? OR er.staff_id = ?)' : ' WHERE er.user_id = ? OR er.staff_id = ?';
      params.push(user_id, user_id);
    }

    query += ' ORDER BY er.submitted_at DESC';

    const records = db.prepare(query).all(...params);

    const formatted = records.map(r => ({
      id: r.id,
      exam_id: r.exam_id,
      exam_title: r.exam_title,
      user_id: r.user_id,
      staff_id: r.staff_id,
      nickname: r.nickname || r.staff_name || '未知',
      openid: r.openid ? r.openid.substring(0, 15) + '...' : '',
      employee_id: r.staff_employee_id || '',
      department: r.staff_department || '',
      total_score: r.total_score,
      is_passed: r.is_passed,
      submitted_at: r.submitted_at,
      duration: r.duration,
      pass_score: r.pass_score
    }));

    res.json({ code: 0, msg: 'success', data: formatted });
  } catch (err) {
    console.error('获取成绩列表失败:', err);
    res.status(500).json({ code: -1, msg: '服务器错误', data: null });
  }
});

// GET /api/exam-admin/record/:id - 获取成绩详情
router.get('/record/:id', authMiddleware, adminMiddleware, (req, res) => {
  try {
    const record = db.prepare(`
      SELECT er.*, e.title as exam_title, e.duration as exam_duration, e.pass_score,
             u.nickname, u.username,
             s.name as staff_name, s.employee_id as staff_employee_id, s.department as staff_department
      FROM exam_records er
      JOIN exams e ON er.exam_id = e.id
      LEFT JOIN users u ON er.user_id = u.id AND er.staff_id IS NULL
      LEFT JOIN staff s ON er.staff_id = s.id
      WHERE er.id = ?
    `).get(req.params.id);

    if (!record) {
      return res.status(404).json({ code: -1, msg: '成绩记录不存在', data: null });
    }

    const questions = db.prepare('SELECT * FROM questions WHERE exam_id = ?').all(record.exam_id);
    const userAnswers = JSON.parse(record.answers || '{}');

    const detailedAnswers = questions.map(q => {
      const userAnswer = userAnswers[q.id.toString()] || userAnswers[q.id] || '';
      let isCorrect = false;

      if (q.type === 'multiple_choice') {
        const correct = (q.answer || '').split(',').sort().join(',');
        const user = String(userAnswer).split(',').sort().join(',');
        isCorrect = correct === user;
      } else {
        isCorrect = String(q.answer) === String(userAnswer);
      }

      return {
        id: q.id,
        type: q.type,
        content: q.content,
        options: q.options ? JSON.parse(q.options) : [],
        correct_answer: q.answer,
        user_answer: userAnswer,
        is_correct: isCorrect,
        score: isCorrect ? q.score : 0,
        max_score: q.score
      };
    });

    res.json({
      code: 0, msg: 'success',
      data: {
        record: {
          id: record.id,
          exam_id: record.exam_id,
          exam_title: record.exam_title,
          exam_duration: record.exam_duration,
          user_id: record.user_id,
          nickname: record.nickname,
          openid: record.openid,
          total_score: record.total_score,
          is_passed: record.is_passed,
          submitted_at: record.submitted_at,
          pass_score: record.pass_score
        },
        answers: detailedAnswers
      }
    });
  } catch (err) {
    console.error('获取成绩详情失败:', err);
    res.status(500).json({ code: -1, msg: '服务器错误', data: null });
  }
});

// DELETE /api/exam-admin/record/:id - 删除成绩记录
router.delete('/record/:id', authMiddleware, adminMiddleware, (req, res) => {
  try {
    const record = db.prepare('SELECT * FROM exam_records WHERE id = ?').get(req.params.id);
    if (!record) {
      return res.status(404).json({ code: -1, msg: '成绩记录不存在', data: null });
    }

    db.prepare('DELETE FROM exam_records WHERE id = ?').run(req.params.id);
    res.json({ code: 0, msg: '删除成功', data: { id: req.params.id } });
  } catch (err) {
    console.error('删除成绩记录失败:', err);
    res.status(500).json({ code: -1, msg: '服务器错误', data: null });
  }
});

// GET /api/exam-admin/stats - 获取统计信息
router.get('/stats', authMiddleware, adminMiddleware, (req, res) => {
  try {
    const { exam_id } = req.query;

    let whereClause = '';
    const params = [];
    if (exam_id) {
      whereClause = ' WHERE er.exam_id = ?';
      params.push(exam_id);
    }

    // 基本统计
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as total_records,
        SUM(CASE WHEN er.is_passed = 1 THEN 1 ELSE 0 END) as passed_count,
        AVG(er.total_score) as avg_score,
        MAX(er.total_score) as max_score,
        MIN(er.total_score) as min_score
      FROM exam_records er
      ${whereClause}
    `).get(...params);

    // 各试卷统计
    const examStats = db.prepare(`
      SELECT e.id, e.title, e.duration, e.pass_score,
        COUNT(er.id) as record_count,
        SUM(CASE WHEN er.is_passed = 1 THEN 1 ELSE 0 END) as passed_count,
        AVG(er.total_score) as avg_score
      FROM exams e
      LEFT JOIN exam_records er ON e.id = er.exam_id
      GROUP BY e.id
      ORDER BY e.created_at DESC
    `).all();

    res.json({
      code: 0, msg: 'success',
      data: {
        overall: stats,
        byExam: examStats
      }
    });
  } catch (err) {
    console.error('获取统计信息失败:', err);
    res.status(500).json({ code: -1, msg: '服务器错误', data: null });
  }
});

// POST /api/exam-admin/paper/:id/copy-questions - 复制题目到目标考试
router.post('/paper/:id/copy-questions', authMiddleware, adminMiddleware, (req, res) => {
  try {
    const sourceExamId = parseInt(req.params.id);
    const { targetExamId } = req.body;

    if (!targetExamId) {
      return res.status(400).json({ code: -1, msg: '目标考试ID不能为空', data: null });
    }

    // 获取源考试的题目
    const questions = db.prepare('SELECT * FROM questions WHERE exam_id = ?').all(sourceExamId);

    if (questions.length === 0) {
      return res.json({ code: 0, msg: '源考试无题目', data: { count: 0 } });
    }

    // 批量插入到目标考试
    const insertStmt = db.prepare(`
      INSERT INTO questions (exam_id, type, content, options, answer, score, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    let count = 0;
    for (const q of questions) {
      insertStmt.run(
        targetExamId,
        q.type,
        q.content,
        q.options,
        q.answer,
        q.score,
        q.sort_order
      );
      count++;
    }

    res.json({ code: 0, msg: '题目复制成功', data: { count } });
  } catch (err) {
    console.error('复制题目失败:', err);
    res.status(500).json({ code: -1, msg: '服务器错误', data: null });
  }
});

// POST /api/exam-admin/import-participants - 导入考试人员
router.post('/import-participants', authMiddleware, adminMiddleware, upload.single('file'), (req, res) => {
  try {
    // 获取上传的文件
    if (!req.file) {
      return res.status(400).json({ code: -1, msg: '请上传文件', data: null });
    }

    const { examId } = req.body;
    if (!examId) {
      return res.status(400).json({ code: -1, msg: '考试ID不能为空', data: null });
    }

    // 解析 Excel 文件
    const XLSX = require('xlsx');
    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    // 删除临时文件
    require('fs').unlinkSync(req.file.path);

    // 期望格式：第一列是工号 (employee_id)
    const insertStmt = db.prepare(`
      INSERT OR IGNORE INTO exam_permissions (exam_id, staff_id, can_take)
      SELECT ?, s.id, 1 FROM staff s WHERE s.employee_id = ?
    `);

    let count = 0;
    for (let i = 1; i < data.length; i++) { // 跳过表头
      const row = data[i];
      if (row && row[0]) {
        const employeeId = String(row[0]).trim();
        if (employeeId) {
          insertStmt.run(examId, employeeId);
          count++;
        }
      }
    }

    res.json({ code: 0, msg: '导入成功', data: { count } });
  } catch (err) {
    console.error('导入人员失败:', err);
    res.status(500).json({ code: -1, msg: '服务器错误', data: null });
  }
});

// GET /api/exam-admin/paper/:id/permissions - 获取考试人员权限
router.get('/paper/:id/permissions', authMiddleware, adminMiddleware, (req, res) => {
  try {
    const examId = req.params.id;

    const permissions = db.prepare(`
      SELECT ep.*, s.name, s.employee_id
      FROM exam_permissions ep
      LEFT JOIN staff s ON ep.staff_id = s.id
      WHERE ep.exam_id = ?
    `).all(examId);

    res.json({ code: 0, msg: 'success', data: permissions });
  } catch (err) {
    console.error('获取考试权限失败:', err);
    res.status(500).json({ code: -1, msg: '服务器错误', data: null });
  }
});

module.exports = router;
