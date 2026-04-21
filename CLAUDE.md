# 当前工作进度追踪

> 本文件由 Claude Code 自动维护。每次对话结束时更新。

---

## 当前任务

- 暂无紧急任务

## 待办

- [ ] 食堂统计页面：专门给食堂看的页面，总份数统计
- [ ] 打卡对账功能：打卡数据导入，自动比对报餐/未报/异常

## 学习资料路由重构（2026-04-16）

### 已完成
- 路由路径：`/api/learning-tasks` → `/api/learning-materials`
- 路由文件：`src/routes/learning-task.js` → `src/routes/learning-material.js`
- 权限API：`/api/permissions/learning-tasks` → `/api/permissions/learning-materials`
- 新增移动端页面：
  - `mobile-learning-materials-list.html` - 学习资料列表
  - `mobile-learning-materials-detail.html` - 学习资料详情（视频播放、禁止快进）
- PC端详情页：`learning-materials-detail.html`（CSS与exam.html一致）
- `employee.html` 学习任务入口改为学习资料

### 视频播放功能
- 支持播放进度保存
- 禁止快进（只能后退），防止跳跃观看
- 完成学习后弹出参加考试提示

### exam.html 培训管理
- 标签页：培训记录 → 培训任务 → 学习资料 → 题库管理
- 新建培训需绑定学习资料和题库
- 点击学习资料卡片跳转 `learning-materials-detail.html?id=X`

### docx导入修复
- `src/routes/import.js`：使用 `mammoth.convertToHtml` 替代 `extractRawText` 解决中文乱码

---

## 权限管理页面重构（2026-04-16）

### 报餐权限标签页重构
- 删除"细粒度权限（按活动）"部分（员工餐默认全员）
- 保留客餐权限全局配置
- 客餐权限列表：全选复选框 + 分列显示（工号90px、姓名70px、部门120px、班组flex）
- 滚动条样式与人员管理一致
- 保存权限按钮（点击才保存）
- 搜索框：工号/姓名全局搜索 + 部门班组下拉框（联动筛选）

### 6S权限标签页重构
- 删除全员列表，改为管理员添加样式
- "+ 添加6S权限"按钮只在6S标签页显示
- 添加弹窗：工号输入 + 姓名只读自动匹配 + 保存
- 权限员工列表：头像+姓名+工号/部门+删除按钮

### 添加管理员弹窗优化
- 弹窗宽度缩小：`max-width: 340px; padding: 16px`
- 工号、密码必填
- 姓名自动匹配：输入工号匹配姓名、输入姓名匹配工号（双向模糊搜索）
- 使用 `/api/staff?search=` 查询

### 6S权限添加弹窗优化
- 姓名框开放输入
- 工号、姓名双向自动匹配
- 新增 `POST /api/permissions/s6` API（添加单人不清除其他权限）
- 修复原 `POST /api/permissions/s6/batch` 会清除所有6S权限的问题

### users表字段补充
- 数据库：`init.sql` 和 `database.js` 新增 `status`、`can_manage_file` 字段
- admin.js 移除 `email` 字段相关代码

### 修改文件
- `public/permission-list.html` - 报餐权限、6S权限、管理员添加弹窗
- `public/js/permission-check.js` - 权限配置
- `public/page-relationship.html` - 页面关系图
- `src/routes/admin.js` - 移除email
- `src/routes/granular-permissions.js` - 新增 POST /s6 API
- `src/models/database.js` - initUsersColumns()
- `data/init.sql` - users表定义

---

## 投票系统功能（2026-04-16）

### 已完成
- 数据库：
  - `votings` 表新增 `anonymous_token` 字段和唯一索引
  - `voting_records` 表重建（移除阻止匿名投票的 UNIQUE 约束），新增 `device_token`、`employee_id`、`employee_name`、`option_id` 字段
  - 新建 `voting_device_tokens` 表
- 后端 API：
  - `/api/voting/create` 支持 `isAnonymous` 参数
  - `/api/voting/list` 返回 `isAnonymous`、`anonymousToken`、`anonymousUrl` 字段
  - `/api/voting/:id` 返回 `isAnonymous` 字段
  - `/api/voting/:id` PUT 更新投票（新增）
  - `/api/voting/:id/voters` 获取投票人详情（管理员）
  - `/api/voting/anonymous/:token` 公开获取投票信息（无需登录）
  - `/api/voting/anonymous/:token/vote` 匿名投票提交
  - `/api/voting/anonymous/:token/results` 公开投票结果
  - 修复 `option_ids` → `option_id` 字段名错误
  - 匿名链接自动适配访问域名（HTTP Host 头）
