// src/models/database.js
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// 数据文件路径 - 使用绝对路径，基于当前文件位置
const dbPath = path.resolve(__dirname, '../../data/exam.db');

// 确保数据目录存在
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

console.log('📁 数据库路径:', dbPath, 'CWD:', process.cwd());

// 连接数据库
let db;
try {
  db = new Database(dbPath);
  console.log('✅ 数据库连接成功');
} catch (err) {
  console.error('❌ 数据库连接失败:', err.message);
  process.exit(1);
}

// 启用外键约束
db.pragma('foreign_keys = ON');

// 初始化数据库（如果不存在则创建表）
function initDatabase() {
  try {
    console.log('🔧 初始化数据库...');

    // 检查是否已初始化
    const tables = db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `).all();

    if (tables.length > 0) {
      console.log('✅ 数据库已初始化，表数:', tables.length);
      // 初始化后续检查（如新增字段/表）
      initUsersColumns();
      initMealActivitiesColumns();
      initVotingTables();
      return;
    }

    // 读取 SQL 初始化脚本
    const sqlPath = path.join(__dirname, '../../data/init.sql');
    if (fs.existsSync(sqlPath)) {
      console.log(`📄 执行初始化脚本: init.sql`);
      const sql = fs.readFileSync(sqlPath, 'utf-8');
      db.exec(sql);
      console.log('✅ 数据库初始化完成');
      // 初始化后续检查
      initUsersColumns();
      initMealActivitiesColumns();
      initVotingTables();
    } else {
      console.error('❌ 未找到 init.sql');
      throw new Error('初始化脚本不存在');
    }
  } catch (err) {
    console.error('❌ 数据库初始化失败:', err.message);
    throw err;
  }
}

// 初始化 users 表缺失的列
function initUsersColumns() {
  try {
    const columns = db.prepare("PRAGMA table_info(users)").all();
    const columnNames = columns.map(c => c.name);

    if (!columnNames.includes('status')) {
      db.exec("ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active'");
      console.log('✅ users 表新增 status 字段');
    }
    if (!columnNames.includes('can_manage_file')) {
      db.exec("ALTER TABLE users ADD COLUMN can_manage_file INTEGER DEFAULT 0");
      console.log('✅ users 表新增 can_manage_file 字段');
    }
  } catch (err) {
    console.error('❌ initUsersColumns 失败:', err.message);
  }
}

// 初始化 meal_activities_v4 表缺失的列
function initMealActivitiesColumns() {
  try {
    const columns = db.prepare("PRAGMA table_info(meal_activities_v4)").all();
    const columnNames = columns.map(c => c.name);

    if (!columnNames.includes('is_temporary')) {
      db.exec("ALTER TABLE meal_activities_v4 ADD COLUMN is_temporary INTEGER DEFAULT 0");
      console.log('✅ meal_activities_v4 表新增 is_temporary 字段');
    }
  } catch (err) {
    console.error('❌ initMealActivitiesColumns 失败:', err.message);
  }
}

// 初始化投票相关表和字段
function initVotingTables() {
  try {
    // 检查 votings 表是否有 anonymous_token 字段
    const votingsColumns = db.prepare("PRAGMA table_info(votings)").all();
    const hasAnonymousToken = votingsColumns.some(col => col.name === 'anonymous_token');
    if (!hasAnonymousToken) {
      // SQLite不支持ALTER TABLE ADD COLUMN添加UNIQUE列，需要重建表
      // 这里先用不带UNIQUE的方式添加列，然后单独创建索引
      db.exec("ALTER TABLE votings ADD COLUMN anonymous_token TEXT");
      console.log('✅ votings 表新增 anonymous_token 字段');
      // 创建唯一索引
      db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_votings_anonymous_token ON votings(anonymous_token)");
      console.log('✅ anonymous_token 唯一索引已创建');
    }

    // 检查 voting_records 表结构，移除阻止匿名投票的UNIQUE约束
    const recordsInfo = db.prepare("PRAGMA index_list(voting_records)").all();
    const hasUniqueConstraint = recordsInfo.some(idx => idx.unique === 1);
    if (hasUniqueConstraint) {
      // 重建 voting_records 表，移除 UNIQUE 约束
      // 先备份数据
      const records = db.prepare("SELECT * FROM voting_records").all();
      // 删除旧表
      db.exec("DROP TABLE voting_records");
      // 用不带 UNIQUE 约束的方式重建表
      db.exec(`
        CREATE TABLE IF NOT EXISTS voting_records (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          voting_id INTEGER NOT NULL,
          user_id INTEGER NOT NULL,
          option_id INTEGER,
          device_token TEXT,
          employee_id TEXT,
          employee_name TEXT,
          voted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (voting_id) REFERENCES votings(id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);
      // 恢复数据（注意：旧数据的 option_ids 需要拆分，这里简化处理只保留第一条记录的 option_id）
      const insertStmt = db.prepare(`
        INSERT INTO voting_records (id, voting_id, user_id, option_id, device_token, employee_id, employee_name, voted_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      records.forEach(r => {
        // 旧数据 option_ids 是逗号分隔，取第一个作为 option_id
        const firstOptId = r.option_ids ? parseInt(r.option_ids.split(',')[0]) : null;
        insertStmt.run(r.id, r.voting_id, r.user_id, firstOptId, r.device_token, r.employee_id, r.employee_name, r.voted_at);
      });
      // 重建索引
      db.exec("CREATE INDEX IF NOT EXISTS idx_voting_records_voting_id ON voting_records(voting_id)");
      db.exec("CREATE INDEX IF NOT EXISTS idx_voting_records_user_id ON voting_records(user_id)");
      console.log('✅ voting_records 表已重建，移除了阻止匿名投票的 UNIQUE 约束');
    }

    // 检查 voting_records 表是否有新字段
    const recordsColumns = db.prepare("PRAGMA table_info(voting_records)").all();
    if (!recordsColumns.some(col => col.name === 'device_token')) {
      db.exec("ALTER TABLE voting_records ADD COLUMN device_token TEXT");
      console.log('✅ voting_records 表新增 device_token 字段');
    }
    if (!recordsColumns.some(col => col.name === 'employee_id')) {
      db.exec("ALTER TABLE voting_records ADD COLUMN employee_id TEXT");
      console.log('✅ voting_records 表新增 employee_id 字段');
    }
    if (!recordsColumns.some(col => col.name === 'employee_name')) {
      db.exec("ALTER TABLE voting_records ADD COLUMN employee_name TEXT");
      console.log('✅ voting_records 表新增 employee_name 字段');
    }

    // 创建匿名投票设备记录表
    db.exec(`
      CREATE TABLE IF NOT EXISTS voting_device_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        voting_id INTEGER NOT NULL,
        device_token TEXT NOT NULL,
        employee_id TEXT,
        employee_name TEXT,
        voted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(voting_id, device_token)
      )
    `);
    console.log('✅ voting_device_tokens 表已创建/存在');
  } catch (err) {
    console.error('❌ 初始化投票表失败:', err.message);
  }
}

// 执行初始化
try {
  initDatabase();
  // 设置 WAL 模式提高性能
  db.pragma('journal_mode = WAL');
  console.log('✅ 数据库配置完成');
} catch (err) {
  console.error('❌ 初始化失败，退出程序');
  process.exit(1);
}

module.exports = db;
