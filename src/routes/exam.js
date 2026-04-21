// src/routes/exam.js - 考试相关 API
const express = require('express');
const router = express.Router();
const db = require('../models/database');
const { verifyToken } = require('../utils/auth');

// 初始化 exam_records 扩展字段
try {
  db.prepare("ALTER TABLE exam_records ADD COLUMN staff_id INTEGER REFERENCES staff(id)").run();
} catch (e) {}
try {
  db.prepare("ALTER TABLE exam_records ADD COLUMN correct_count INTEGER DEFAULT 0").run();
} catch (e) {}

// ============ 中间件 ============

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ code: -1, msg: '请先登录', data: null });
  }

  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ code: -1, msg: 'token 无效', data: null });
  }

  req.user = payload;
  next();
}

// 检查考试权限（只使用粒化权限）
function examPermissionMiddleware(req, res, next) {
  // 管理员拥有所有权限
  if (req.user.can_manage_exam === 1 || req.user.role === 'admin') {
    return next();
  }

  // 员工检查粒化权限
  if (req.user.type === 'employee') {
    const granularPerm = db.prepare(`
      SELECT COUNT(*) as cnt FROM exam_permissions ep
      WHERE ep.staff_id = ? AND ep.can_take = 1
    `).get(req.user.id);

    if (granularPerm && granularPerm.cnt > 0) {
      return next();
    }
  }

  return res.status(403).json({ code: -1, msg: '您没有考试权限', data: null });
}

// 获取用户ID（兼容员工和管理员）
function getUserId(req) {
  return req.user.type === 'employee' ? req.user.id : req.user.userId;
}

// ============ 考生 API ============

// GET /api/exam/list - 获取可用考试列表
router.get('/list', authMiddleware, examPermissionMiddleware, (req, res) => {
  try {
    const userId = getUserId(req);

    // 获取已激活的考试
    const exams = db.prepare(`
      SELECT e.*,
        COUNT(q.id) as question_count,
        COALESCE(SUM(q.score), 0) as total_score
      FROM exams e
      LEFT JOIN questions q ON e.id = q.exam_id
      WHERE e.is_active = 1
      GROUP BY e.id
      ORDER BY e.created_at DESC
    `).all();

    // 获取用户已完成的考试记录
    const completedRecords = db.prepare(`
      SELECT exam_id, MAX(submitted_at) as last_submit_at, total_score, is_passed
      FROM exam_records
      WHERE user_id = ? AND submitted_at IS NOT NULL
      GROUP BY exam_id
    `).all(userId);

    const completedMap = {};
    completedRecords.forEach(r => {
      completedMap[r.exam_id] = r;
    });

    const now = new Date();
    const formattedExams = exams.map(exam => {
      let isAvailable = true;
      let unavailableReason = '';

      // 检查学习任务是否过期
      if (exam.learning_task_id) {
        const task = db.prepare('SELECT * FROM learning_tasks WHERE id = ?').get(exam.learning_task_id);
        if (!task) {
          isAvailable = false;
          unavailableReason = '学习任务不存在';
        } else if (task.end_time) {
          const endTime = new Date(task.end_time);
          if (now > endTime) {
            isAvailable = false;
            unavailableReason = '学习任务已到期';
          }
        }
      }

      return {
        id: exam.id,
        title: exam.title,
        description: exam.description,
        duration: exam.duration,
        pass_score: exam.pass_score,
        total_score: exam.total_score,
        question_count: exam.question_count,
        created_at: exam.created_at,
        completed: !!completedMap[exam.id],
        last_score: completedMap[exam.id]?.total_score,
        is_passed: completedMap[exam.id]?.is_passed,
        last_submit_at: completedMap[exam.id]?.last_submit_at,
        learning_task_id: exam.learning_task_id,
        is_available: isAvailable,
        unavailable_reason: unavailableReason
      };
    });

    res.json({ code: 0, msg: 'success', data: formattedExams });
  } catch (err) {
    console.error('获取考试列表失败:', err);
    res.status(500).json({ code: -1, msg: '服务器错误', data: null });
  }
});

