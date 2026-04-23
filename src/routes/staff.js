// src/routes/staff.js - 人员管理 API
const express = require('express');
const router = express.Router();
const db = require('../models/database');
const Joi = require('joi');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

// 部门ID到中文名称的映射
const departmentMap = {
  1: '技术部',
  2: '销售部',
  3: '人力资源部',
  4: '财务部',
  5: '生产部'
};

// 辅助函数：转换 department_id 为中文部门名称
function mapDepartmentName(staff) {
  if (!staff) return staff;
  const deptId = staff.department_id;
  if (deptId && departmentMap[deptId]) {
    staff.department_id = departmentMap[deptId];
  }
  return staff;
}

// 初始化部门数据
function initializeDepartments() {
  try {
    // 检查 departments 表是否存在
    const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='departments'").get();
    if (!tableExists) {
      // 创建 departments 表
      db.prepare(`
        CREATE TABLE IF NOT EXISTS departments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `).run();
    }

    // 初始化部门数据
    const departments = [
      { id: 1, name: '技术部' },
      { id: 2, name: '销售部' },
      { id: 3, name: '人力资源部' },
      { id: 4, name: '财务部' },
      { id: 5, name: '生产部' }
    ];

    const insertStmt = db.prepare('INSERT OR IGNORE INTO departments (id, name) VALUES (?, ?)');
    departments.forEach(dept => {
      insertStmt.run(dept.id, dept.name);
    });

    console.log('部门数据初始化完成');
  } catch (err) {
    console.error('初始化部门数据失败:', err);
  }
}

// 初始化部门数据
initializeDepartments();

// 初始化用户列配置表
function initializeUserColumnConfigs() {
  try {
    const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='user_column_configs'").get();
    if (!tableExists) {
      db.prepare(`
        CREATE TABLE IF NOT EXISTS user_column_configs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          config_key TEXT NOT NULL DEFAULT 'staff_columns',
          config_data TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, config_key)
        )
      `).run();
      console.log('用户列配置表初始化完成');
    }
  } catch (err) {
    console.error('初始化用户列配置表失败:', err);
  }
}
initializeUserColumnConfigs();

// 初始化同步记录表
function initializeSyncLog() {
  try {
    const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sync_log'").get();
    if (!tableExists) {
      db.prepare(`
        CREATE TABLE IF NOT EXISTS sync_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          sync_type TEXT NOT NULL DEFAULT 'staff',
          synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          result TEXT,
          details TEXT
        )
      `).run();
    }
  } catch (err) {
    console.error('初始化同步记录表失败:', err);
  }
}
initializeSyncLog();

// 获取用户列配置
// GET /api/staff/column-config?key=staff_columns
router.get('/column-config', authMiddleware, (req, res) => {
  try {
    const userId = req.user.type === 'employee' ? req.user.id : req.user.userId;
    const configKey = req.query.key || 'staff_columns';

    const row = db.prepare('SELECT config_data FROM user_column_configs WHERE user_id = ? AND config_key = ?').get(userId, configKey);

    res.json({
      code: 0,
      msg: 'success',
      data: row ? JSON.parse(row.config_data) : null
    });
  } catch (err) {
    console.error('获取用户列配置失败:', err);
    res.status(500).json({
      code: -1,
      msg: '服务器错误',
      data: null
    });
  }
});

// 获取最新同步时间（公开接口）
// GET /api/staff/sync-time
router.get('/sync-time', (req, res) => {
  try {
    const row = db.prepare('SELECT synced_at FROM sync_log WHERE sync_type = ? ORDER BY id DESC LIMIT 1').get('staff');
    res.json({
      code: 0,
      msg: 'success',
      data: row ? row.synced_at : null
    });
  } catch (err) {
    console.error('获取同步时间失败:', err);
    res.status(500).json({ code: -1, msg: '服务器错误', data: null });
  }
});

