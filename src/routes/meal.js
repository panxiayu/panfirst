// src/routes/meal.js - 报餐系统（按日报名，支持中餐/晚餐启用控制）
const express = require('express');
const router = express.Router();
const db = require('../models/database');
const Joi = require('joi');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

// 获取用户ID
const getUserId = (req) => {
  return req.user.type === 'employee' ? req.user.id : req.user.userId;
};

// 验证Schema
const createActivitySchema = Joi.object({
  title: Joi.string().required().max(100),
  start_date: Joi.date().required(),
  end_date: Joi.date().required().min(Joi.ref('start_date')),
  lunch_enabled: Joi.number().integer().min(0).max(1).default(1),
  lunch_signup_start: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/).default('09:00'),
  lunch_signup_end: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/).default('10:30'),
  dinner_enabled: Joi.number().integer().min(0).max(1).default(1),
  dinner_signup_start: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/).default('14:00'),
  dinner_signup_end: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/).default('15:30'),
  is_temporary: Joi.number().integer().min(0).max(1).default(0)
});

const signupSchema = Joi.object({
  date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
  lunch_employee: Joi.number().integer().min(0).default(0),
  lunch_guest: Joi.number().integer().min(0).default(0),
  dinner_employee: Joi.number().integer().min(0).default(0),
  dinner_guest: Joi.number().integer().min(0).default(0),
  guest_reason: Joi.string().max(200).default('')
});