- 前端（后台管理）：
  - 投票卡片：状态/匿名/多选标签、投票ID、进行中标签、编辑按钮、复制链接按钮
  - 点击卡片弹出详情弹窗：显示投票人数（实时刷新3秒）、投票结果按钮
  - 编辑功能：弹窗修改标题/描述/时间/匿名/多选/投票次数/选项
  - 防双击：创建/编辑按钮提交后禁用
- 前端（移动端）：
  - `mobile-voting-list.html` - 投票列表
  - `mobile-voting.html` - 投票页（匿名/非匿名）
  - `mobile-voting-result.html` - 结果页（3秒轮询）
  - `employee.html` - 员工入口添加投票模块
- `voting-detail.html` 改为纯结果展示页（去掉投票功能）

### 修改文件
- `src/routes/voting.js` - 新增 PUT /:id、更新数据库初始化逻辑
- `src/models/database.js` - 重建 voting_records 表
- `public/voting-list.html` - 编辑弹窗、详情弹窗
- `public/js/voting-list.js` - 卡片渲染、详情弹窗、编辑功能
- `public/voting-detail.html` - 改为纯结果展示

---

## 报餐系统优化（2026-04-16）

### PC端管理页面
- 按钮改为"+ 特殊报餐"（绿色）和"+ 常规报餐"（蓝色）
- 创建弹窗标题根据类型显示"特殊报餐"或"常规报餐"
- 卡片统计区改为：午餐/晚餐/客餐 三列显示
- 特殊报餐卡片：淡抹茶色背景、绿色边框
- 常规报餐：白色背景
- 每张卡片有阴影和立体感效果
- 复选框：默认显示，勾选后常驻，刷新保持选中状态

### 卡片分组逻辑
- 按月份+类型分组，每个月每类型只有一张卡片
- 特殊报餐始终排在常规报餐前面
- 同日期范围同类型不可重复创建（日期重叠检查）

### 批量删除功能
- 工具栏右上角"删除选中"按钮（红色），有选中项时显示
- 复选框常驻显示，勾选后刷新保持状态

### Toast提示
- 位于页面顶部居中
- 红色背景，3秒后自动消失
- 创建成功/删除成功不弹提示

### 移动端页面
- 餐段：中餐→午餐，保留晚餐
- 员工餐流程：选择午餐/晚餐 → 确认提交
- 客餐流程：点击"申请客餐" → 弹窗填写人数和缘由 → 提交申请
- 手机端食堂查看页面：`mobile-meal-view.html`

### 修改文件
- `src/routes/meal.js` - 支持 is_temporary 参数，列表按特殊优先排序
- `src/models/database.js` - initMealActivitiesColumns()
- `public/meal-list.html` - 卡片布局、批量删除、Toast提示
- `public/mobile-meal-list.html` - 员工餐简化、客餐申请弹窗
- `public/mobile-meal-view.html` - 食堂查看页面

---

## 数据库 Schema 注意事项

### meal_signups_v4 表（报餐签到）
实际列：`id, activity_id, user_id, signup_date, meal_type, employee_count, guest_count, reason, created_at`

**注意**：
- 用 `user_id` 不是 `staff_id`
- 用 `employee_count/guest_count` 不是 `employee_meal_lunch/dinner`
- 四种数据完全独立：员工午餐(employee_count>0, guest_count=0)、员工晚餐、客餐午餐(guest_count>0, employee_count=0)、客餐晚餐
- reason 字段存储客餐原由，员工餐为 NULL

---

## 注意事项

- 只使用 `theme.css`（浅色主题），不要引入 `linear.css`
- 冻结列实现使用 `position: sticky`，不要用其他方案
- 列配置通过 `POST /api/staff/column-config` 持久化到后端
- 筛选器有 200ms 防抖，不要手动加 setTimeout
- **数据库 staff 表没有 `s6_permission` 列**，代码中如有引用会报错

---

## 项目关键路径