// 更新同步时间（内部接口，用 X-Sync-Secret 认证）
// POST /api/staff/sync-time
router.post('/sync-time', (req, res) => {
  const syncSecret = process.env.SYNC_SECRET;
  const providedSecret = req.headers['x-sync-secret'];
  if (syncSecret && providedSecret !== syncSecret) {
    return res.status(401).json({ code: -1, msg: '未授权', data: null });
  }
  try {
    const { result, details, synced_at } = req.body || {};
    const time = synced_at || new Date().toISOString().slice(0, 19).replace('T', ' ');
    db.prepare("INSERT INTO sync_log (sync_type, synced_at, result, details) VALUES (?, ?, ?, ?)").run('staff', time, result || 'success', details || '');
    res.json({ code: 0, msg: '同步时间已记录', data: null });
  } catch (err) {
    console.error('记录同步时间失败:', err);
    res.status(500).json({ code: -1, msg: '服务器错误', data: null });
  }
});

// 保存用户列配置
// POST /api/staff/column-config
router.post('/column-config', authMiddleware, (req, res) => {
  try {
    const userId = req.user.type === 'employee' ? req.user.id : req.user.userId;
    const { key, data } = req.body;

    if (!key || data === undefined) {
      return res.status(400).json({
        code: -1,
        msg: '参数错误：key 和 data 必填',
        data: null
      });
    }

    const configData = typeof data === 'string' ? data : JSON.stringify(data);

    db.prepare(`
      INSERT INTO user_column_configs (user_id, config_key, config_data, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id, config_key) DO UPDATE SET
        config_data = excluded.config_data,
        updated_at = CURRENT_TIMESTAMP
    `).run(userId, key, configData);

    res.json({
      code: 0,
      msg: '保存成功',
      data: null
    });
  } catch (err) {
    console.error('保存用户列配置失败:', err);
    res.status(500).json({
      code: -1,
      msg: '服务器错误',
      data: null
    });
  }
});

// 获取员工列表
// GET /api/staff
router.get('/', authMiddleware, (req, res) => {
  try {
    const { search, departments, teams, status, hire_date_from, hire_date_to } = req.query;

    let query = `SELECT * FROM staff s WHERE 1=1`;
    const params = [];

    if (search) {
      query += ' AND (s.name LIKE ? OR s.employee_id LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    if (departments) {
      const deptList = departments.split(',');
      query += ` AND s.department IN (${deptList.map(() => '?').join(',')})`;
      params.push(...deptList);
    }

    if (teams) {
      const teamList = teams.split(',');
      query += ` AND s.team IN (${teamList.map(() => '?').join(',')})`;
      params.push(...teamList);
    }

    if (status) {
      query += ' AND s.status = ?';
      params.push(status);
    }

    if (hire_date_from) {
      query += ' AND s.hire_date >= ?';
      params.push(hire_date_from);
    }

    if (hire_date_to) {
      query += ' AND s.hire_date <= ?';
      params.push(hire_date_to);
    }

    query += ' ORDER BY s.id ASC';

    const staff = db.prepare(query).all(...params);

    res.json({
      code: 0,
      msg: 'success',
      data: staff
    });
  } catch (err) {
    console.error('获取员工列表失败:', err);
    res.status(500).json({
      code: -1,
      msg: '服务器错误: ' + err.message,
      data: null
    });
  }
});

// GET /api/staff/permission-fields
// 获取权限字段配置
router.get('/permission-fields', authMiddleware, (req, res) => {
  try {
    const fields = [
      { key: 'exam_permission', name: '考试权限', description: '允许参加在线考试' },
      { key: 'meal_permission', name: '报餐权限', description: '允许使用报餐系统' },
      { key: 'task_permission', name: '学习任务权限', description: '允许观看学习视频' },
      { key: 's6_permission', name: '6S管理权限', description: '允许提交6S曝光记录' }
    ];

    res.json({
      code: 0,
      msg: 'success',
      data: fields
    });
  } catch (err) {
    console.error('获取权限字段失败:', err);
    res.status(500).json({
      code: -1,
      msg: '服务器错误',
      data: null
    });
  }
});