// GET /api/exam/:id - 获取考试详情
router.get('/:id', authMiddleware, examPermissionMiddleware, (req, res) => {
  try {
    const examId = req.params.id;
    const exam = db.prepare('SELECT * FROM exams WHERE id = ? AND is_active = 1').get(examId);

    if (!exam) {
      return res.status(404).json({ code: -1, msg: '考试不存在或未激活', data: null });
    }

    // 如果有 source_exam_id，从源考试获取题目（复用题库）
    const actualExamId = exam.source_exam_id || examId;

    const questions = db.prepare(`
      SELECT id, type, content, options, score, sort_order
      FROM questions WHERE exam_id = ? ORDER BY sort_order ASC, id ASC
    `).all(actualExamId);

    const formattedQuestions = questions.map(q => ({
      _id: q.id.toString(),
      type: q.type,
      content: q.content,
      options: q.options ? JSON.parse(q.options) : null,
      score: q.score,
      sort_order: q.sort_order
      // 注意：考试时不应该返回正确答案
    }));

    res.json({ code: 0, msg: 'success', data: { exam, questions: formattedQuestions } });
  } catch (err) {
    console.error('获取考试失败:', err);
    res.status(500).json({ code: -1, msg: '服务器错误', data: null });
  }
});

// POST /api/exam/start - 开始考试
router.post('/start', authMiddleware, examPermissionMiddleware, (req, res) => {
  try {
    const { examId } = req.body;
    const userId = getUserId(req);

    if (!examId) {
      return res.status(400).json({ code: -1, msg: '缺少 examId', data: null });
    }

    const exam = db.prepare('SELECT * FROM exams WHERE id = ?').get(examId);
    if (!exam) {
      return res.status(404).json({ code: -1, msg: '考试不存在', data: null });
    }

    // 检查考试是否启用
    if (!exam.is_active) {
      return res.status(400).json({ code: -1, msg: '考试已停止，请联系管理员', data: null });
    }

    // 检查是否绑定了学习任务，且学习任务是否已过期
    if (exam.learning_task_id) {
      const task = db.prepare('SELECT * FROM learning_tasks WHERE id = ?').get(exam.learning_task_id);
      if (!task) {
        return res.status(400).json({ code: -1, msg: '学习任务不存在，考试已失效', data: null });
      }
      if (task.end_time) {
        const now = new Date();
        const endTime = new Date(task.end_time);
        if (now > endTime) {
          return res.status(400).json({ code: -1, msg: '学习任务已到期，考试已自动停止', data: null });
        }
      }

      // 检查该员工是否已完成学习任务
      const staffId = req.user.type === 'employee' ? req.user.id : null;
      if (staffId) {
        const progress = db.prepare(`
          SELECT status FROM learning_progress
          WHERE task_id = ? AND staff_id = ?
        `).get(exam.learning_task_id, staffId);
        if (!progress || progress.status !== 'completed') {
          return res.status(400).json({ code: -1, msg: '请先完成学习任务后再参加考试', data: null });
        }
      }
    }

    // 检查是否有未完成的考试
    // 员工使用 staff_id，管理员使用 user_id
    const isEmployee = req.user.type === 'employee';
    const recordId = isEmployee ? req.user.id : userId;
    const idField = isEmployee ? 'staff_id' : 'user_id';

    const pendingRecord = db.prepare(`
      SELECT * FROM exam_records
      WHERE exam_id = ? AND ${idField} = ? AND submitted_at IS NULL
    `).get(examId, recordId);

    if (pendingRecord) {
      // 返回已存在的记录，让用户继续答题
      return res.json({
        code: 0,
        msg: '继续之前的考试',
        data: { answerId: pendingRecord.id }
      });
    }

    // 检查是否已参加过此考试（防止重复参加）
    const existingRecord = db.prepare(`
      SELECT * FROM exam_records
      WHERE exam_id = ? AND ${idField} = ? AND submitted_at IS NOT NULL
      ORDER BY submitted_at DESC LIMIT 1
    `).get(examId, recordId);

    if (existingRecord) {
      return res.status(400).json({
        code: -1,
        msg: '您已完成此考试，不能重复参加',
        data: { is_passed: existingRecord.is_passed, score: existingRecord.total_score }
      });
    }

    // 创建新的考试记录
    // 员工使用 staff_id，管理员使用 user_id
    // 对于员工，user_id 设为 0（因为 user_id 有 NOT NULL 约束）
    const userIdValue = isEmployee ? 0 : recordId;

    const result = db.prepare(`
      INSERT INTO exam_records (exam_id, user_id, ${idField}, answers, total_score, is_passed, started_at, submitted_at)
      VALUES (?, ?, ?, '{}', 0, 0, datetime('now'), NULL)
    `).run(examId, userIdValue, recordId);

    res.json({
      code: 0,
      msg: '开始考试成功',
      data: { answerId: result.lastInsertRowid }
    });
  } catch (err) {
    console.error('开始考试失败:', err);
    res.status(500).json({ code: -1, msg: '服务器错误', data: null });
  }
});

