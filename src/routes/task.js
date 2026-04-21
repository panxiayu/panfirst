// src/routes/task.js - 工作任务 API
const express = require('express');
const router = express.Router();
const db = require('../models/database');
const Joi = require('joi');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

// 获取任务列表
// GET /api/task
router.get('/', authMiddleware, (req, res) => {
  try {
    const { status, type } = req.query;
    
    let query = 'SELECT * FROM tasks WHERE 1=1';
    const params = [];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    if (type) {
      query += ' AND type = ?';
      params.push(type);
    }

    // 如果不是管理员，只显示分配给自己的任务
    if (req.user.role !== 'admin') {
      query += ' AND assigned_to = ?';
      params.push(req.user.userId);
    }

    query += ' ORDER BY created_at DESC';

    const tasks = db.prepare(query).all(...params);

    res.json({
      code: 0,
      msg: 'success',
      data: tasks
    });
  } catch (err) {
    console.error('获取任务列表失败:', err);
    res.status(500).json({
      code: -1,
      msg: '服务器错误',
      data: null
    });
  }
});

// 获取任务详情
// GET /api/task/:id
router.get('/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;

    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);

    if (!task) {
      return res.status(404).json({
        code: -1,
        msg: '任务不存在',
        data: null
      });
    }

    // 检查权限
    if (req.user.role !== 'admin' && task.assigned_to !== req.user.userId) {
      return res.status(403).json({
        code: -1,
        msg: '无权访问此任务',
        data: null
      });
    }

    res.json({
      code: 0,
      msg: 'success',
      data: task
    });
  } catch (err) {
    console.error('获取任务详情失败:', err);
    res.status(500).json({
      code: -1,
      msg: '服务器错误',
      data: null
    });
  }
});

// 创建任务
// POST /api/task
router.post('/', authMiddleware, adminMiddleware, (req, res) => {
  try {
    const schema = Joi.object({
      title: Joi.string().required(),
      description: Joi.string().optional(),
      type: Joi.string().valid('exam', 'meal').required(), // exam 或 meal
      assigned_to: Joi.number().required(),
      due_date: Joi.date().optional(),
      priority: Joi.string().valid('low', 'medium', 'high').default('medium'),
      status: Joi.string().valid('pending', 'in_progress', 'completed').default('pending')
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        code: -1,
        msg: error.details[0].message,
        data: null
      });
    }

    const { title, description, type, assigned_to, due_date, priority, status } = value;

    const stmt = db.prepare(`
      INSERT INTO tasks (title, description, type, assigned_to, assigned_by, due_date, priority, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);

    const result = stmt.run(
      title,
      description || '',
      type,
      assigned_to,
      req.user.userId,
      due_date || null,
      priority,
      status
    );

    res.json({
      code: 0,
      msg: '任务创建成功',
      data: {
        id: result.lastInsertRowid,
        title,
        description,
        type,
        assigned_to,
        assigned_by: req.user.userId,
        due_date,
        priority,
        status
      }
    });
  } catch (err) {
    console.error('创建任务失败:', err);
    res.status(500).json({
      code: -1,
      msg: '服务器错误',
      data: null
    });
  }
});

// 编辑任务
// PUT /api/task/:id
router.put('/:id', authMiddleware, adminMiddleware, (req, res) => {
  try {
    const { id } = req.params;

    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    if (!task) {
      return res.status(404).json({
        code: -1,
        msg: '任务不存在',
        data: null
      });
    }

    const { title, description, status, priority, due_date } = req.body;

    const stmt = db.prepare(`
      UPDATE tasks
      SET title = ?, description = ?, status = ?, priority = ?, due_date = ?
      WHERE id = ?
    `);

    stmt.run(
      title || task.title,
      description !== undefined ? description : task.description,
      status || task.status,
      priority || task.priority,
      due_date !== undefined ? due_date : task.due_date,
      id
    );

    res.json({
      code: 0,
      msg: '任务更新成功',
      data: null
    });
  } catch (err) {
    console.error('编辑任务失败:', err);
    res.status(500).json({
      code: -1,
      msg: '服务器错误',
      data: null
    });
  }
});

// 完成任务
// POST /api/task/:id/complete
router.post('/:id/complete', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;

    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    if (!task) {
      return res.status(404).json({
        code: -1,
        msg: '任务不存在',
        data: null
      });
    }

    // 检查权限
    if (req.user.role !== 'admin' && task.assigned_to !== req.user.userId) {
      return res.status(403).json({
        code: -1,
        msg: '无权完成此任务',
        data: null
      });
    }

    db.prepare('UPDATE tasks SET status = ? WHERE id = ?').run('completed', id);

    res.json({
      code: 0,
      msg: '任务已完成',
      data: null
    });
  } catch (err) {
    console.error('完成任务失败:', err);
    res.status(500).json({
      code: -1,
      msg: '服务器错误',
      data: null
    });
  }
});

// 删除任务
// DELETE /api/task/:id
router.delete('/:id', authMiddleware, adminMiddleware, (req, res) => {
  try {
    const { id } = req.params;

    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    if (!task) {
      return res.status(404).json({
        code: -1,
        msg: '任务不存在',
        data: null
      });
    }

    db.prepare('DELETE FROM tasks WHERE id = ?').run(id);

    res.json({
      code: 0,
      msg: '任务删除成功',
      data: null
    });
  } catch (err) {
    console.error('删除任务失败:', err);
    res.status(500).json({
      code: -1,
      msg: '服务器错误',
      data: null
    });
  }
});

module.exports = router;
