// src/routes/exam-trainings.js - 培训管理 API
const express = require('express');
const router = express.Router();
const db = require('../models/database');
const Joi = require('joi');
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

// GET /api/exam-trainings - 获取培训列表
router.get('/', authMiddleware, adminMiddleware, (req, res) => {
  try {
    const trainings = db.prepare(`
      SELECT et.*, u.nickname as creator_name,
        eb.title as question_bank_title,
        lt.title as learning_task_title,
        (SELECT COUNT(*) FROM questions WHERE exam_id = et.question_bank_id) as question_count,
        (SELECT COUNT(*) FROM exam_permissions WHERE exam_id = et.id) as perm_count
      FROM exam_trainings et
      LEFT JOIN users u ON et.created_by = u.id
      LEFT JOIN exam_banks eb ON et.question_bank_id = eb.id
      LEFT JOIN learning_tasks lt ON et.learning_task_id = lt.id
      ORDER BY et.created_at DESC
    `).all();

    res.json({ code: 0, msg: 'success', data: trainings });
  } catch (err) {
    console.error('获取培训列表失败:', err);
    res.status(500).json({ code: -1, msg: '服务器错误', data: null });
  }
});

// POST /api/exam-trainings - 创建培训
router.post('/', authMiddleware, adminMiddleware, (req, res) => {
  try {
    const { title, description, start_time, end_time, duration, pass_score, is_active, learning_task_id, question_bank_id } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ code: -1, msg: '培训标题不能为空', data: null });
    }

    const result = db.prepare(`
      INSERT INTO exam_trainings (title, description, duration, pass_score, is_active, start_time, end_time, learning_task_id, question_bank_id, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      title.trim(),
      description || '',
      duration || 60,
      pass_score || 60,
      is_active ? 1 : 0,
      start_time || null,
      end_time || null,
      learning_task_id || null,
      question_bank_id || null,
      req.user.userId
    );

    const training = db.prepare('SELECT * FROM exam_trainings WHERE id = ?').get(result.lastInsertRowid);
    res.json({ code: 0, msg: '培训创建成功', data: training });
  } catch (err) {
    console.error('创建培训失败:', err);
    res.status(500).json({ code: -1, msg: '服务器错误', data: null });
  }
});

// GET /api/exam-trainings/:id - 获取培训详情
router.get('/:id', authMiddleware, adminMiddleware, (req, res) => {
  try {
    const training = db.prepare('SELECT * FROM exam_trainings WHERE id = ?').get(req.params.id);
    if (!training) {
      return res.status(404).json({ code: -1, msg: '培训不存在', data: null });
    }

    // 获取题目
    let questions = [];
    if (training.question_bank_id) {
      questions = db.prepare(`
        SELECT * FROM questions WHERE exam_id = ? ORDER BY sort_order ASC, id ASC
      `).all(training.question_bank_id);
    }

    res.json({ code: 0, msg: 'success', data: { training, questions } });
  } catch (err) {
    console.error('获取培训详情失败:', err);
    res.status(500).json({ code: -1, msg: '服务器错误', data: null });
  }
});

// PUT /api/exam-trainings/:id - 更新培训
router.put('/:id', authMiddleware, adminMiddleware, (req, res) => {
  try {
    const { title, description, start_time, end_time, duration, pass_score, is_active, learning_task_id, question_bank_id } = req.body;

    // 保留原值当参数为 undefined 时
    const currentTraining = db.prepare('SELECT * FROM exam_trainings WHERE id = ?').get(req.params.id);

    // 只有当 title 参数存在且为空时才报错
    if (title !== undefined && !title.trim()) {
      return res.status(400).json({ code: -1, msg: '培训标题不能为空', data: null });
    }

    db.prepare(`
      UPDATE exam_trainings SET
        title = ?, description = ?, duration = ?, pass_score = ?, is_active = ?,
        start_time = ?, end_time = ?,
        learning_task_id = ?, question_bank_id = ?, updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(
      title !== undefined ? title.trim() : currentTraining.title,
      description !== undefined ? description : currentTraining.description,
      duration !== undefined ? duration : currentTraining.duration,
      pass_score !== undefined ? pass_score : currentTraining.pass_score,
      is_active !== undefined ? (is_active ? 1 : 0) : currentTraining.is_active,
      start_time !== undefined ? start_time : currentTraining.start_time,
      end_time !== undefined ? end_time : currentTraining.end_time,
      learning_task_id !== undefined ? learning_task_id : currentTraining.learning_task_id,
      question_bank_id !== undefined ? question_bank_id : currentTraining.question_bank_id,
      req.params.id
    );

    const training = db.prepare('SELECT * FROM exam_trainings WHERE id = ?').get(req.params.id);
    res.json({ code: 0, msg: '培训更新成功', data: training });
  } catch (err) {
    console.error('更新培训失败:', err);
    res.status(500).json({ code: -1, msg: '服务器错误', data: null });
  }
});

// DELETE /api/exam-trainings/:id - 删除培训
router.delete('/:id', authMiddleware, adminMiddleware, (req, res) => {
  try {
    const training = db.prepare('SELECT * FROM exam_trainings WHERE id = ?').get(req.params.id);
    if (!training) {
      return res.status(404).json({ code: -1, msg: '培训不存在', data: null });
    }

    // 删除权限和记录
    db.prepare('DELETE FROM exam_permissions WHERE exam_id = ?').run(req.params.id);
    db.prepare('DELETE FROM exam_records WHERE exam_id = ?').run(req.params.id);
    // 删除培训
    db.prepare('DELETE FROM exam_trainings WHERE id = ?').run(req.params.id);

    res.json({ code: 0, msg: '培训删除成功', data: null });
  } catch (err) {
    console.error('删除培训失败:', err);
    res.status(500).json({ code: -1, msg: '服务器错误', data: null });
  }
});