// 获取员工详情
// GET /api/staff/:id
router.get('/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;

    const staff = db.prepare(`SELECT s.*, d.name as department_name, p.name as position_name
      FROM staff s
      LEFT JOIN departments d ON s.department_id = d.id
      LEFT JOIN positions p ON s.position_id = p.id
      WHERE s.id = ?`).get(id);

    if (!staff) {
      return res.status(404).json({
        code: -1,
        msg: '员工不存在',
        data: null
      });
    }

    // 重命名以匹配前端期望的字段名
    staff.department = staff.department_name || staff.department;
    staff.position = staff.position_name || staff.position;
    delete staff.department_name;
    delete staff.position_name;

    if (!staff) {
      return res.status(404).json({
        code: -1,
        msg: '员工不存在',
        data: null
      });
    }

    // 获取员工的考试成绩
    const examScores = db.prepare(`
      SELECT er.id, e.title, er.score, er.status, er.created_at
      FROM exam_records er
      JOIN exams e ON er.exam_id = e.id
      WHERE er.user_id = ?
      ORDER BY er.created_at DESC
      LIMIT 10
    `).all(staff.id);

    // 获取员工的报餐记录
    const mealOrders = db.prepare(`
      SELECT msv.id, ma.title, msv.meal_type, msv.employee_count, msv.guest_count, msv.signup_date, msv.created_at
      FROM meal_signups_v4 msv
      JOIN meal_activities_v4 ma ON msv.activity_id = ma.id
      WHERE msv.user_id = ?
      ORDER BY msv.created_at DESC
      LIMIT 10
    `).all(staff.id);

    res.json({
      code: 0,
      msg: 'success',
      data: {
        ...staff,
        examScores,
        mealOrders
      }
    });
  } catch (err) {
    console.error('获取员工详情失败:', err);
    res.status(500).json({
      code: -1,
      msg: '服务器错误',
      data: null
    });
  }
});