// 创建报餐活动
// POST /api/meal/create
router.post('/create', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { error, value } = createActivitySchema.validate(req.body);
    if (error) {
      return res.status(400).json({ code: -1, msg: error.details[0].message, data: null });
    }

    const { title, lunch_enabled, lunch_signup_start, lunch_signup_end,
            dinner_enabled, dinner_signup_start, dinner_signup_end, is_temporary } = value;

    // 使用原始字符串，不经过 Joi 日期转换
    const start_date = req.body.start_date;
    const end_date = req.body.end_date;

    // deadline 默认为结束日期的 23:59
    const deadline = end_date + ' 23:59:59';

    const stmt = db.prepare(`
      INSERT INTO meal_activities_v4 (title, start_date, end_date, lunch_enabled, lunch_signup_start, lunch_signup_end,
        dinner_enabled, dinner_signup_start, dinner_signup_end, deadline, created_by, is_temporary)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(title, start_date, end_date, lunch_enabled, lunch_signup_start, lunch_signup_end,
      dinner_enabled, dinner_signup_start, dinner_signup_end, deadline, req.user.userId, is_temporary || 0);

    res.json({
      code: 0,
      msg: '报餐活动创建成功',
      data: { id: result.lastInsertRowid, title, start_date, end_date }
    });
  } catch (err) {
    console.error('创建报餐活动失败:', err);
    res.status(500).json({ code: -1, msg: '服务器错误', data: null });
  }
});

// 获取报餐活动列表
// GET /api/meal/list
router.get('/list', authMiddleware, (req, res) => {
  try {
    const isAdmin = req.user.type !== 'employee';
    const userId = getUserId(req);

    // 获取当前用户的客餐权限
    let canGuestMeal = 0;
    if (!isAdmin) {
      const userPerm = db.prepare('SELECT guest_meal_permission FROM staff WHERE id = ?').get(userId);
      canGuestMeal = userPerm?.guest_meal_permission || 0;
    }

    let activities;
    if (isAdmin) {
      activities = db.prepare(`
        SELECT id, title, start_date, end_date, lunch_enabled, lunch_signup_start, lunch_signup_end,
          dinner_enabled, dinner_signup_start, dinner_signup_end, deadline, is_active, is_temporary, created_at
        FROM meal_activities_v4 ORDER BY is_temporary DESC, start_date DESC
      `).all();
    } else {
      activities = db.prepare(`
        SELECT id, title, start_date, end_date, lunch_enabled, lunch_signup_start, lunch_signup_end,
          dinner_enabled, dinner_signup_start, dinner_signup_end, deadline, is_active, is_temporary, created_at
        FROM meal_activities_v4
        WHERE is_active = 1 AND datetime(end_date || ' 23:59:59') >= datetime('now')
        ORDER BY is_temporary DESC, start_date ASC
      `).all();
    }

    const now = new Date();

    const result = activities.map(activity => {
      const deadline = new Date(activity.deadline);
      const endDate = new Date(activity.end_date + ' 23:59:59');
      const isExpired = now > deadline;

      // 检查当前是否在报餐时间段内（使用本地时间）
      const nowTime = now.toTimeString().slice(0, 5);
      const nowDateStr = now.toLocaleDateString('zh-CN').replace(/\//g, '-');

      const isInLunchWindow = activity.lunch_enabled === 1 &&
        nowDateStr >= activity.start_date && nowDateStr <= activity.end_date &&
        nowTime >= activity.lunch_signup_start && nowTime <= activity.lunch_signup_end;

      const isInDinnerWindow = activity.dinner_enabled === 1 &&
        nowDateStr >= activity.start_date && nowDateStr <= activity.end_date &&
        nowTime >= activity.dinner_signup_start && nowTime <= activity.dinner_signup_end;

      // 获取用户今天的报名（包含原由）- 使用本地时间
      const todayStr = now.toLocaleDateString('zh-CN').replace(/\//g, '-');
      const signups = db.prepare(`
        SELECT id, meal_type, employee_count, guest_count, reason FROM meal_signups_v4
        WHERE activity_id = ? AND user_id = ? AND signup_date = ?
      `).all(activity.id, userId, todayStr);

      // 分离员工餐和客餐记录（四种数据完全独立）
      // 员工午餐：meal_type='lunch' 且 employee_count > 0
      // 员工晚餐：meal_type='dinner' 且 employee_count > 0
      // 客餐午餐：meal_type='lunch' 且 guest_count > 0
      // 客餐晚餐：meal_type='dinner' 且 guest_count > 0
      const employeeLunch = signups.find(s => s.meal_type === 'lunch' && s.employee_count > 0);
      const employeeDinner = signups.find(s => s.meal_type === 'dinner' && s.employee_count > 0);
      const guestLunches = signups.filter(s => s.meal_type === 'lunch' && s.guest_count > 0);
      const guestDinners = signups.filter(s => s.meal_type === 'dinner' && s.guest_count > 0);

      return {
        ...activity,
        isExpired,
        canSignupLunch: isInLunchWindow && !isExpired,
        canSignupDinner: isInDinnerWindow && !isExpired,
        canGuestMeal,
        todayEmployeeLunch: employeeLunch || null,
        todayEmployeeDinner: employeeDinner || null,
        todayGuestLunches: guestLunches,
        todayGuestDinners: guestDinners
      };
    });

    res.json({ code: 0, msg: 'success', data: result });
  } catch (err) {
    console.error('获取报餐活动列表失败:', err);
    res.status(500).json({ code: -1, msg: '服务器错误', data: null });
  }
});

// 获取所有报餐活动统计（管理员）- 必须在 /:id 前面定义
// GET /api/meal/all/statistics
router.get('/all/statistics', authMiddleware, adminMiddleware, (req, res) => {
  try {
    const activities = db.prepare(`
      SELECT id, title, start_date, end_date, lunch_enabled, dinner_enabled, deadline, is_temporary
      FROM meal_activities_v4 ORDER BY is_temporary DESC, start_date DESC
    `).all();

    const result = activities.map(activity => {
      const stats = db.prepare(`
        SELECT meal_type,
          COUNT(DISTINCT user_id) as people,
          SUM(employee_count) as employee,
          SUM(guest_count) as guest,
          SUM(employee_count + guest_count) as total
        FROM meal_signups_v4 WHERE activity_id = ?
        GROUP BY meal_type
      `).all(activity.id);

      const lunchStats = stats.find(s => s.meal_type === 'lunch');
      const dinnerStats = stats.find(s => s.meal_type === 'dinner');

      return {
        ...activity,
        statistics: {
          lunch: { people: lunchStats?.people || 0, employee: lunchStats?.employee || 0, guest: lunchStats?.guest || 0, total: lunchStats?.total || 0 },
          dinner: { people: dinnerStats?.people || 0, employee: dinnerStats?.employee || 0, guest: dinnerStats?.guest || 0, total: dinnerStats?.total || 0 },
          combined: {
            people: (lunchStats?.people || 0) + (dinnerStats?.people || 0),
            employee: (lunchStats?.employee || 0) + (dinnerStats?.employee || 0),
            guest: (lunchStats?.guest || 0) + (dinnerStats?.guest || 0),
            total: (lunchStats?.total || 0) + (dinnerStats?.total || 0)
          }
        }
      };
    });

    res.json({ code: 0, msg: 'success', data: result });
  } catch (err) {
    console.error('获取全部报餐统计失败:', err);
    res.status(500).json({ code: -1, msg: '服务器错误', data: null });
  }
});

// 获取我的报餐记录
// GET /api/meal/my-records
router.get('/my-records', authMiddleware, (req, res) => {
  try {
    const userId = getUserId(req);
    const limit = parseInt(req.query.limit) || 5;

    const records = db.prepare(`
      SELECT s.id, s.activity_id, s.signup_date, s.meal_type, s.employee_count, s.guest_count, s.reason, s.created_at,
        a.title, a.is_temporary
      FROM meal_signups_v4 s
      LEFT JOIN meal_activities_v4 a ON s.activity_id = a.id
      WHERE s.user_id = ?
      ORDER BY s.signup_date DESC, s.meal_type DESC
      LIMIT ?
    `).all(userId, limit);

    res.json({ code: 0, msg: 'success', data: records });
  } catch (err) {
    console.error('获取报餐记录失败:', err);
    res.status(500).json({ code: -1, msg: '服务器错误', data: null });
  }
});

// 获取客餐权限列表
// GET /api/meal/guest-permissions
router.get('/guest-permissions', authMiddleware, adminMiddleware, (req, res) => {
  try {
    const staff = db.prepare(`
      SELECT id, employee_id, name, department, team, position, guest_meal_permission
      FROM staff
      WHERE status = 'active'
      ORDER BY employee_id
    `).all();

    const total = staff.length;
    const withPermission = staff.filter(s => s.guest_meal_permission === 1).length;

    res.json({ code: 0, msg: 'success', data: { staff, total, withPermission } });
  } catch (err) {
    console.error('获取客餐权限失败:', err);
    res.status(500).json({ code: -1, msg: '服务器错误', data: null });
  }
});

// 更新客餐权限
// PUT /api/meal/guest-permissions
router.put('/guest-permissions', authMiddleware, adminMiddleware, (req, res) => {
  try {
    const { staff_ids, enabled } = req.body;

    if (!Array.isArray(staff_ids)) {
      return res.status(400).json({ code: -1, msg: '参数错误', data: null });
    }

    const transaction = db.transaction(() => {
      // 先清除所有权限
      db.prepare('UPDATE staff SET guest_meal_permission = 0').run();
      // 再给指定人员加权限
      if (enabled && staff_ids.length > 0) {
        const placeholders = staff_ids.map(() => '?').join(',');
        db.prepare(`UPDATE staff SET guest_meal_permission = 1 WHERE id IN (${placeholders})`).run(...staff_ids);
      }
    });

    transaction();

    res.json({ code: 0, msg: '更新成功', data: null });
  } catch (err) {
    console.error('更新客餐权限失败:', err);
    res.status(500).json({ code: -1, msg: '服务器错误', data: null });
  }
});

// 获取报餐活动详情
// GET /api/meal/:id
router.get('/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;

    const activity = db.prepare(`
      SELECT id, title, start_date, end_date, lunch_enabled, lunch_signup_start, lunch_signup_end,
        dinner_enabled, dinner_signup_start, dinner_signup_end, deadline, is_active, created_at
      FROM meal_activities_v4 WHERE id = ?
    `).get(id);

    if (!activity) {
      return res.status(404).json({ code: -1, msg: '报餐活动不存在', data: null });
    }

    res.json({ code: 0, msg: 'success', data: activity });
  } catch (err) {
    console.error('获取报餐活动详情失败:', err);
    res.status(500).json({ code: -1, msg: '服务器错误', data: null });
  }
});

// 报餐报名（按日）
// POST /api/meal/:id/signup
router.post('/:id/signup', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const { error, value } = signupSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ code: -1, msg: error.details[0].message, data: null });
    }

    const { date, lunch_employee, lunch_guest, dinner_employee, dinner_guest, guest_reason } = value;

    // 检查活动是否存在
    const activity = db.prepare('SELECT * FROM meal_activities_v4 WHERE id = ?').get(id);
    if (!activity) {
      return res.status(404).json({ code: -1, msg: '报餐活动不存在', data: null });
    }

    // 检查日期是否在活动范围内
    if (date < activity.start_date || date > activity.end_date) {
      return res.status(400).json({ code: -1, msg: '日期不在活动范围内', data: null });
    }

    // 检查是否在报名截止前
    const now = new Date();
    const deadline = new Date(activity.deadline);
    if (now > deadline) {
      return res.status(400).json({ code: -1, msg: '报名已截止', data: null });
    }

    // 检查报餐时间段
    const nowTimeStr = now.toTimeString().slice(0, 5);
    const nowMinutes = parseInt(nowTimeStr.slice(0, 2)) * 60 + parseInt(nowTimeStr.slice(3, 5));
    const lunchTotal = lunch_employee + lunch_guest;
    const dinnerTotal = dinner_employee + dinner_guest;

    if (lunchTotal > 0) {
      if (!activity.lunch_enabled) {
        return res.status(400).json({ code: -1, msg: '中餐未启用', data: null });
      }
      const lunchStart = parseInt(activity.lunch_signup_start.slice(0, 2)) * 60 + parseInt(activity.lunch_signup_start.slice(3, 5));
      const lunchEnd = parseInt(activity.lunch_signup_end.slice(0, 2)) * 60 + parseInt(activity.lunch_signup_end.slice(3, 5));
      if (nowMinutes < lunchStart || nowMinutes > lunchEnd) {
        return res.status(400).json({ code: -1, msg: `中餐报餐时间 ${activity.lunch_signup_start} - ${activity.lunch_signup_end}`, data: null });
      }
    }

    if (dinnerTotal > 0) {
      if (!activity.dinner_enabled) {
        return res.status(400).json({ code: -1, msg: '晚餐未启用', data: null });
      }
      const dinnerStart = parseInt(activity.dinner_signup_start.slice(0, 2)) * 60 + parseInt(activity.dinner_signup_start.slice(3, 5));
      const dinnerEnd = parseInt(activity.dinner_signup_end.slice(0, 2)) * 60 + parseInt(activity.dinner_signup_end.slice(3, 5));
      if (nowMinutes < dinnerStart || nowMinutes > dinnerEnd) {
        return res.status(400).json({ code: -1, msg: `晚餐报餐时间 ${activity.dinner_signup_start} - ${activity.dinner_signup_end}`, data: null });
      }
    }

    // 注意：lunchTotal/dinnerTotal 为 0 时会在下面事务中删除对应记录，这是正常的取消报名操作
    // 检查客餐权限
    const userId = getUserId(req);
    const isAdmin = req.user.type !== 'employee';
    if (!isAdmin) {
      const userPerm = db.prepare('SELECT guest_meal_permission FROM staff WHERE id = ?').get(userId);
      const canGuest = userPerm?.guest_meal_permission || 0;

      if ((lunch_guest > 0 || dinner_guest > 0) && !canGuest) {
        return res.status(400).json({ code: -1, msg: '您没有客餐报餐权限', data: null });
      }
    }

    // 获取已存在的报名数据用于合并
    const existingLunch = db.prepare(`SELECT id, employee_count, guest_count FROM meal_signups_v4 WHERE activity_id = ? AND user_id = ? AND signup_date = ? AND meal_type = 'lunch'`).get(id, userId, date);
    const existingDinner = db.prepare(`SELECT id, employee_count, guest_count FROM meal_signups_v4 WHERE activity_id = ? AND user_id = ? AND signup_date = ? AND meal_type = 'dinner'`).get(id, userId, date);

    // 检查请求中是否包含这些字段（而不是依赖 Joi 默认值）
    const hasLunchEmployee = req.body.hasOwnProperty('lunch_employee');
    const hasLunchGuest = req.body.hasOwnProperty('lunch_guest');
    const hasDinnerEmployee = req.body.hasOwnProperty('dinner_employee');
    const hasDinnerGuest = req.body.hasOwnProperty('dinner_guest');

    // 客餐原由
    const guestReason = req.body.guest_reason || '';

    // 员工餐：独立记录，只更新自己的count，不影响客餐
    const finalLunchEmployee = hasLunchEmployee ? lunch_employee : (existingLunch?.employee_count || 0);
    const finalDinnerEmployee = hasDinnerEmployee ? dinner_employee : (existingDinner?.employee_count || 0);

    // 事务处理：四种数据完全独立
    const transaction = db.transaction(() => {
      // 员工午餐：独立记录，只写employee_count，guest_count=0
      if (finalLunchEmployee > 0) {
        db.prepare(`
          INSERT OR REPLACE INTO meal_signups_v4 (id, activity_id, user_id, signup_date, meal_type, employee_count, guest_count, reason)
          VALUES (?, ?, ?, ?, 'lunch', ?, 0, NULL)
        `).run(existingLunch?.id || null, id, userId, date, finalLunchEmployee);
      } else if (existingLunch && existingLunch.employee_count > 0) {
        db.prepare(`DELETE FROM meal_signups_v4 WHERE id = ?`).run(existingLunch.id);
      }

      // 员工晚餐：独立记录，只写employee_count，guest_count=0
      if (finalDinnerEmployee > 0) {
        db.prepare(`
          INSERT OR REPLACE INTO meal_signups_v4 (id, activity_id, user_id, signup_date, meal_type, employee_count, guest_count, reason)
          VALUES (?, ?, ?, ?, 'dinner', ?, 0, NULL)
        `).run(existingDinner?.id || null, id, userId, date, finalDinnerEmployee);
      } else if (existingDinner && existingDinner.employee_count > 0) {
        db.prepare(`DELETE FROM meal_signups_v4 WHERE id = ?`).run(existingDinner.id);
      }

      // 客餐午餐：独立记录，employee_count=0
      if (lunch_guest > 0 && guestReason) {
        db.prepare(`
          INSERT INTO meal_signups_v4 (activity_id, user_id, signup_date, meal_type, employee_count, guest_count, reason)
          VALUES (?, ?, ?, 'lunch', 0, ?, ?)
        `).run(id, userId, date, lunch_guest, guestReason);
      }

      // 客餐晚餐：独立记录，employee_count=0
      if (dinner_guest > 0 && guestReason) {
        db.prepare(`
          INSERT INTO meal_signups_v4 (activity_id, user_id, signup_date, meal_type, employee_count, guest_count, reason)
          VALUES (?, ?, ?, 'dinner', 0, ?, ?)
        `).run(id, userId, date, dinner_guest, guestReason);
      }
    });

    transaction();

    res.json({
      code: 0,
      msg: '报餐成功',
      data: { lunch: { employee: lunch_employee, guest: lunch_guest }, dinner: { employee: dinner_employee, guest: dinner_guest } }
    });
  } catch (err) {
    console.error('报餐失败:', err);
    res.status(500).json({ code: -1, msg: '服务器错误', data: null });
  }
});

// 删除单条报餐记录
// DELETE /api/meal/:id/signup/:recordId
router.delete('/:id/signup/:recordId', authMiddleware, (req, res) => {
  try {
    const { id, recordId } = req.params;
    const userId = getUserId(req);

    // 检查记录是否存在且属于当前用户
    const record = db.prepare(`
      SELECT id, meal_type, employee_count, guest_count FROM meal_signups_v4
      WHERE id = ? AND activity_id = ? AND user_id = ?
    `).get(recordId, id, userId);

    if (!record) {
      return res.status(404).json({ code: -1, msg: '记录不存在', data: null });
    }

    db.prepare(`DELETE FROM meal_signups_v4 WHERE id = ?`).run(recordId);

    res.json({ code: 0, msg: '已取消报餐', data: null });
  } catch (err) {
    console.error('取消报餐失败:', err);
    res.status(500).json({ code: -1, msg: '服务器错误', data: null });
  }
});

// 获取报餐统计（按日）
// GET /api/meal/:id/statistics
router.get('/:id/statistics', authMiddleware, adminMiddleware, (req, res) => {
  try {
    const { id } = req.params;

    const activity = db.prepare(`
      SELECT id, title, start_date, end_date, lunch_enabled, lunch_signup_start, lunch_signup_end,
        dinner_enabled, dinner_signup_start, dinner_signup_end, deadline, is_active
      FROM meal_activities_v4 WHERE id = ?
    `).get(id);

    if (!activity) {
      return res.status(404).json({ code: -1, msg: '报餐活动不存在', data: null });
    }

    // 按日期和餐次统计
    const dailyStats = db.prepare(`
      SELECT signup_date, meal_type,
        COUNT(DISTINCT user_id) as people,
        SUM(employee_count) as employee,
        SUM(guest_count) as guest,
        SUM(employee_count + guest_count) as total
      FROM meal_signups_v4
      WHERE activity_id = ?
      GROUP BY signup_date, meal_type
      ORDER BY signup_date
    `).all(id);

    // 获取每日每餐的员工详情
    const dailyDetails = db.prepare(`
      SELECT s.signup_date, s.meal_type, s.employee_count, s.guest_count,
        st.employee_id, st.name, st.department, st.team, st.position
      FROM meal_signups_v4 s
      LEFT JOIN staff st ON s.user_id = st.id
      WHERE s.activity_id = ? AND s.employee_count > 0
      ORDER BY s.signup_date, s.meal_type
    `).all(id);

    // 按日期和餐次分组员工详情
    const detailsMap = {};
    dailyDetails.forEach(d => {
      const key = `${d.signup_date}_${d.meal_type}`;
      if (!detailsMap[key]) {
        detailsMap[key] = [];
      }
      if (d.employee_id) {
        detailsMap[key].push({
          employee_id: d.employee_id,
          name: d.name,
          department: d.department || '',
          team: d.team || '',
          position: d.position || '',
          count: d.employee_count
        });
      }
    });

    // 按日期分组
    const statsMap = {};
    dailyStats.forEach(s => {
      if (!statsMap[s.signup_date]) {
        statsMap[s.signup_date] = { lunch: null, dinner: null };
      }
      const key = `${s.signup_date}_${s.meal_type}`;
      statsMap[s.signup_date][s.meal_type] = {
        people: s.people,
        employee: s.employee || 0,
        guest: s.guest || 0,
        total: s.total || 0
      };
    });

    // 生成日期范围内的所有日期（使用本地时间）
    const dates = [];
    const start = new Date(activity.start_date);
    const end = new Date(activity.end_date);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      dates.push(`${year}-${month}-${day}`);
    }

    // 总计（四个字段完全独立）
    const lunchStats = dailyStats.filter(s => s.meal_type === 'lunch');
    const dinnerStats = dailyStats.filter(s => s.meal_type === 'dinner');
    const totals = {
      lunch_employee: lunchStats.reduce((acc, s) => acc + (s.employee || 0), 0),
      lunch_guest: lunchStats.reduce((acc, s) => acc + (s.guest || 0), 0),
      dinner_employee: dinnerStats.reduce((acc, s) => acc + (s.employee || 0), 0),
      dinner_guest: dinnerStats.reduce((acc, s) => acc + (s.guest || 0), 0)
    };

    res.json({
      code: 0,
      msg: 'success',
      data: {
        activity,
        dates,
        dailyStats: statsMap,
        dailyDetails: detailsMap,
        totals
      }
    });
  } catch (err) {
    console.error('获取报餐统计失败:', err);
    res.status(500).json({ code: -1, msg: '服务器错误', data: null });
  }
});

// 更新报餐活动（中餐/晚餐启用控制）
// PUT /api/meal/:id
router.put('/:id', authMiddleware, adminMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const { lunch_enabled, dinner_enabled } = req.body;

    const activity = db.prepare('SELECT * FROM meal_activities_v4 WHERE id = ?').get(id);
    if (!activity) {
      return res.status(404).json({ code: -1, msg: '报餐活动不存在', data: null });
    }

    if (lunch_enabled !== undefined) {
      db.prepare('UPDATE meal_activities_v4 SET lunch_enabled = ? WHERE id = ?').run(lunch_enabled ? 1 : 0, id);
    }
    if (dinner_enabled !== undefined) {
      db.prepare('UPDATE meal_activities_v4 SET dinner_enabled = ? WHERE id = ?').run(dinner_enabled ? 1 : 0, id);
    }

    res.json({ code: 0, msg: '更新成功', data: null });
  } catch (err) {
    console.error('更新报餐活动失败:', err);
    res.status(500).json({ code: -1, msg: '服务器错误', data: null });
  }
});

// 删除报餐活动
// DELETE /api/meal/:id
router.delete('/:id', authMiddleware, adminMiddleware, (req, res) => {
  try {
    const { id } = req.params;

    const activity = db.prepare('SELECT * FROM meal_activities_v4 WHERE id = ?').get(id);
    if (!activity) {
      return res.status(404).json({ code: -1, msg: '报餐活动不存在', data: null });
    }

    db.prepare('DELETE FROM meal_signups_v4 WHERE activity_id = ?').run(id);
    db.prepare('DELETE FROM meal_activities_v4 WHERE id = ?').run(id);

    res.json({ code: 0, msg: '删除成功', data: null });
  } catch (err) {
    console.error('删除报餐活动失败:', err);
    res.status(500).json({ code: -1, msg: '服务器错误', data: null });
  }
});

module.exports = router;