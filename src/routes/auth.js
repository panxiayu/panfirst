// src/routes/auth.js - 完整的认证 API
const express = require('express');
const router = express.Router();
const db = require('../models/database');
const { generateToken, verifyToken, hashPassword, verifyPassword } = require('../utils/auth');
const Joi = require('joi');

// ============ 验证 Schema ============

const adminLoginSchema = Joi.object({
  username: Joi.string().required().min(3).max(50),
  password: Joi.string().required().min(6).max(100)
});

// ============ 中间件 ============

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({
      code: -1,
      msg: '请先登录',
      data: null
    });
  }

  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({
      code: -1,
      msg: 'token 无效或已过期',
      data: null
    });
  }

  req.user = payload;
  next();
}

// ============ API 端点 ============

/**
 * POST /api/auth/login
 * 统一登录接口
 * - 管理员：{ username, password }
 * - 用户：{ nickname, openid, avatar? }
 */
router.post('/login', (req, res) => {
  try {
    const { username, password, nickname, openid, avatar } = req.body;

    // ============ 管理员登录 ============
    if (username && password) {
      // 验证输入
      const { error, value } = adminLoginSchema.validate({ username, password });
      if (error) {
        return res.status(400).json({
          code: -1,
          msg: error.details[0].message,
          data: null
        });
      }

      // 查找管理员用户（使用单引号括起字符串值）
      const user = db.prepare("SELECT * FROM users WHERE username = ? AND role = 'admin'").get(username);

      if (!user) {
        return res.status(401).json({
          code: -1,
          msg: '用户名或密码错误',
          data: null
        });
      }

      // 验证密码
      if (!verifyPassword(password, user.password)) {
        return res.status(401).json({
          code: -1,
          msg: '用户名或密码错误',
          data: null
        });
      }

      // 生成 token
      const token = generateToken({
        userId: user.id,
        username: user.username,
        role: user.role,
        type: 'admin',
        can_manage_voting: user.can_manage_voting || 0,
        can_manage_exam: user.can_manage_exam || 0,
        can_manage_meal: user.can_manage_meal || 0,
        can_manage_staff: user.can_manage_staff || 0,
        can_manage_task: user.can_manage_task || 0,
        can_manage_training: user.can_manage_training || 0,
        can_manage_6s: user.can_manage_6s || 0,
        can_manage_permission: user.can_manage_permission || 0,
        can_manage_file: user.can_manage_file || 0
      });

      // 返回用户信息（不包含密码）
      const { password: _, ...safeUser } = user;

      // 确保权限字段存在
      safeUser.can_manage_voting = user.can_manage_voting || 0;
      safeUser.can_manage_exam = user.can_manage_exam || 0;
      safeUser.can_manage_meal = user.can_manage_meal || 0;
      safeUser.can_manage_staff = user.can_manage_staff || 0;
      safeUser.can_manage_task = user.can_manage_task || 0;
      safeUser.can_manage_training = user.can_manage_training || 0;
      safeUser.can_manage_6s = user.can_manage_6s || 0;
      safeUser.can_manage_permission = user.can_manage_permission || 0;
      safeUser.can_manage_file = user.can_manage_file || 0;

      return res.json({
        code: 0,
        msg: '登录成功',
        data: {
          token,
          user: safeUser
        }
      });
    }

    // ============ 用户考试登录 ============
    if (nickname && openid) {
      // 检查用户是否在系统中（管理员预先添加）
      const user = db.prepare('SELECT * FROM users WHERE nickname = ? AND role IN ("student", "user")').get(nickname);

      if (!user) {
        return res.status(401).json({
          code: -1,
          msg: '名字不匹配，无法登入',
          data: null
        });
      }

      // 用户已存在，直接登录（更新 openid、avatar 等信息）
      try {
        db.prepare(
          'UPDATE users SET openid = ?, avatar = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
        ).run(openid, avatar || '', user.id);
      } catch (e) {
        // 忽略更新错误（如 openid 冲突）
      }

      // 生成 token
      const token = generateToken({
        userId: user.id,
        username: user.nickname,
        role: user.role
      });

      const { password: _, ...safeUser } = user;

      return res.json({
        code: 0,
        msg: '登录成功',
        data: {
          token,
          user: safeUser
        }
      });
    }

    // 参数不足
    return res.status(400).json({
      code: -1,
      msg: '请求参数错误：管理员需提供 username+password，用户需提供 nickname+openid',
      data: null
    });
  } catch (err) {
    console.error('登录失败:', err);
    res.status(500).json({
      code: -1,
      msg: '服务器错误',
      data: null
    });
  }
});

/**
 * GET /api/auth/me
 * 获取当前用户信息
 */
router.get('/me', authMiddleware, (req, res) => {
  try {
    const currentUserId = req.user.type === 'employee' ? req.user.id : req.user.userId;
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(currentUserId);

    if (!user) {
      return res.status(404).json({
        code: -1,
        msg: '用户不存在',
        data: null
      });
    }

    const { password: _, ...safeUser } = user;

    res.json({
      code: 0,
      msg: 'success',
      data: safeUser
    });
  } catch (err) {
    console.error('获取用户信息失败:', err);
    res.status(500).json({
      code: -1,
      msg: '服务器错误',
      data: null
    });
  }
});