| 资源 | 路径 |
|------|------|
| 主系统 | `http://112.16.178.98:3000` |
| 文件服务 | `http://112.16.178.98:3001` |
| 员工列表页 | `public/staff-list.html` |
| API 封装 | `public/js/api.js` |
| 主题样式 | `public/css/theme.css` |
| 页面关系图 | `public/page-relationship.html` |

---

## 数据库 Schema 注意事项

### staff 表
数据库实际列：`id, name, employee_id, phone, department_id, position_id, hire_date, exam_permission, meal_permission, status, created_at, updated_at, department(TEXT), team(TEXT), position(TEXT), id_card, gender, birthday, nationality, household, address, education, major, graduate_school, contract_signed, contract_period, category, bank_account, task_permission, s6_permission, guest_meal_permission`

### meal_signups_v4 表（报餐签到）
实际列：`id, activity_id, user_id, signup_date, meal_type, employee_count, guest_count, created_at`

**注意**：
- 用 `user_id` 不是 `staff_id`
- 用 `employee_count/guest_count` 不是 `employee_meal_lunch/dinner`

### six_s_records 表（6S曝光）
如果不存在需创建：
```sql
CREATE TABLE IF NOT EXISTS six_s_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_code TEXT,
  description TEXT,
  person_charge TEXT,
  status TEXT DEFAULT 'pending',
  before_image TEXT,
  after_image TEXT,
  area TEXT,
  created_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

### 路由顺序问题
Express 路由匹配按定义顺序，`/:id` 会匹配到 `/permission-fields` 等特定路径。**必须把特定路径放在 `/:id` 前面**。

---

## 历史记录格式

每次完成工作时，在下方追加记录：

```
## 2026-04-XX 完成