// 添加员工
// POST /api/staff
router.post('/', authMiddleware, adminMiddleware, (req, res) => {
  try {
    const schema = Joi.object({
      name: Joi.string().required(),
      employee_id: Joi.string().required(), // 工号必填
      phone: Joi.string().optional(),
      department_id: Joi.number().optional(),
      position_id: Joi.number().optional(),
      hire_date: Joi.date().optional(),
      exam_permission: Joi.number().valid(0, 1).default(1),
      meal_permission: Joi.number().valid(0, 1).default(1),
      status: Joi.string().default('active')
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        code: -1,
        msg: error.details[0].message,
        data: null
      });
    }

    const { name, employee_id, phone, department_id, position_id, hire_date, exam_permission, meal_permission, status } = value;

    // 检查工号是否已存在
    const existingEmpId = db.prepare('SELECT * FROM staff WHERE employee_id = ?').get(employee_id);
    if (existingEmpId) {
      return res.status(400).json({
        code: -1,
        msg: '工号已存在',
        data: null
      });
    }

    const stmt = db.prepare(`
      INSERT INTO staff (name, employee_id, phone, department_id, position_id, hire_date, exam_permission, meal_permission, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);

    const result = stmt.run(
      name,
      employee_id,
      phone || '',
      department_id || null,
      position_id || null,
      hire_date || null,
      exam_permission,
      meal_permission,
      status
    );

    res.json({
      code: 0,
      msg: '员工添加成功',
      data: {
        id: result.lastInsertRowid,
        name,
        employee_id,
        phone,
        department_id,
        position_id,
        hire_date,
        exam_permission,
        meal_permission,
        status
      }
    });
  } catch (err) {
    console.error('添加员工失败:', err);
    res.status(500).json({
      code: -1,
      msg: '服务器错误',
      data: null
    });
  }
});

// 编辑员工
// PUT /api/staff/:id
router.put('/:id', authMiddleware, adminMiddleware, (req, res) => {
  try {
    const { id } = req.params;

    const staff = db.prepare('SELECT * FROM staff WHERE id = ?').get(id);
    if (!staff) {
      return res.status(404).json({
        code: -1,
        msg: '员工不存在',
        data: null
      });
    }

    const { name, employee_id, phone, department_id, position_id, hire_date, exam_permission, meal_permission, status } = req.body;

    // 如果更新工号，检查是否重复（排除自己）
    if (employee_id && employee_id !== staff.employee_id) {
      const existing = db.prepare('SELECT * FROM staff WHERE employee_id = ? AND id != ?').get(employee_id, id);
      if (existing) {
        return res.status(400).json({
          code: -1,
          msg: '工号已存在',
          data: null
        });
      }
    }

    const stmt = db.prepare(`
      UPDATE staff
      SET name = COALESCE(?, name),
          employee_id = COALESCE(?, employee_id),
          phone = COALESCE(?, phone),
          department_id = COALESCE(?, department_id),
          position_id = COALESCE(?, position_id),
          hire_date = COALESCE(?, hire_date),
          exam_permission = COALESCE(?, exam_permission),
          meal_permission = COALESCE(?, meal_permission),
          status = COALESCE(?, status)
      WHERE id = ?
    `);

    stmt.run(
      name,
      employee_id,
      phone,
      department_id,
      position_id,
      hire_date,
      exam_permission,
      meal_permission,
      status,
      id
    );

    res.json({
      code: 0,
      msg: '员工更新成功',
      data: null
    });
  } catch (err) {
    console.error('编辑员工失败:', err);
    res.status(500).json({
      code: -1,
      msg: '服务器错误',
      data: null
    });
  }
});

// 删除员工
// DELETE /api/staff/:id
router.delete('/:id', authMiddleware, adminMiddleware, (req, res) => {
  try {
    const { id } = req.params;

    const staff = db.prepare('SELECT * FROM staff WHERE id = ?').get(id);
    if (!staff) {
      return res.status(404).json({
        code: -1,
        msg: '员工不存在',
        data: null
      });
    }

    db.prepare('DELETE FROM staff WHERE id = ?').run(id);

    res.json({
      code: 0,
      msg: '员工删除成功',
      data: null
    });
  } catch (err) {
    console.error('删除员工失败:', err);
    res.status(500).json({
      code: -1,
      msg: '服务器错误',
      data: null
    });
  }
});

// 批量导入员工
// POST /api/staff/bulk-import
router.post('/bulk-import', authMiddleware, adminMiddleware, (req, res) => {
  try {
    const { employees } = req.body;

    if (!Array.isArray(employees) || employees.length === 0) {
      return res.status(400).json({
        code: -1,
        msg: '请提供员工数据数组',
        data: null
      });
    }

    let successCount = 0;
    let failCount = 0;
    const errors = [];

    // 准备插入语句
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO staff 
      (name, employee_id, phone, department_id, hire_date, exam_permission, meal_permission, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);

    for (const emp of employees) {
      try {
        // 验证必需字段
        if (!emp.name || !emp.employee_id) {
          failCount++;
          errors.push(`${emp.name || '未知'}: 姓名和工号为必填`);
          continue;
        }

        // 只验证工号重复，姓名、电话、部门重复均可导入成功
        const existingEmp = db.prepare('SELECT id FROM staff WHERE employee_id = ?').get(emp.employee_id);
        if (existingEmp) {
          failCount++;
          errors.push(`${emp.name}: 工号 ${emp.employee_id} 已存在`);
          continue;
        }

        // 权限默认值
        const examPerm = emp.exam_permission !== undefined ? Number(emp.exam_permission) : 1;
        const mealPerm = emp.meal_permission !== undefined ? Number(emp.meal_permission) : 1;

        stmt.run(
          emp.name,
          emp.employee_id || '',
          emp.phone || '',
          emp.department_id ? Number(emp.department_id) : null,
          emp.hire_date || null,
          examPerm,
          mealPerm,
          emp.status || 'active'
        );

        successCount++;
      } catch (err) {
        failCount++;
        errors.push(`${emp.name}: ${err.message}`);
      }
    }

    res.json({
      code: 0,
      msg: '批量导入完成',
      data: {
        success: successCount,
        fail: failCount,
        errors: errors
      }
    });
  } catch (err) {
    console.error('批量导入失败:', err);
    res.status(500).json({
      code: -1,
      msg: '服务器错误',
      data: null
    });
  }
});

// POST /api/staff/sync-from-smb
router.post('/sync-from-smb',
  (req, res, next) => {
    const syncSecret = process.env.SYNC_SECRET;
    const providedSecret = req.headers['x-sync-secret'];
    if (syncSecret && providedSecret === syncSecret) {
      return next();
    }
    authMiddleware(req, res, (err) => {
      if (err) return res.status(401).json({ code: -1, msg: '未登录', data: null });
      adminMiddleware(req, res, (err) => {
        if (err) return res.status(403).json({ code: -1, msg: '权限不足', data: null });
        next();
      });
    });
  },
  async (req, res) => {
    const { spawn } = require('child_process');
    const path = require('path');
    const fs = require('fs');

    const scriptPath = path.join(__dirname, '../../scripts/smb-staff-sync.js');

    if (!fs.existsSync(scriptPath)) {
      return res.status(500).json({ code: -1, msg: '同步脚本不存在', data: null });
    }

    try {
      let stdout = '';
      let stderr = '';

      const child = spawn('/usr/bin/node', [scriptPath], {
        cwd: path.join(__dirname, '../..'),
        stdio: ['ignore', 'pipe', 'pipe']
      });

      child.stdout.on('data', (data) => { stdout += data.toString(); });
      child.stderr.on('data', (data) => { stderr += data.toString(); });

      const timeout = setTimeout(() => {
        child.kill();
        console.error('[SYNC] Script timed out');
        res.status(500).json({ code: -1, msg: '同步超时', data: null });
      }, 120000);

      child.on('close', (code) => {
        clearTimeout(timeout);

        if (code !== 0 && stderr) {
          console.error('[SYNC] Script error:', stderr);
        }

        let syncResult = {};
        try {
          const lines = stdout.split('\n');
          for (let i = lines.length - 1; i >= 0; i--) {
            const line = lines[i].trim();
            if (line.startsWith('{') && line.endsWith('}')) {
              syncResult = JSON.parse(line);
              break;
            }
          }
        } catch (e) {}

        res.json({ code: 0, msg: '同步成功', data: syncResult });
      });

      child.on('error', (err) => {
        clearTimeout(timeout);
        console.error('[SYNC] Script error:', err);
        res.status(500).json({ code: -1, msg: '同步失败: ' + err.message, data: null });
      });
    } catch (err) {
      console.error('[SYNC] Error:', err);
      res.status(500).json({ code: -1, msg: '同步失败: ' + err.message, data: null });
    }
  }
);

// POST /api/staff/batch-permissions
// 批量更新员工权限
router.post('/batch-permissions', authMiddleware, adminMiddleware, (req, res) => {
  try {
    const { permissions } = req.body;

    if (!Array.isArray(permissions) || permissions.length === 0) {
      return res.status(400).json({
        code: -1,
        msg: '请提供有效的权限数据',
        data: null
      });
    }

    // 验证权限字段
    const allowedFields = ['exam_permission', 'meal_permission', 'task_permission', 's6_permission'];
    let successCount = 0;
    let failCount = 0;
    const errors = [];

    const updateStmt = db.prepare(`
      UPDATE staff SET
        exam_permission = COALESCE(?, exam_permission),
        meal_permission = COALESCE(?, meal_permission),
        task_permission = COALESCE(?, task_permission),
        s6_permission = COALESCE(?, s6_permission),
        updated_at = datetime('now')
      WHERE employee_id = ?
    `);

    for (const item of permissions) {
      try {
        if (!item.employee_id) {
          failCount++;
          errors.push(`缺少工号: ${JSON.stringify(item).substring(0, 50)}`);
          continue;
        }

        // 验证员工是否存在
        const staff = db.prepare('SELECT id FROM staff WHERE employee_id = ?').get(item.employee_id);
        if (!staff) {
          failCount++;
          errors.push(`工号不存在: ${item.employee_id}`);
          continue;
        }

        const examPerm = item.exam_permission !== undefined ? Number(item.exam_permission) : null;
        const mealPerm = item.meal_permission !== undefined ? Number(item.meal_permission) : null;
        const taskPerm = item.task_permission !== undefined ? Number(item.task_permission) : null;
        const s6Perm = item.s6_permission !== undefined ? Number(item.s6_permission) : null;

        updateStmt.run(examPerm, mealPerm, taskPerm, s6Perm, item.employee_id);
        successCount++;
      } catch (err) {
        failCount++;
        errors.push(`${item.employee_id}: ${err.message}`);
      }
    }

    res.json({
      code: 0,
      msg: `批量更新完成`,
      data: {
        success: successCount,
        fail: failCount,
        errors: errors.slice(0, 20)
      }
    });
  } catch (err) {
    console.error('批量更新权限失败:', err);
    res.status(500).json({
      code: -1,
      msg: '服务器错误',
      data: null
    });
  }
});

module.exports = router;