// POST /api/exam/submit - 提交考试答案
router.post('/submit', authMiddleware, examPermissionMiddleware, (req, res) => {
  try {
    const { answerId, responses } = req.body;
    const userId = getUserId(req);

    if (!answerId) {
      return res.status(400).json({ code: -1, msg: '缺少 answerId', data: null });
    }

    // 员工使用 staff_id，管理员使用 user_id
    const isEmployee = req.user.type === 'employee';
    const idField = isEmployee ? 'staff_id' : 'user_id';
    const recordId = isEmployee ? req.user.id : userId;

    const record = db.prepare(`SELECT * FROM exam_records WHERE id = ? AND ${idField} = ?`).get(answerId, recordId);
    if (!record) {
      return res.status(404).json({ code: -1, msg: '考试记录不存在', data: null });
    }

    if (record.submitted_at) {
      return res.status(400).json({ code: -1, msg: '考试已提交，不能重复提交', data: null });
    }

    const examId = record.exam_id;
    const questions = db.prepare('SELECT * FROM questions WHERE exam_id = ?').all(examId);

    if (questions.length === 0) {
      return res.status(400).json({ code: -1, msg: '考试无题目', data: null });
    }

    // 构建答案映射
    const answersMap = {};
    if (Array.isArray(responses)) {
      responses.forEach(r => {
        answersMap[r.questionId] = r.userAnswer;
      });
    } else if (responses) {
      Object.assign(answersMap, responses);
    }

    let totalScore = 0;
    let correctCount = 0;

    for (const q of questions) {
      const userAnswer = answersMap[q.id.toString()] || answersMap[q.id] || '';
      if (!userAnswer) continue;

      const isCorrect = compareAnswer(q.type, q.answer, userAnswer);
      if (isCorrect) {
        totalScore += q.score;
        correctCount++;
      }
    }

    const exam = db.prepare('SELECT * FROM exams WHERE id = ?').get(examId);
    const isPassed = totalScore >= (exam.pass_score || 60);

    db.prepare(`
      UPDATE exam_records
      SET answers = ?, total_score = ?, is_passed = ?, correct_count = ?, submitted_at = datetime('now')
      WHERE id = ?
    `).run(JSON.stringify(answersMap), totalScore, isPassed ? 1 : 0, correctCount, answerId);

    res.json({
      code: 0,
      msg: isPassed ? '考试通过！' : '考试未通过',
      data: {
        totalScore,
        correctCount,
        totalQuestions: questions.length,
        isPassed,
        passScore: exam.pass_score
      }
    });
  } catch (err) {
    console.error('提交失败:', err);
    res.status(500).json({ code: -1, msg: '服务器错误', data: null });
  }
});