- 完成了 xxx 功能
- 修改了 xxx 文件
```

---

## 2026-04-21 完成

### meal.js 后端修复
- 修复 INSERT OR REPLACE 语句列顺序错误（date/meal_type 颠倒）
- 修复变量名不匹配：`todayGuestLunches` → `guestLunches`
- 数据库迁移：添加 reason 列，移除 UNIQUE 约束中的 meal_type

### 报餐数据独立性
- 员工午餐/晚餐：独立记录，employee_count>0, guest_count=0
- 客餐午餐/晚餐：独立记录，guest_count>0, employee_count=0
- 取消员工餐不影响客餐数据，反之亦然

### mobile-meal-list.html UI优化
- "报餐中"和报餐时间在卡片整个宽度内居中
- 日期框改为绝对定位贴在左侧
- 移除报餐记录的绿色勾
- info-check 设置 min-width: 90px 统一标签宽度
- info-count 设置 min-width: 50px + text-align: right 对齐"人"字
- info-reason margin-left: 16px 后移

### 客餐申请优化
- 数字框从0开始，不累加已有客餐人数
- 显示"已报客餐X人"作为参考信息
- 切换午餐/晚餐时重置数字框

---

## 2026-04-20 完成

### meal.js 修复
- 移除 +480 时区偏移（容器已配置 TZ=Asia/Shanghai）
- 修复路由顺序：`/my-records` 需放在 `/:id` 之前
- 修复分别报名不同餐次时数据被覆盖问题：
  - 使用 `hasOwnProperty` 判断哪些字段实际提交
  - 分别处理 lunch_employee、lunch_guest、dinner_employee、dinner_guest

### mobile-meal-list.html UI
- 日历视图展示报餐记录
- 每种餐次独立卡片（午餐、晚餐、客餐-午、客餐-晚）
- 黑色文字 + 绿色对勾图标
- 卡片间分隔线

### 报餐系统优化（9条需求全部完成）

**需求1: 新建报餐数据覆盖修复**
- submitEmployee() 现在保留其他餐次数据，只更新当前餐次

**需求2: 右滑取消报餐**
- 今日报餐卡片支持右滑显示取消按钮
- 新增 cancelByType() 函数处理不同餐次/客餐取消
- 触摸事件处理：右滑超过40px触发取消按钮

**需求3: 客餐页面午餐/晚餐按钮**
- 客餐申请页面新增午餐/晚餐切换按钮
- 新增 switchGuestType() 和 cancelGuest() 函数
- 客餐数据独立处理，不覆盖员工餐数据

**需求4: PC端特殊报餐卡片独立显示**
- 特殊报餐每个活动独立一张卡片，不再按月份叠加
- 常规报餐仍按月份分组

**需求5: 字段独立性**
- meal.js API totals 改为独立字段：lunch_employee, lunch_guest, dinner_employee, dinner_guest
- meal-list.html 和 mobile-meal-view.html 相应更新

**需求6: 日历标记规则**
- 午餐：小黄点 (#f59e0b)
- 晚餐：小蓝点 (#3b82f6)
- 客餐：小绿点 (#10b981)

**需求7: 日历上方统计卡片**
- 日历顶部显示午餐/晚餐/客餐三项统计数据
- 渐变背景色区分不同餐次

**需求8: 日期格子点击动画**
- 点击日期弹出详情层，带滑入动画
- 详情层顶部显示当日三项统计汇总

**需求9: 日历下滑膨胀**
- 日历下滑超过60px自动膨胀至全屏
- 展开后每个日期格子显示当日三项统计数字
- 右上角关闭按钮收起日历

## 2026-04-14 完成

### 页面样式优化
- staff-list.html 全局搜索栏改为圆角矩形 (`border-radius:10px`)
- staff-list.html 表体容器固定高度 `calc(100vh - 140px)`，搜索时不跳动
- 移除页面左侧边栏：`staff-list.html`、`6s-list.html`、`admin-list.html`

### API修复
- staff/:id - 修复 `meal_orders` 旧表查询，改用 `meal_signups_v4`
- meal/guest-permissions - 修复 `status = 1` → `status = 'active'`
- permissions/s6 - 移除不存在的 `s6_permissions` 表依赖，改用 `staff.s6_permission`
- permissions/meals - 修复 `meal_activities` → `meal_activities_v4`
- admin/list - 移除不存在的 `can_manage_file` 字段
- 6s/ - 创建缺失的 `six_s_records` 表

### 修复文件
- `src/routes/staff.js`
- `src/routes/meal.js`
- `src/routes/granular-permissions.js`
- `src/routes/admin.js`
- `public/staff-list.html`
- `public/6s-list.html`
- `public/admin-list.html`

### exam.html 培训管理重构
- 标签页顺序：培训记录 → 培训任务 → 学习资料 → 题库管理
- 培训记录：新增 `/api/learning-tasks/my-records` 接口，显示任务达成率
- 新建培训：必须选择学习资料和题库才能创建
- 创建学习资料弹窗：资料标题、资料描述、上传视频文件
- 修复 `/api/learning-task` → `/api/learning-tasks` 路径问题
- 修复 `learning_tasks` 表 `file_type`/`file_url` 可为NULL迁移

### 修复的文件
- `src/routes/learning-task.js` - 新增my-records接口，修复API路径
- `src/routes/upload.js` - 学习资料上传接口
- `public/exam.html` - 标签页和按钮调整
- `public/js/exam.js` - 弹窗表单和API调用

---

## 2026-04-10 完成

### staff-list.html 显示列功能优化
- 展开全部按钮改为两列布局，点击展开全部时带动画效果
- 下拉框默认单列滚动查看，展开全部时切换为两列
- 修复拖拽列时表体数据同步更新

### staff-list.html 筛选功能优化
- 工龄排序改为按年转换为月计算
- 取消筛选时清空入职日期手动输入
- 入职日期下拉框底框去掉
- "仅筛选此事选此事"按钮文字修正为"仅筛选此事"

### staff-list.html 样式优化
- 表头与冻结列 z-index 调整，解决向右拖动时冻结失效
- 表头颜色加深，与表体文字颜色统一

### learning-task-detail.html 修改
- 返回按钮指向 exam.html
- 去掉"导入学习人员"按钮
- "人员学习情况"改为"学习进度"，分为未开始、进行中、已完成三组，按人员进度比例展示

---

## 2026-04-09 完成

### 登录跳转地址改为域名
- 员工登录后跳转：`https://xlmould.panxy.online/`（而非 IP）
- 修改文件：`index.html`、`employee.html`、`admin/login.html`、`dashboard.html`
- 原因：腾讯/微信仍会拦截 IP 地址跳转，改为域名避免警告

## 2026-04-08 完成

### 服务器安全加固
- 安装 fail2ban，SSH 端口 2222，失败10次封禁24小时
- 服务器 crontab 已添加自动同步任务：每天 11:50 和 18:00 执行 `POST /api/staff/sync-from-smb`
- 日志输出到 `/tmp/staff-sync.log`