/**
 * POST /api/auth/logout
 * 登出
 */
router.post('/logout', authMiddleware, (req, res) => {
  res.json({
    code: 0,
    msg: '登出成功',
    data: null
  });
});

/**
 * POST /api/auth/refresh
 * 刷新 token
 */
router.post('/refresh', authMiddleware, (req, res) => {
  try {
    const currentUserId = req.user.type === 'employee' ? req.user.id : req.user.userId;
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(currentUserId);

    if (!user) {
      return res.status(404).json({
        code: -1,
        msg: '用户不存在',
        data: null
      });
    }

    // 根据用户类型生成对应的 token
    const newToken = req.user.type === 'employee'
      ? generateToken({ id: user.id, type: 'employee', employee_id: user.employee_id, name: user.name })
      : generateToken({ userId: user.id, username: user.username, role: user.role });

    res.json({
      code: 0,
      msg: 'token 刷新成功',
      data: {
        token: newToken
      }
    });
  } catch (err) {
    console.error('刷新 token 失败:', err);
    res.status(500).json({
      code: -1,
      msg: '服务器错误',
      data: null
    });
  }
});

/**
 * PUT /api/auth/permissions
 * 更新当前用户的权限（管理员专用）
 */
router.put('/permissions', authMiddleware, (req, res) => {
  try {
    // 只有管理员可以修改权限
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        code: -1,
        msg: '只有管理员可以修改权限',
        data: null
      });
    }

    const { can_manage_voting, can_manage_exam, can_manage_meal, can_manage_staff, can_manage_task } = req.body;

    // 验证参数
    const permissions = {
      can_manage_voting: can_manage_voting !== undefined ? (can_manage_voting ? 1 : 0) : undefined,
      can_manage_exam: can_manage_exam !== undefined ? (can_manage_exam ? 1 : 0) : undefined,
      can_manage_meal: can_manage_meal !== undefined ? (can_manage_meal ? 1 : 0) : undefined,
      can_manage_staff: can_manage_staff !== undefined ? (can_manage_staff ? 1 : 0) : undefined,
      can_manage_task: can_manage_task !== undefined ? (can_manage_task ? 1 : 0) : undefined
    };

    // 构建更新语句
    const updates = [];
    const params = [];
    for (const [key, value] of Object.entries(permissions)) {
      if (value !== undefined) {
        updates.push(`${key} = ?`);
        params.push(value);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({
        code: -1,
        msg: '没有提供要更新的权限',
        data: null
      });
    }

    params.push(req.user.userId);
    const updateSql = `UPDATE users SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;

    db.prepare(updateSql).run(...params);

    // 获取更新后的用户
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.userId);
    const { password: _, ...safeUser } = user;

    res.json({
      code: 0,
      msg: '权限更新成功',
      data: safeUser
    });
  } catch (err) {
    console.error('更新权限失败:', err);
    res.status(500).json({
      code: -1,
      msg: '服务器错误',
      data: null
    });
  }
});

/**
 * GET /api/auth/lookup?employee_id=xxx
 * 根据工号查询员工姓名（无权限验证，用于登录页自动填充）
 */
router.get('/lookup', (req, res) => {
  try {
    const { employee_id } = req.query;
    if (!employee_id) {
      return res.json({ code: -1, msg: '工号不能为空', data: null });
    }
    const staff = db.prepare(
      "SELECT name FROM staff WHERE employee_id = ? AND status = 'active'"
    ).get(employee_id.trim());
    if (staff) {
      res.json({ code: 0, msg: 'ok', data: { name: staff.name } });
    } else {
      res.json({ code: 0, msg: 'ok', data: { name: null } });
    }
  } catch (err) {
    res.status(500).json({ code: -1, msg: '服务器错误', data: null });
  }
});

/**
 * POST /api/auth/employee-login
 * 员工登录：工号 + 姓名验证
 */
router.post('/employee-login', (req, res) => {
  try {
    const { employee_id, name } = req.body;

    if (!employee_id || !name) {
      return res.status(400).json({ code: -1, msg: '工号和姓名不能为空', data: null });
    }

    const staff = db.prepare(
      "SELECT * FROM staff WHERE employee_id = ? AND name = ? AND status = 'active'"
    ).get(employee_id.trim(), name.trim());

    if (!staff) {
      return res.status(401).json({ code: -1, msg: '工号或姓名不匹配，无登录权限', data: null });
    }

    const token = generateToken({ id: staff.id, type: 'employee', employee_id: staff.employee_id, name: staff.name, s6_permission: staff.s6_permission || 0 });

    res.json({
      code: 0,
      msg: '登录成功',
      data: {
        token,
        staff: {
          id: staff.id,
          name: staff.name,
          employee_id: staff.employee_id,
          department: staff.department,
          position: staff.position
        }
      }
    });
  } catch (err) {
    console.error('员工登录失败:', err);
    res.status(500).json({ code: -1, msg: '服务器错误', data: null });
  }
});

module.exports = router;