// 比较答案
function compareAnswer(type, correctAnswer, userAnswer) {
  if (type === 'multiple_choice') {
    const correct = correctAnswer.split(',').sort().join(',');
    const user = String(userAnswer).split(',').sort().join(',');
    return correct === user;
  }
  if (type === 'true_false') {
    // 标准化判断题答案：√/对/正确/true/1 都视为正确，×/错/错误/false/0 都视为错误
    const normalizeAnswer = (ans) => {
      const a = String(ans).trim().toLowerCase();
      if (a === '√' || a === '对' || a === '正确' || a === 'true' || a === '1') return '√';
      if (a === '×' || a === '错' || a === '错误' || a === 'false' || a === '0') return '×';
      return a;
    };
    return normalizeAnswer(correctAnswer) === normalizeAnswer(userAnswer);
  }
  return String(correctAnswer) === String(userAnswer);
}

// GET /api/exam/stats/user - 获取用户考试统计
router.get('/stats/user', authMiddleware, examPermissionMiddleware, (req, res) => {
  try {
    const userId = getUserId(req);

    const stats = db.prepare(`
      SELECT 
        COUNT(*) as total_exams,
        SUM(CASE WHEN is_passed = 1 THEN 1 ELSE 0 END) as passed_exams,
        MAX(total_score) as max_score,
        AVG(total_score) as avg_score
      FROM exam_records
      WHERE user_id = ? AND submitted_at IS NOT NULL
    `).get(userId);

    const recentRecords = db.prepare(`
      SELECT er.*, e.title as exam_title, e.duration, e.pass_score
      FROM exam_records er
      JOIN exams e ON er.exam_id = e.id
      WHERE er.user_id = ? AND er.submitted_at IS NOT NULL
      ORDER BY er.submitted_at DESC LIMIT 10
    `).all(userId);

    res.json({
      code: 0, msg: 'success',
      data: {
        summary: stats,
        recent: recentRecords.map(r => ({
          id: r.id,
          exam_id: r.exam_id,
          exam_title: r.exam_title,
          total_score: r.total_score,
          is_passed: r.is_passed,
          submitted_at: r.submitted_at,
          pass_score: r.pass_score
        }))
      }
    });
  } catch (err) {
    console.error('获取统计失败:', err);
    res.status(500).json({ code: -1, msg: '服务器错误', data: null });
  }
});

// GET /api/exam/my-records - 获取我的考试成绩
router.get('/my-records', authMiddleware, examPermissionMiddleware, (req, res) => {
  try {
    const userId = getUserId(req);
    const isEmployee = req.user.type === 'employee';
    const staffId = isEmployee ? req.user.id : null;

    let records;
    if (isEmployee) {
      records = db.prepare(`
        SELECT er.*, e.title as exam_title, e.duration, e.pass_score
        FROM exam_records er
        JOIN exams e ON er.exam_id = e.id
        WHERE er.staff_id = ? AND er.submitted_at IS NOT NULL
        ORDER BY er.submitted_at DESC
      `).all(staffId);
    } else {
      records = db.prepare(`
        SELECT er.*, e.title as exam_title, e.duration, e.pass_score
        FROM exam_records er
        JOIN exams e ON er.exam_id = e.id
        WHERE er.user_id = ? AND er.submitted_at IS NOT NULL
        ORDER BY er.submitted_at DESC
      `).all(userId);
    }

    res.json({
      code: 0, msg: 'success',
      data: records.map(r => ({
        id: r.id,
        exam_id: r.exam_id,
        exam_title: r.exam_title,
        total_score: r.total_score,
        correctCount: r.correct_count,
        is_passed: r.is_passed,
        submitted_at: r.submitted_at,
        pass_score: r.pass_score
      }))
    });
  } catch (err) {
    console.error('获取成绩失败:', err);
    res.status(500).json({ code: -1, msg: '服务器错误', data: null });
  }
});

module.exports = router;