### 访问策略调整（域名入口 + 域名内部跳转）
- 入口：`https://xlmould.panxy.online`（过微信验证）
- 登录后跳转：`https://xlmould.panxy.online/`（改用域名避免腾讯拦截）
- 修改文件：`redirect.html`（二维码+URL）、`index.html`（员工登录跳转）、`admin/login.html`（管理员登录跳转）、`dashboard.html`（管理员登出跳转）、`employee.html`（员工登出跳转）
- `qrcode.png` 已重新生成为 `http://112.16.178.98/` 二维码

### staff-list.html 新增功能
- 页面标题旁显示上次同步时间（`localStorage.getItem('staffLastSyncTime')`）
- 同步成功后自动更新时间戳

### 移动端学习任务/考试开发确认完成

确认以下页面已存在且功能完整：
- `employee.html` - 员工入口（含粒化权限检查）
- `mobile-learning-task-list.html` - 学习任务列表
- `mobile-learning-task-detail.html` - 视频播放/学习进度/禁止快进
- `mobile-exam-list.html` - 考试列表（含前置检查：需完成所有学习任务）
- `mobile-exam-doing.html` - 答题界面（计时器、答题卡）
- `mobile-result.html` - 考试成绩

粒化权限 API 已就绪：
- `/api/permissions/learning-tasks` - 返回 has_perm
- `/api/permissions/exams` - 返回 perm_count

### staff-list.html 筛选功能完善

- 表头下拉菜单增加升序/降序按钮
- 下拉菜单悬停显示「仅筛选此事」按钮，点击后单选该项
- 点击复选框勾选/取消勾选，取消勾选最后一项时隐藏该项数据
- 显示列取消勾选全选时保留序号、工号、姓名
- 取消添加、导入、删除按钮
- 序号列显示圆形数据统计
- 后端 API 排序改为 ORDER BY id ASC 保持 Excel 顺序
- 文件：`public/staff-list.html`、`src/routes/staff.js`

---

## 2026-04-07 完成

### staff-list.html 筛选优化
- 筛选时只在客户端筛选已加载数据，不重新请求API
- 添加 `applyClientFilter()` 函数处理客户端筛选
- 添加 `isInitialLoad` 参数控制加载动画和容器显示
- 文件：`public/staff-list.html`

### staff-list.html UI 优化
- 去掉顶部搜索栏
- 去掉表头拖拽排序（改用显示列下拉调整顺序）
- 文件：`public/staff-list.html`

### staff-list.html 样式调整
- 表头下方增加 margin-top: 50px
- 列表区域固定高度 calc(100vh - 180px)
- 空数据时显示空白行而非清空
- 文件：`public/staff-list.html`

---

## 2026-04-06 完成

### staff-list.html 筛选器修复

**问题1-6：**（见历史记录）

### staff.js API 修复

**问题1-3：**（见历史记录）

### 已验证正常工作的 API

**问题1：员工详情 API 报错 `no such column: s.s6_permission`**
- 原因：数据库 staff 表没有 `s6_permission` 列，但 `GET /api/staff/:id` 查询中有引用
- 修复：从 [staff.js:226-228](src/routes/staff.js#L226-L228) SELECT 语句中移除 `s.s6_permission`
- 文件：`src/routes/staff.js`

**问题2：员工权限字段 API 报错 `员工不存在`**
- 原因：路由顺序问题，`GET /api/staff/permission-fields` 被 `/:id` 路由捕获，`permission-fields` 被当作员工ID
- 修复：将 `/permission-fields` 路由移到 `/:id` 之前
- 文件：`src/routes/staff.js`

**问题3：批量更新权限 API 报错 `no such column: s6_permission`**
- 原因：数据库 staff 表没有 `s6_permission` 列
- 状态：**未修复**（按要求不修改员工权限相关功能）

### 已验证正常工作的 API
- `GET /api/staff` - 员工列表
- `GET /api/staff/:id` - 员工详情
- `GET /api/staff/column-config` - 列配置
- `GET /api/staff/permission-fields` - 权限字段列表
- `GET /api/exam/list` - 考试列表
- `GET /api/learning-tasks` - 学习任务
- `GET /api/6s` - 6S记录
- `GET /api/meal/list` - 报餐列表