// GET /api/exam-trainings/:id/permissions - 获取培训权限
router.get('/:id/permissions', authMiddleware, adminMiddleware, (req, res) => {
  try {
    const training = db.prepare('SELECT * FROM exam_trainings WHERE id = ?').get(req.params.id);
    if (!training) {
      return res.status(404).json({ code: -1, msg: '培训不存在', data: null });
    }

    // 获取所有员工，带权限标记
    const staff = db.prepare(`
      SELECT s.id, s.name, s.employee_id, s.department, s.team,
        CASE WHEN ep.id IS NOT NULL THEN 1 ELSE 0 END as has_perm
      FROM staff s
      LEFT JOIN exam_permissions ep ON s.id = ep.staff_id AND ep.exam_id = ?
      ORDER BY s.department, s.name
    `).all(req.params.id);

    res.json({ code: 0, msg: 'success', data: staff });
  } catch (err) {
    console.error('获取培训权限失败:', err);
    res.status(500).json({ code: -1, msg: '服务器错误', data: null });
  }
});

// PUT /api/exam-trainings/:id/permissions - 更新培训权限
router.put('/:id/permissions', authMiddleware, adminMiddleware, (req, res) => {
  try {
    const { staff_ids } = req.body;

    if (!Array.isArray(staff_ids)) {
      return res.status(400).json({ code: -1, msg: '参数错误', data: null });
    }

    // 校验培训是否存在
    const training = db.prepare('SELECT id FROM exam_trainings WHERE id = ?').get(req.params.id);
    if (!training) {
      return res.status(404).json({ code: -1, msg: '培训不存在', data: null });
    }

    // 校验员工ID是否存在，忽略不存在的ID
    if (staff_ids.length > 0) {
      const validStaffIds = db.prepare(`
        SELECT id FROM staff WHERE id IN (${staff_ids.map(() => '?').join(',')})
      `).all(...staff_ids).map(r => r.id);

      const invalidCount = staff_ids.length - validStaffIds.length;
      if (invalidCount > 0) {
        console.log(`忽略 ${invalidCount} 个不存在的员工ID`);
      }

      // 删除该培训的所有权限
      db.prepare('DELETE FROM exam_permissions WHERE exam_id = ?').run(req.params.id);

      // 批量插入新权限（只插入存在的员工）
      if (validStaffIds.length > 0) {
        const insertStmt = db.prepare(`
          INSERT INTO exam_permissions (exam_id, staff_id, can_take)
          VALUES (?, ?, 1)
        `);

        for (const staffId of validStaffIds) {
          insertStmt.run(req.params.id, staffId);
        }
      }

      res.json({ code: 0, msg: '权限已保存', data: { count: validStaffIds.length, ignored: invalidCount } });
    } else {
      // 空数组 = 清空权限
      db.prepare('DELETE FROM exam_permissions WHERE exam_id = ?').run(req.params.id);
      res.json({ code: 0, msg: '权限已保存', data: { count: 0, ignored: 0 } });
    }
  } catch (err) {
    console.error('保存培训权限失败:', err);
    res.status(500).json({ code: -1, msg: '服务器错误', data: null });
  }
});

// GET /api/exam-trainings/:id/stats - 获取培训统计
router.get('/:id/stats', authMiddleware, adminMiddleware, (req, res) => {
  try {
    const training = db.prepare('SELECT * FROM exam_trainings WHERE id = ?').get(req.params.id);
    if (!training) {
      return res.status(404).json({ code: -1, msg: '培训不存在', data: null });
    }

    // 获取统计数据
    const stats = db.prepare(`
      SELECT
        COUNT(DISTINCT er.user_id) as total_participated,
        AVG(er.score) as avg_score,
        MAX(er.score) as max_score,
        MIN(er.score) as min_score,
        SUM(CASE WHEN er.score >= ? THEN 1 ELSE 0 END) as passed_count
      FROM exam_records er
      WHERE er.exam_id = ?
    `).get(training.pass_score, req.params.id);

    const totalPermissions = db.prepare(`
      SELECT COUNT(*) as count FROM exam_permissions WHERE exam_id = ?
    `).get(req.params.id);

    res.json({
      code: 0, msg: 'success', data: {
        ...stats,
        total_permissions: totalPermissions.count
      }
    });
  } catch (err) {
    console.error('获取培训统计失败:', err);
    res.status(500).json({ code: -1, msg: '服务器错误', data: null });
  }
});

// POST /api/exam-trainings/:id/import-participants - 导入培训人员
router.post('/:id/import-participants', authMiddleware, adminMiddleware, upload.single('file'), (req, res) => {
  try {
    // 获取上传的文件
    if (!req.file) {
      return res.status(400).json({ code: -1, msg: '请上传文件', data: null });
    }

    const trainingId = req.params.id;

    // 校验培训是否存在
    const training = db.prepare('SELECT id FROM exam_trainings WHERE id = ?').get(trainingId);
    if (!training) {
      require('fs').unlinkSync(req.file.path);
      return res.status(404).json({ code: -1, msg: '培训不存在', data: null });
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
          insertStmt.run(trainingId, employeeId);
          count++;
        }
      }
    }

    res.json({ code: 0, msg: '导入成功', data: { count } });
  } catch (err) {
    console.error('导入人员失败:', err);
    res.status(500).json({ code: -1, msg: '导入失败：' + err.message, data: null });
  }
});

module.exports = router;
