// js/exam.js - 考试管理
const API_URL = window.location.origin + '/api';
let token = localStorage.getItem('token');
let currentTab = 'records';
let exams = [];
let papers = [];
let records = [];
let trainingTasks = [];
let myTrainingRecords = [];
let questionBanks = []; // 题库数据（来自 exam_banks 表）
let currentImportExamId = null;
let pendingExamForm = null; // 保存新建培训表单状态，用于从创建资料/题库返回后恢复
let pendingQuestionData = null; // 保存待导入的题库数据（file或text）
let pendingQuestionFile = null; // 保存待导入的文件

document.addEventListener('DOMContentLoaded', () => {
    if (!token) {
        alert('请先登录');
        window.location.href = 'admin/login.html';
        return;
    }
    // 权限检查
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    if (!currentUser.can_manage_training) { alert('无权限访问培训管理'); window.location.href = 'dashboard.html'; return; }
    loadData();
});

// 上传文件带进度条
function uploadWithProgress(url, file, authToken) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const progressContainer = document.getElementById('uploadProgressContainer');
        const progressBar = document.getElementById('uploadProgressBar');
        const progressPercent = document.getElementById('uploadProgressPercent');

        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                const percent = Math.round((e.loaded / e.total) * 100);
                progressBar.style.width = percent + '%';
                progressPercent.textContent = percent;
                progressContainer.style.display = 'block';
            }
        });

        xhr.addEventListener('load', () => {
            progressContainer.style.display = 'none';
            progressBar.style.width = '0%';
            progressPercent.textContent = '0';
            try {
                const response = JSON.parse(xhr.responseText);
                resolve(response);
            } catch (e) {
                reject(new Error('解析响应失败'));
            }
        });

        xhr.addEventListener('error', () => {
            progressContainer.style.display = 'none';
            reject(new Error('上传失败'));
        });

        xhr.addEventListener('abort', () => {
            progressContainer.style.display = 'none';
            reject(new Error('上传取消'));
        });

        xhr.open('POST', url);
        xhr.setRequestHeader('Authorization', `Bearer ${authToken}`);
        const formData = new FormData();
        formData.append('file', file);
        xhr.send(formData);
    });
}

// 视频文件选择处理
document.getElementById('taskVideoFile')?.addEventListener('change', function(e) {
    const file = e.target.files[0];
    const fileInfo = document.getElementById('videoFileInfo');
    if (file) {
        const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
        fileInfo.textContent = `已选择：${file.name} (${sizeMB} MB)`;
        fileInfo.style.display = 'block';
    } else {
        fileInfo.style.display = 'none';
    }
});

function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === tab + 'Tab');
    });
    // 控制按钮显示
    document.getElementById('btnsTraining').style.display = tab === 'training' ? '' : 'none';
    document.getElementById('btnsPapers').style.display = tab === 'papers' ? '' : 'none';
    document.getElementById('btnsQuestions').style.display = tab === 'questions' ? '' : 'none';
    // 切换到学习资料标签页时，渲染任务列表
    if (tab === 'training') {
        renderTrainingTasks();
    }
    // 切换到题库管理标签页时，如果题库为空则刷新数据
    if (tab === 'questions' && questionBanks.length === 0) {
        loadData();
    }
}

function loadData() {
    document.getElementById('examList').innerHTML = '<div class="loading">加载中...</div>';

    if (!token) {
        document.getElementById('examList').innerHTML = '<div class="empty-state">请先登录</div>';
        return;
    }

    console.log('loadData started, token:', token ? 'exists' : 'missing');

    Promise.all([
        fetch(`${API_URL}/exam/list`, { headers: { 'Authorization': `Bearer ${token}` } }).then(r => {
            console.log('exam/list response:', r.status, r.statusText);
            if (!r.ok) throw new Error('exam/list failed: ' + r.status);
            return r.json();
        }).catch(err => {
            console.error('exam/list error:', err);
            return { code: -1, data: [] };
        }),
        fetch(`${API_URL}/exam/stats/user`, { headers: { 'Authorization': `Bearer ${token}` } }).then(r => {
            console.log('stats/user response:', r.status, r.statusText);
            if (!r.ok) throw new Error('stats/user failed: ' + r.status);
            return r.json();
        }).catch(err => {
            console.error('stats/user error:', err);
            return { code: -1, data: {} };
        }),
        fetch(`${API_URL}/exam-trainings`, { headers: { 'Authorization': `Bearer ${token}` } }).then(r => {
            console.log('exam-trainings response:', r.status, r.statusText);
            if (!r.ok) throw new Error('exam-trainings failed: ' + r.status);
            return r.json();
        }).catch(err => {
            console.error('exam-trainings error:', err);
            return { code: -1, data: [] };
        }),
        fetch(`${API_URL}/learning-materials`, { headers: { 'Authorization': `Bearer ${token}` } }).then(r => {
            console.log('learning-tasks response:', r.status, r.statusText);
            if (!r.ok) throw new Error('learning-tasks failed: ' + r.status);
            return r.json();
        }).catch(err => {
            console.error('learning-tasks error:', err);
            return { code: -1, data: [] };
        }),
        fetch(`${API_URL}/learning-materials/my-records`, { headers: { 'Authorization': `Bearer ${token}` } }).then(r => {
            console.log('learning-tasks/my-records response:', r.status, r.statusText);
            if (!r.ok) throw new Error('learning-tasks/my-records failed: ' + r.status);
            return r.json();
        }).catch(err => {
            console.error('learning-tasks/my-records error:', err);
            return { code: -1, data: [] };
        }),
        fetch(`${API_URL}/question-banks`, { headers: { 'Authorization': `Bearer ${token}` } }).then(r => {
            console.log('question-banks response:', r.status, r.statusText);
            if (!r.ok) throw new Error('question-banks failed: ' + r.status);
            return r.json();
        }).catch(err => {
            console.error('question-banks error:', err);
            return { code: -1, data: [] };
        })
    ]).then(([examData, statsData, papersData, trainingData, myRecordsData, questionBanksData]) => {
        console.log('All responses received:', { examData, statsData, papersData, trainingData, myRecordsData, questionBanksData });
        exams = examData.data || [];
        papers = papersData.data || [];
        trainingTasks = trainingData.data || [];
        questionBanks = questionBanksData.data || [];
        console.log('loadData后trainingTasks:', trainingTasks.length, '条');
        console.log('loadData后questionBanks:', questionBanks.length, '条');
        myTrainingRecords = myRecordsData.data || [];
        const stats = statsData.data?.summary || {};
        renderExamList(stats);
        // 恢复当前标签页状态
        switchTab(currentTab);
        renderTrainingTasks();
    }).catch(err => {
        console.error('loadData error:', err);
        document.getElementById('examList').innerHTML = '<div class="empty-state">加载失败: ' + err.message + '</div>';
    });
}

function renderExamList(stats) {
    const totalExams = stats.total_exams || 0;
    const passedExams = stats.passed_exams || 0;
    const avgScore = stats.avg_score || 0;

    document.getElementById('examList').innerHTML = `
        <div class="tab-bar">
            <button class="tab-btn active" data-tab="records" onclick="switchTab('records')">培训记录</button>
            <button class="tab-btn" data-tab="papers" onclick="switchTab('papers')">培训任务</button>
            <button class="tab-btn" data-tab="training" onclick="switchTab('training')">学习资料</button>
            <button class="tab-btn" data-tab="questions" onclick="switchTab('questions')">题库管理</button>
        </div>

        <!-- 考试列表标签页 -->
        <div id="papersTab" class="tab-content ${currentTab === 'papers' ? 'active' : ''}">
            <!-- 新建培训表单 -->
            <div id="createExamForm" class="card" style="padding:24px;margin-bottom:24px;display:none;">
                <div style="font-size:18px;font-weight:700;margin-bottom:20px;" id="examFormTitle">新建培训</div>

                <!-- 步骤指示器 -->
                <div class="step-indicator">
                    <div class="step-item active" data-step="1">
                        <div class="step-num">1</div>
                        <div class="step-label">基本信息</div>
                    </div>
                    <div class="step-line"></div>
                    <div class="step-item" data-step="2">
                        <div class="step-num">2</div>
                        <div class="step-label">学习资料</div>
                    </div>
                    <div class="step-line"></div>
                    <div class="step-item" data-step="3">
                        <div class="step-num">3</div>
                        <div class="step-label">题库试卷</div>
                    </div>
                    <div class="step-line"></div>
                    <div class="step-item" data-step="4">
                        <div class="step-num">4</div>
                        <div class="step-label">分配权限</div>
                    </div>
                </div>

                <!-- 步骤1：基本信息 -->
                <div id="step1" class="step-content">
                    <div class="form-group">
                        <label style="font-weight:600;margin-bottom:8px;display:block;">培训标题 *</label>
                        <input type="text" id="examTitle" class="form-control" style="width:100%;padding:12px;border:1.5px solid var(--border);border-radius:14px;background:var(--bg);color:var(--text);font-size:14px;" placeholder="请输入培训标题" value="测试培训-2026-04-25">
                    </div>

                    <div class="form-group">
                        <label style="font-weight:600;margin-bottom:8px;display:block;">培训描述</label>
                        <textarea id="examDescription" class="form-control" style="width:100%;padding:12px;border:1.5px solid var(--border);border-radius:14px;background:var(--bg);color:var(--text);resize:vertical;min-height:80px;font-size:14px;" placeholder="请输入培训描述（可选）">本培训用于测试系统功能</textarea>
                    </div>

                    <div style="display:flex;gap:16px;">
                        <div class="form-group" style="flex:1;">
                            <label style="font-weight:600;margin-bottom:8px;display:block;">培训开始时间 *</label>
                            <input type="datetime-local" id="examStartTime" class="form-control" style="width:100%;padding:12px;border:1.5px solid var(--border);border-radius:14px;background:var(--bg);color:var(--text);font-size:14px;" value="2026-04-26T09:00">
                        </div>
                        <div class="form-group" style="flex:1;">
                            <label style="font-weight:600;margin-bottom:8px;display:block;">培训结束时间 *</label>
                            <input type="datetime-local" id="examEndTime" class="form-control" style="width:100%;padding:12px;border:1.5px solid var(--border);border-radius:14px;background:var(--bg);color:var(--text);font-size:14px;" value="2026-05-26T18:00">
                        </div>
                    </div>

                    <div style="display:flex;gap:16px;">
                        <div class="form-group" style="flex:1;">
                            <label style="font-weight:600;margin-bottom:8px;display:block;">考试时长（分钟）*</label>
                            <input type="number" id="examDuration" class="form-control" style="width:100%;padding:12px;border:1.5px solid var(--border);border-radius:14px;background:var(--bg);color:var(--text);font-size:14px;" value="60" min="1">
                        </div>
                        <div class="form-group" style="flex:1;">
                            <label style="font-weight:600;margin-bottom:8px;display:block;">及格分数 *</label>
                            <input type="number" id="examPassScore" class="form-control" style="width:100%;padding:12px;border:1.5px solid var(--border);border-radius:14px;background:var(--bg);color:var(--text);font-size:14px;" value="60" min="1" max="100">
                        </div>
                    </div>
                </div>

                <!-- 步骤2：关联学习资料 -->
                <div id="step2" class="step-content" style="display:none;">
                    <div class="form-group">
                        <label style="font-weight:600;margin-bottom:8px;display:block;">关联学习资料</label>
                        <select id="examLearningTask" class="form-control" style="width:100%;padding:12px 16px;border:1.5px solid var(--border);border-radius:14px;background:var(--bg);color:var(--text);font-size:14px;" onchange="onLearningTaskChangeInline(this.value)">
                            <option value="">请选择学习资料</option>
                            ${(Array.isArray(trainingTasks) ? trainingTasks : []).map(t => `<option value="${t.id}">${t.title || '资料 ' + t.id}</option>`).join('') || '<option value="">暂无学习资料</option>'}
                            <option value="__new__">+ 创建新资料</option>
                        </select>
                    </div>
                    <div id="selectedLearningTask" style="margin-top:12px;padding:12px;background:rgba(74,144,226,0.08);border-radius:12px;display:none;">
                        <div style="font-size:13px;color:var(--text-soft);">已选择：<span id="selectedLearningTaskName" style="font-weight:600;color:var(--text);"></span></div>
                    </div>
                </div>

                <!-- 步骤3：关联题库 -->
                <div id="step3" class="step-content" style="display:none;">
                    <div class="form-group">
                        <label style="font-weight:600;margin-bottom:8px;display:block;">关联题库试卷</label>
                        <select id="examQuestionBank" class="form-control" style="width:100%;padding:12px 16px;border:1.5px solid var(--border);border-radius:14px;background:var(--bg);color:var(--text);font-size:14px;" onchange="onQuestionBankChangeInline(this.value)">
                            <option value="">请选择题库</option>
                            ${questionBanks.map(b => `<option value="${b.id}">${b.title || '题库 ' + b.id} (${b.question_count || 0}题)</option>`).join('') || '<option value="">暂无题库</option>'}
                            <option value="__new__">+ 创建新题库</option>
                        </select>
                    </div>
                    <div id="selectedQuestionBank" style="margin-top:12px;padding:12px;background:rgba(74,144,226,0.08);border-radius:12px;display:none;">
                        <div style="font-size:13px;color:var(--text-soft);">已选择：<span id="selectedQuestionBankName" style="font-weight:600;color:var(--text);"></span></div>
                    </div>
                </div>

                <!-- 步骤4：分配权限 -->
                <div id="step4" class="step-content" style="display:none;">
                    <div class="form-group">
                        <label style="font-weight:600;margin-bottom:12px;display:block;">授权方式</label>
                        <div style="display:flex;gap:12px;margin-bottom:16px;">
                            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:12px 20px;background:var(--bg);border:1.5px solid var(--border);border-radius:var(--radius);flex:1;transition:all 0.2s;" id="radioAllStaffLabel">
                                <input type="radio" name="permType" value="all" id="radioAllStaff" checked onchange="togglePermType()" style="width:18px;height:18px;accent-color:var(--primary);">
                                <div>
                                    <div style="font-weight:600;font-size:14px;">全员授权</div>
                                    <div style="font-size:11px;color:var(--text-soft);margin-top:2px;">所有员工均可参加考试</div>
                                </div>
                            </label>
                            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:12px 20px;background:var(--bg);border:1.5px solid var(--border);border-radius:var(--radius);flex:1;transition:all 0.2s;" id="radioManualLabel">
                                <input type="radio" name="permType" value="manual" id="radioManual" onchange="togglePermType()" style="width:18px;height:18px;accent-color:var(--primary);">
                                <div>
                                    <div style="font-weight:600;font-size:14px;">手动选择</div>
                                    <div style="font-size:11px;color:var(--text-soft);margin-top:2px;">指定员工参加考试</div>
                                </div>
                            </label>
                        </div>
                        <div id="manualPermSection" style="display:none;">
                            <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;">
                                <input type="text" id="staffSearchInput" class="form-control" style="flex:1;min-width:150px;padding:10px 12px;border:1.5px solid var(--border);border-radius:14px;background:var(--bg);font-size:13px;" placeholder="搜索工号或姓名..." oninput="filterStaffList(this.value)">
                                <button class="btn btn-sm btn-secondary" onclick="selectAllStep4Staff()">全选</button>
                                <button class="btn btn-sm btn-secondary" onclick="deselectAllStep4Staff()">全取消</button>
                                <button class="btn btn-sm btn-primary" onclick="showDeptSelectModal()">按部门选择</button>
                            </div>
                            <div id="step4StaffList" style="max-height:250px;overflow-y:auto;border:1.5px solid var(--border);border-radius:14px;padding:12px;background:var(--bg);">
                                <div style="text-align:center;padding:40px;color:var(--text-soft);">加载中...</div>
                            </div>
                            <div style="margin-top:8px;font-size:12px;color:var(--text-soft);">已选择 <span id="step4SelectedCount">0</span> / <span id="step4TotalCount">0</span> 人</div>
                        </div>
                    </div>
                </div>

                <!-- 部门选择弹窗 -->
                <div class="modal" id="deptSelectModal">
                    <div class="modal-box" style="max-width:400px;">
                        <div class="modal-title">按部门选择</div>
                        <div id="deptCheckboxes" style="max-height:300px;overflow-y:auto;margin:16px 0;"></div>
                        <div class="modal-actions">
                            <button class="btn btn-secondary btn-sm" onclick="closeDeptSelectModal()">取消</button>
                            <button class="btn btn-primary btn-sm" onclick="confirmDeptSelect()">确认</button>
                        </div>
                    </div>
                </div>

                <!-- 按钮区域 -->
                <div style="display:flex;gap:10px;margin-top:24px;padding-top:20px;border-top:1px solid var(--border);">
                    <button class="btn btn-secondary btn-sm" id="prevStepBtn" onclick="prevStep()" style="display:none;">上一步</button>
                    <button class="btn btn-success btn-sm" id="draftSubmitBtn" onclick="draftExam()">暂存</button>
                    <button class="btn btn-primary btn-sm" id="nextStepBtn" onclick="console.log('NEXT button clicked, currentStep=', currentStep); nextStep()">下一步 →</button>
                    <button class="btn btn-success btn-sm" id="submitExamBtn" onclick="console.log('SUBMIT button clicked, currentStep=', currentStep); createExam()" style="display:none;">✓ 完成创建</button>
                    <button class="btn btn-secondary btn-sm" onclick="hideCreateExamForm()" style="margin-left:auto;">取消</button>
                </div>

                <div id="createExamResult" class="import-result" style="display:none;margin-top:16px;padding:12px;border-radius:14px;"></div>
            </div>

            <style>
                .step-indicator { display:flex;align-items:center;justify-content:space-between;margin-bottom:24px; }
                .step-item { display:flex;flex-direction:column;align-items:center;gap:6px;min-width:70px; }
                .step-num { width:28px;height:28px;min-width:28px;border-radius:50%;background:var(--border);color:var(--text-soft);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;position:relative;z-index:1; }
                .step-item.active .step-num { background:var(--primary);color:#fff; }
                .step-item.completed .step-num { background:var(--accent);color:#fff; }
                .step-label { font-size:12px;color:var(--text-soft);white-space:nowrap;text-align:center; }
                .step-item.active .step-label { color:var(--text);font-weight:600; }
                .step-line { flex:1;height:2px;background:var(--border);min-width:40px;margin-top:-18px;position:relative;z-index:0; }
                .step-content { animation:fadeIn 0.3s ease; }
                @keyframes fadeIn { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
            </style>

            <!-- 考试列表（只显示已分配权限的培训） -->
            ${papers.filter(t => t.perm_count > 0).length === 0 ? '<div class="empty-state">暂无培训任务</div>' : ''}
            <div class="card-grid">
                ${papers.filter(t => t.perm_count > 0).map(exam => {
                    const isActive = exam.is_active === 1;
                    return `
                    <div class="card exam-card" style="padding: 16px; position: relative;">
                        <div style="position: absolute; top: 12px; right: 12px; display: flex; gap: 6px; align-items: center;">
                            <span class="status-badge ${isActive ? 'status-success' : 'status-secondary'}" style="font-size: 11px; padding: 3px 8px;">${isActive ? '已启用' : '已停用'}</span>
                        </div>
                        <div class="card-title" style="margin: 0 0 8px 0; padding-right: 80px;">${exam.title || '未命名考试'}</div>
                        <p class="card-desc" style="margin-bottom: 10px;">${exam.description || '暂无描述'}</p>
                        <div class="card-meta" style="flex-wrap: wrap; gap: 8px;">
                            <span>时长: ${exam.duration || 60}分钟</span>
                            <span>及格: ${exam.pass_score || 60}分</span>
                            <span>题目: ${exam.question_count || 0} 题</span>
                            <span>授权: ${exam.perm_count || 0} 人</span>
                        </div>
                        <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border); display: flex; gap: 6px; flex-wrap: nowrap; align-items: center;">
                            <button class="btn btn-sm ${isActive ? 'btn-danger' : 'btn-primary'}" onclick="toggleExamStatus(${exam.id}, ${isActive ? 1 : 0}, ${exam.learning_task_id || 0})" style="flex: 1; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.15); font-weight: 600;">
                                ${isActive ? '停用' : '启用'}
                            </button>
                            <button class="btn btn-secondary btn-sm" onclick="previewPaper(${exam.id})" style="flex: 1; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.15); font-weight: 600;">
                                预览
                            </button>
                            <button class="btn btn-secondary btn-sm" onclick="viewExamPermissions(${exam.id})" style="flex: 1; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.15); font-weight: 600;">
                                人员
                            </button>
                            <button class="btn btn-secondary btn-sm" onclick="openExamSettings(${exam.id})" style="flex: 1; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.15); font-weight: 600;">
                                设置
                            </button>
                            <button class="btn btn-danger btn-sm" onclick="deleteExam(${exam.id})" style="flex: 1; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.15); font-weight: 600;">
                                删除
                            </button>
                        </div>
                    </div>
                `}).join('')}
            </div>
        </div>

        <!-- 学习资料标签页 -->
        <div id="trainingTab" class="tab-content">
            <div id="loadingTasks" class="loading" style="padding:40px;text-align:center;">加载中...</div>
            <div id="emptyTasks" class="empty-state" style="display:none;">暂无学习资料</div>
            <div id="trainingTaskList" class="card-grid"></div>
        </div>

        <div id="recordsTab" class="tab-content ${currentTab === 'records' ? 'active' : ''}">
            <div class="card">
                <div class="card-title">我的培训记录</div>
                ${myTrainingRecords.length === 0 ? '<div class="empty-state" style="padding:40px;text-align:center;color:var(--text-secondary);">暂无培训记录</div>' : `
                <div class="task-grid" style="margin-top:16px;">
                    ${myTrainingRecords.map(r => {
                        const isCompleted = r.my_status === 'completed';
                        const hasExam = !!r.exam_id;
                        const examStatus = r.exam_passed === true ? '已通过' : (r.exam_passed === false ? '未通过' : hasExam ? '未参加' : '无考试');
                        const examStatusClass = r.exam_passed === true ? 'badge-success' : (r.exam_passed === false ? 'badge-danger' : 'badge-secondary');
                        return `
                        <div class="task-card" onclick="showTrainingRecordDetail(${r.task_id})" style="cursor:pointer;">
                            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                                <span class="progress-badge progress-badge-${isCompleted ? 'completed' : (r.my_status === 'in_progress' ? 'in-progress' : 'not-started')}">${isCompleted ? '已完成' : (r.my_status === 'in_progress' ? '学习中' : '未开始')}</span>
                                <span style="font-size:12px;color:var(--text-secondary);">${r.end_time ? '截止: ' + formatTaskTime(r.end_time) : '无限制'}</span>
                            </div>
                            <div class="task-title" style="margin-bottom:8px;">${r.task_title || '未命名任务'}</div>
                            <div style="margin-bottom:10px;">
                                <span class="badge badge-secondary" style="font-size:11px;padding:3px 8px;">达成率 ${r.stats.achievement_rate}%</span>
                                ${hasExam ? `<span class="badge ${examStatusClass}" style="font-size:11px;padding:3px 8px;margin-left:6px;">考试: ${examStatus}</span>` : ''}
                            </div>
                            <div class="task-stats">
                                <div class="stat-item">
                                    <div class="stat-value">${r.stats.completed}/${r.stats.total}</div>
                                    <div class="stat-label">已完成/总人数</div>
                                </div>
                                <div class="stat-item">
                                    <div class="stat-value">${r.my_progress || 0}%</div>
                                    <div class="stat-label">我的进度</div>
                                </div>
                            </div>
                        </div>
                    `}).join('')}
                </div>
                `}
            </div>
        </div>

        <!-- 培训记录详情弹窗 -->
        <div class="modal" id="trainingRecordModal" style="display:none;position:fixed;z-index:2000;left:0;top:0;width:100%;height:100%;background:rgba(0,0,0,0.5);align-items:center;justify-content:center;">
            <div class="modal-box" style="background:var(--bg-card);border-radius:var(--radius-lg);padding:24px;width:90%;max-width:600px;max-height:90vh;overflow-y:auto;">
                <div class="modal-title" id="trainingRecordModalTitle" style="font-size:18px;font-weight:700;margin-bottom:16px;">培训任务详情</div>
                <div id="trainingRecordModalContent"></div>
                <div style="display:flex;gap:10px;margin-top:16px;">
                    <button class="btn btn-secondary btn-sm" onclick="closeTrainingRecordModal()" style="flex:1;">关闭</button>
                </div>
            </div>
        </div>

        <div id="questionsTab" class="tab-content">
            ${questionBanks.length === 0 ? '<div class="empty-state">暂无题库</div>' : ''}
            <div class="card-grid">
                ${questionBanks.map(bank => `
                    <div class="card exam-card" style="padding: 16px; position: relative; cursor: pointer;" onclick="previewQuestionBank(${bank.id})">
                        <div class="card-title" style="margin: 0 0 8px 0;">${bank.title || '未命名题库'}</div>
                        <p class="card-desc" style="margin-bottom: 10px;">${bank.description || '暂无描述'}</p>
                        <div class="card-meta">
                            <span>题目: ${bank.question_count || 0} 题</span>
                            <span>总分: ${bank.total_score || 0} 分</span>
                        </div>
                        <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border); display: flex; gap: 6px; flex-wrap: nowrap; align-items: center;">
                            <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); openQuestionBankSettings(${bank.id})" style="flex: 1; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.15); font-weight: 600;">
                                编辑
                            </button>
                            <button class="btn btn-danger btn-sm" onclick="event.stopPropagation(); deleteQuestionBank(${bank.id})" style="flex: 1; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.15); font-weight: 600;">
                                删除
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>

        <!-- 学习资料弹窗 -->
        <div class="modal" id="taskModal" style="display:none;position:fixed;z-index:2000;left:0;top:0;width:100%;height:100%;background:rgba(0,0,0,0.5);align-items:center;justify-content:center;">
            <div class="modal-box" style="background:var(--bg-card);border-radius:var(--radius-lg);padding:24px;width:90%;max-width:500px;max-height:90vh;overflow-y:auto;">
                <div class="modal-title" id="taskModalTitle" style="font-size:18px;font-weight:700;margin-bottom:16px;">创建学习资料</div>

                <input type="hidden" id="taskId">

                <div class="form-group">
                    <label style="font-weight:600;margin-bottom:8px;display:block;">资料标题 *</label>
                    <input type="text" id="taskTitle" class="form-control" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:var(--radius);background:var(--bg-input);color:var(--text-primary);" placeholder="请输入资料标题">
                </div>

                <div class="form-group">
                    <label style="font-weight:600;margin-bottom:8px;display:block;">资料描述</label>
                    <textarea id="taskDescription" class="form-control" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:var(--radius);background:var(--bg-input);color:var(--text-primary);resize:vertical;min-height:60px;" placeholder="请输入资料描述（可选）"></textarea>
                </div>

                <div class="form-group">
                    <label style="font-weight:600;margin-bottom:8px;display:block;">上传视频</label>
                    <input type="file" id="taskVideoFile" accept="video/mp4,video/*" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:var(--radius);background:var(--bg-input);color:var(--text-primary);">
                    <div id="videoFileInfo" style="font-size:12px;color:var(--text-secondary);margin-top:4px;display:none;"></div>
                    <div id="uploadProgressContainer" style="margin-top:8px;display:none;">
                        <div style="font-size:12px;color:var(--text-secondary);margin-bottom:4px;">上传进度: <span id="uploadProgressPercent">0</span>%</div>
                        <div style="width:100%;height:8px;background:var(--bg-surface);border-radius:4px;overflow:hidden;">
                            <div id="uploadProgressBar" style="width:0%;height:100%;background:var(--accent);transition:width 0.3s;"></div>
                        </div>
                    </div>
                </div>

                <div style="display:flex;gap:10px;margin-top:16px;">
                    <button class="btn btn-primary btn-sm" id="taskSubmitBtn" onclick="saveTask()" style="flex:1;">保存</button>
                    <button class="btn btn-secondary btn-sm" onclick="closeTaskModal()" style="flex:1;">取消</button>
                </div>
            </div>
        </div>

        <!-- 题库导入弹窗 -->
        <div class="modal" id="questionImportModal" style="display:none;position:fixed;z-index:2000;left:0;top:0;width:100%;height:100%;background:rgba(0,0,0,0.5);align-items:center;justify-content:center;">
            <div class="modal-box" style="background:var(--bg-card);border-radius:var(--radius-lg);padding:24px;width:90%;max-width:800px;max-height:90vh;overflow-y:auto;">
                <div class="modal-title" style="font-size:18px;font-weight:700;margin-bottom:16px;">
                    📥 导入试卷
                    <button class="btn btn-secondary btn-sm" style="float:right;margin-left:10px;" onclick="downloadTemplate()">📥 下载模板</button>
                </div>

                <div class="form-group">
                    <label style="font-weight:600;margin-bottom:8px;display:block;">试卷标题 *</label>
                    <input type="text" id="importExamTitle" class="form-control" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:var(--radius);background:var(--bg-input);color:var(--text-primary);" placeholder="请输入试卷标题">
                </div>

                <div class="form-group">
                    <label style="font-weight:600;margin-bottom:8px;display:block;">试卷描述</label>
                    <textarea id="importExamDesc" class="form-control" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:var(--radius);background:var(--bg-input);color:var(--text-primary);resize:vertical;min-height:40px;" placeholder="请输入试卷描述（可选）"></textarea>
                </div>

                <div class="form-group">
                    <label style="font-weight:600;margin-bottom:8px;display:block;">方式一：粘贴题目文本</label>
                    <textarea id="importText" class="import-area" style="width:100%;height:150px;border:1px solid var(--border);border-radius:var(--radius);padding:12px;font-size:14px;resize:vertical;background:var(--bg-input);color:var(--text-primary);" placeholder="请粘贴题目文本，每题格式：
1. 题目内容
A. 选项A
B. 选项B
C. 选项C
D. 选项D
答案：A

支持直接粘贴 Word 或记事本中的题目"></textarea>
                </div>

                <div class="form-group">
                    <label style="font-weight:600;margin-bottom:8px;display:block;">方式二：上传文件（支持 docx/txt/doc）</label>
                    <input type="file" id="importFile" accept=".docx,.txt,.doc" style="margin-bottom:8px;">
                    <div id="fileInfo" style="font-size:12px;color:var(--text-secondary);margin-top:5px;"></div>
                </div>

                <div style="display:flex;gap:10px;margin-top:16px;">
                    <button class="btn btn-secondary btn-sm" onclick="previewQuestions()">🔍 预览</button>
                    <button class="btn btn-primary btn-sm" onclick="importQuestions()">✅ 导入</button>
                    <button class="btn btn-secondary btn-sm" onclick="closeQuestionImport()">取消</button>
                </div>

                <div id="previewSection" style="display:none;margin-top:16px;">
                    <h4 style="margin-bottom:10px;">📋 预览（共 <span id="previewCount">0</span> 题）</h4>
                    <div id="previewList" style="max-height:300px;overflow-y:auto;border:1px solid var(--border);border-radius:var(--radius);padding:10px;background:var(--bg-surface);"></div>
                </div>

                <div id="importResult" class="import-result" style="display:none;margin-top:16px;padding:12px;border-radius:var(--radius);"></div>
            </div>
        </div>

        <style>
            .import-result.success { background: rgba(34, 197, 94, 0.1); color: #22c55e; }
            .import-result.error { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
            .exam-card {
                transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
                cursor: pointer;
                border-radius: 12px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.2);
                border: 1px solid rgba(0,0,0,0.05);
            }
            .exam-card:hover {
                transform: translateY(-4px);
                box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255,255,255,0.2);
            }
            .exam-card:active {
                transform: translateY(-2px);
            }
            .exam-card .btn {
                display: inline-flex !important;
                justify-content: center;
                align-items: center;
                text-align: center;
            }
            /* 滚动条样式 */
            .preview-modal-content { scrollbar-width: thin; scrollbar-color: rgba(0,0,0,0.2) transparent; }
            .preview-modal-content::-webkit-scrollbar { width: 6px !important; height: 6px !important; }
            .preview-modal-content::-webkit-scrollbar-track { background: transparent !important; border-radius: 0 !important; }
            .preview-modal-content::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.2) !important; border-radius: 0 !important; }
            .preview-modal-content::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.35) !important; }
            .preview-modal-content::-webkit-scrollbar-corner { background: transparent !important; }
        </style>

        <!-- 学习任务选择弹窗 -->
        <div class="modal" id="taskSelectModal" style="display:none;position:fixed;z-index:1000;left:0;top:0;width:100%;height:100%;background:rgba(0,0,0,0.5);align-items:center;justify-content:center;">
            <div class="modal-box" style="background:var(--bg-card);border-radius:var(--radius-lg);padding:24px;width:90%;max-width:500px;max-height:90vh;overflow-y:auto;">
                <div class="modal-title" style="font-size:18px;font-weight:700;margin-bottom:16px;">选择学习任务</div>
                <p style="color:var(--text-secondary);margin-bottom:16px;font-size:13px;">启用考试必须绑定学习任务，当学习任务到期后考试将自动停止。</p>
                <div class="form-group">
                    <label style="font-weight:600;margin-bottom:8px;display:block;">选择学习任务 *</label>
                    <select id="selectLearningTask" class="form-control" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:var(--radius);background:var(--bg-input);color:var(--text-primary);">
                        <option value="">请选择学习任务</option>
                    </select>
                </div>
                <div id="taskInfo" style="display:none;margin-top:12px;padding:12px;background:var(--bg-surface);border-radius:var(--radius);font-size:13px;"></div>
                <div style="display:flex;gap:10px;margin-top:16px;">
                    <button class="btn btn-primary btn-sm" onclick="confirmEnableExam()" style="flex:1;">确认启用</button>
                    <button class="btn btn-secondary btn-sm" onclick="closeTaskSelectModal()" style="flex:1;">取消</button>
                </div>
            </div>
        </div>
    `;
}

async function previewPaper(examId) {
    // 获取试卷详情
    try {
        const res = await fetch(`${API_URL}/exam-trainings/${examId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        }).then(r => r.json());

        if (res.code !== 0) {
            alert(res.msg || '获取试卷详情失败');
            return;
        }

        const { training: exam, questions } = res.data;
        showPaperPreviewModal(exam, questions);
    } catch (err) {
        alert('获取试卷详情失败');
    }
}

async function deleteExam(examId) {
    if (!confirm('确定要删除此考试吗？删除后不可恢复。')) {
        return;
    }
    try {
        const res = await fetch(`${API_URL}/exam-trainings/${examId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        }).then(r => r.json());

        if (res.code === 0) {
            loadData();
        } else {
            alert(res.msg || '删除失败');
        }
    } catch (err) {
        alert('删除失败');
    }
}

// 打开考试设置弹窗
let currentEditingExamId = null;

async function openExamSettings(examId) {
    currentEditingExamId = examId;

    // 查找培训数据（从 papers 中查找）
    const exam = papers.find(t => t.id === examId);
    if (!exam) {
        alert('考试不存在');
        return;
    }

    const form = document.getElementById('createExamForm');
    if (!form) return;

    // 刷新学习资料下拉框
    const learningTaskSelect = document.getElementById('examLearningTask');
    if (learningTaskSelect) {
        let options = '<option value="">请选择资料</option>';
        if (trainingTasks && trainingTasks.length > 0) {
            options += trainingTasks.map(t => `<option value="${t.id}">${t.title || '资料 ' + t.id}</option>`).join('');
        }
        options += '<option value="__new__">+ 创建新资料</option>';
        learningTaskSelect.innerHTML = options;
    }

    // 刷新题库下拉框
    const questionBankSelect = document.getElementById('examQuestionBank');
    if (questionBankSelect) {
        questionBankSelect.innerHTML = '<option value="">请选择题库</option>' +
            questionBanks.map(b => `<option value="${b.id}">${b.title || '题库 ' + b.id} (${b.question_count || 0}题)</option>`).join('') +
            '<option value="__new__">+ 创建新题库</option>';
        questionBankSelect.value = exam.question_bank_id || '';
    }

    // 填充表单
    document.getElementById('examTitle').value = exam.title || '';
    document.getElementById('examDescription').value = exam.description || '';
    document.getElementById('examStartTime').value = exam.start_time || '';
    document.getElementById('examEndTime').value = exam.end_time || '';
    document.getElementById('examDuration').value = exam.duration || 60;
    document.getElementById('examPassScore').value = exam.pass_score || 60;
    document.getElementById('examLearningTask').value = exam.learning_task_id || '';
    document.getElementById('examQuestionBank').value = exam.question_bank_id || '';
    const participantFileEl2 = document.getElementById('examParticipantsFile');
    if (participantFileEl2) participantFileEl2.value = '';
    const participantFileInfoEl2 = document.getElementById('participantFileInfo');
    if (participantFileInfoEl2) participantFileInfoEl2.style.display = 'none';
    document.getElementById('createExamResult').style.display = 'none';

    // 重置步骤
    currentStep = 1;
    updateStepUI();

    // 更新表单标题
    const formTitle = document.getElementById('examFormTitle');
    if (formTitle) {
        formTitle.textContent = '考试设置';
    }

    // 更改提交按钮文字
    const submitBtn = document.getElementById('examSubmitBtn');
    if (submitBtn) {
        submitBtn.textContent = '保存';
    }

    // 显示表单
    form.style.display = 'block';
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ============ 题库管理函数 ============

async function previewQuestionBank(bankId) {
    // 获取题库详情
    try {
        const res = await fetch(`${API_URL}/question-banks/${bankId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        }).then(r => r.json());

        if (res.code !== 0) {
            alert(res.msg || '获取题库详情失败');
            return;
        }

        const { bank, questions } = res.data;
        showQuestionBankPreviewModal(bank, questions);
    } catch (err) {
        alert('获取题库详情失败');
    }
}

function showQuestionBankPreviewModal(bank, questions) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'questionBankPreviewModal';
    modal.style.cssText = 'position:fixed;z-index:1000;left:0;top:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;';

    const questionsHtml = questions.length === 0
        ? '<div style="padding:20px;text-align:center;color:#999;">暂无题目</div>'
        : questions.map((q, i) => {
            const typeMap = { 'true_false': '判断题', 'single_choice': '单选题', 'multiple_choice': '多选题' };
            const typeName = typeMap[q.type] || q.type;
            const options = q.options ? JSON.parse(q.options) : [];
            const optionsHtml = options.map((opt, idx) => {
                const letter = String.fromCharCode(65 + idx);
                return `<div style="margin:6px 0;padding:8px;background:var(--bg-surface);border-radius:4px;">${letter}. ${escapeHtml(opt)}</div>`;
            }).join('');

            return `
                <div style="margin-bottom:20px;padding:16px;background:var(--bg-card);border:1px solid var(--border);border-radius:8px;">
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
                        <span style="background:var(--accent);color:white;padding:2px 8px;border-radius:10px;font-size:11px;">${typeName}</span>
                        <span style="color:var(--text-secondary);font-size:12px;">${q.score}分</span>
                    </div>
                    <div style="font-weight:600;margin-bottom:12px;">${i + 1}. ${escapeHtml(q.content)}</div>
                    <div style="padding-left:10px;">${optionsHtml}</div>
                </div>
            `;
        }).join('');

    modal.innerHTML = `
        <div style="background:white;border-radius:16px;width:90%;max-width:700px;max-height:80vh;overflow-y:auto;padding:24px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
                <h3 style="margin:0;">${escapeHtml(bank.title)}</h3>
                <button onclick="this.closest('.modal').remove()" style="background:none;border:none;font-size:24px;cursor:pointer;padding:4px 8px;">&times;</button>
            </div>
            <div style="margin-bottom:16px;padding:12px;background:var(--bg);border-radius:8px;">
                <div style="color:var(--text-secondary);font-size:13px;">题目: ${questions.length} 题 | 总分: ${bank.total_score || 0} 分</div>
            </div>
            ${questionsHtml}
        </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
}

async function deleteQuestionBank(bankId) {
    if (!confirm('确定要删除此题库吗？删除后不可恢复。')) {
        return;
    }
    try {
        const res = await fetch(`${API_URL}/question-banks/${bankId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        }).then(r => r.json());

        if (res.code === 0) {
            alert('删除成功');
            loadData();
        } else {
            // 如果有相关培训信息，显示详情
            if (res.data?.related_trainings?.length > 0) {
                const trainings = res.data.related_trainings.map(t => `• ${t.title || '培训' + t.id}`).join('\n');
                alert(`${res.msg}\n\n关联培训：\n${trainings}\n\n请先删除或修改这些培训的题库设置。`);
            } else {
                alert(res.msg || '删除失败');
            }
        }
    } catch (err) {
        alert('删除失败');
    }
}

let currentEditingQuestionBankId = null;

async function openQuestionBankSettings(bankId) {
    currentEditingQuestionBankId = bankId;

    // 查找题库数据
    const bank = questionBanks.find(b => b.id === bankId);
    if (!bank) {
        alert('题库不存在');
        return;
    }

    // 显示导入弹窗
    document.getElementById('importExamTitle').value = bank.title;
    document.getElementById('importExamDesc').value = bank.description || '';
    document.getElementById('questionImportModal').style.display = 'flex';
}

function showPaperPreviewModal(exam, questions) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'paperPreviewModal';
    modal.style.cssText = 'position:fixed;z-index:1000;left:0;top:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;';

    const questionsHtml = questions.map((q, i) => {
        const typeMap = { 'true_false': '判断题', 'single_choice': '单选题', 'multiple_choice': '多选题' };
        const typeName = typeMap[q.type] || q.type;
        const options = q.options ? JSON.parse(q.options) : [];
        const optionsHtml = options.map((opt, idx) => {
            const letter = String.fromCharCode(65 + idx);
            return `<div style="margin:6px 0;padding:8px;background:var(--bg-surface);border-radius:4px;">${letter}. ${escapeHtml(opt)}</div>`;
        }).join('');

        return `
            <div style="margin-bottom:20px;padding:16px;background:var(--bg-card);border:1px solid var(--border);border-radius:8px;">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
                    <span style="background:var(--accent);color:white;padding:2px 8px;border-radius:10px;font-size:11px;">${typeName}</span>
                    <span style="color:var(--text-secondary);font-size:12px;">${q.score}分</span>
                </div>
                <div style="font-weight:600;margin-bottom:12px;">${i + 1}. ${escapeHtml(q.content)}</div>
                <div style="padding-left:10px;">${optionsHtml}</div>
                <div style="margin-top:10px;padding:8px;background:rgba(34,197,94,0.1);border-radius:4px;color:#22c55e;font-weight:600;">
                    答案: ${q.answer}
                </div>
            </div>
        `;
    }).join('');

    modal.innerHTML = `
        <div class="preview-modal-content" style="background:var(--bg-card);border-radius:var(--radius-lg);padding:24px;width:90%;max-width:700px;max-height:90vh;overflow-y:auto;overflow-x:hidden;box-sizing:border-box;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
                <div style="font-size:18px;font-weight:700;">${escapeHtml(exam.title)}</div>
                <button onclick="closePaperPreviewModal()" style="border:none;background:none;font-size:24px;cursor:pointer;">×</button>
            </div>
            <div style="margin-bottom:16px;color:var(--text-secondary);">
                <span>时长: ${exam.duration}分钟</span> |
                <span>及格: ${exam.pass_score}分</span> |
                <span>题目: ${questions.length}题</span>
            </div>
            <div style="margin-bottom:16px;color:var(--text-secondary);">${escapeHtml(exam.description || '暂无描述')}</div>
            <div style="border-top:1px solid var(--border);padding-top:16px;">
                <div style="font-weight:600;margin-bottom:12px;">题目预览</div>
                ${questions.length > 0 ? questionsHtml : '<div style="text-align:center;padding:40px;color:var(--text-secondary);">暂无题目</div>'}
            </div>
        </div>
    `;

    document.body.appendChild(modal);
}

function closePaperPreviewModal() {
    const modal = document.getElementById('paperPreviewModal');
    if (modal) {
        modal.remove();
    }
}

function getQuestionTypeName(type) {
    const typeMap = {
        'single_choice': '单选题',
        'multiple_choice': '多选题',
        'true_false': '判断题',
        'fill_blank': '填空题',
        'essay': '简答题'
    };
    return typeMap[type] || type || '选择题';
}

function downloadTemplate() {
    // 下载试卷模板文件
    const link = document.createElement('a');
    link.href = '/uploads/试卷模板.docx';
    link.download = '试卷模板.docx';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function onQuestionBankChange(value) {
    if (value === '__new__') {
        const title = document.getElementById('examTitle').value.trim();
        const description = document.getElementById('examDescription').value.trim();
        const duration = document.getElementById('examDuration').value || '60';
        const passScore = document.getElementById('examPassScore').value || '60';

        if (!title) {
            alert('请输入培训标题');
            document.getElementById('examQuestionBank').value = '';
            return;
        }

        // 保存当前表单状态
        pendingExamForm = {
            title: title,
            description: description,
            duration: duration,
            pass_score: passScore,
            learningTaskId: document.getElementById('examLearningTask').value
        };

        // 保存表单信息到localStorage
        localStorage.setItem('pendingExamTitle', title);
        localStorage.setItem('pendingExamDesc', description);
        localStorage.setItem('pendingExamDuration', duration);
        localStorage.setItem('pendingExamPassScore', passScore);

        // 打开导入弹窗
        document.getElementById('importExamTitle').value = title;
        document.getElementById('importExamDesc').value = description;
        document.getElementById('questionImportModal').style.display = 'flex';
    }
}

function onLearningTaskChange(value) {
    if (value === '__new__') {
        // 保存当前表单状态
        pendingExamForm = {
            title: document.getElementById('examTitle').value.trim(),
            description: document.getElementById('examDescription').value.trim(),
            duration: document.getElementById('examDuration').value || '60',
            pass_score: document.getElementById('examPassScore').value || '60',
            questionBankId: document.getElementById('examQuestionBank').value
        };
        // 关闭当前弹窗
        closeCreateExamModal();
        // 打开创建学习资料弹窗
        showCreateTaskModal();
    }
}

// ============ 培训管理 ============
function renderTrainingTasks() {
    const container = document.getElementById('trainingTaskList');
    const loading = document.getElementById('loadingTasks');
    const empty = document.getElementById('emptyTasks');

    if (!container) return;

    if (trainingTasks.length === 0) {
        loading.style.display = 'none';
        empty.style.display = 'block';
        container.innerHTML = '';
        return;
    }

    loading.style.display = 'none';
    empty.style.display = 'none';

    container.innerHTML = trainingTasks.map(task => {
        // 格式化视频时长
        let durationStr = '';
        if (task.duration) {
            const mins = Math.floor(task.duration / 60);
            const secs = task.duration % 60;
            durationStr = `${mins}:${String(secs).padStart(2, '0')}`;
        }
        return `
        <div class="card exam-card" style="padding: 16px; position: relative; cursor: pointer;" onclick="previewLearningMaterial(${task.id})">
            <div class="card-title" style="margin: 0 0 8px 0;">${task.title || '未命名资料'}</div>
            <p class="card-desc" style="margin-bottom: 6px;">${task.description || '暂无描述'}</p>
            ${durationStr ? `<div style="font-size: 12px; color: var(--text-soft); margin-bottom: 8px;">📹 ${durationStr}</div>` : ''}
            <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border); display: flex; gap: 6px; flex-wrap: nowrap; align-items: center;">
                <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); editTask(${task.id})" style="flex: 1; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.15); font-weight: 600;">
                    编辑
                </button>
                <button class="btn btn-danger btn-sm" onclick="event.stopPropagation(); deleteTask(${task.id})" style="flex: 1; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.15); font-weight: 600;">
                    删除
                </button>
            </div>
        </div>
    `}).join('');
}

function previewLearningMaterial(taskId) {
    const task = trainingTasks.find(t => t.id === taskId);
    if (!task) return;

    if (task.file_url) {
        showVideoPreviewModal(task);
    } else {
        editTask(taskId);
    }
}

function showVideoPreviewModal(task) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'videoPreviewModal';
    modal.style.cssText = 'position:fixed;z-index:2000;left:0;top:0;width:100%;height:100%;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;';

    modal.innerHTML = `
        <div style="width:90%;max-width:900px;background:var(--bg-card);border-radius:var(--radius-lg);padding:24px;max-height:90vh;overflow-y:auto;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
                <div style="font-size:18px;font-weight:700;">${escapeHtml(task.title || '学习资料预览')}</div>
                <button onclick="closeVideoPreviewModal()" style="border:none;background:none;font-size:24px;cursor:pointer;">×</button>
            </div>
            <div style="margin-bottom:16px;">
                <span style="font-size:13px;color:var(--text-soft);">${task.description || '暂无描述'}</span>
            </div>
            <div style="position:relative;padding-bottom:56.25%;height:0;background:#000;border-radius:12px;overflow:hidden;">
                <video style="position:absolute;top:0;left:0;width:100%;height:100%;" controls>
                    <source src="${task.file_url}" type="video/mp4">
                    您的浏览器不支持视频播放
                </video>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
}

function closeVideoPreviewModal() {
    const modal = document.getElementById('videoPreviewModal');
    if (modal) {
        modal.remove();
    }
}

let selectedTasks = new Set();

function toggleTask(id) {
    if (selectedTasks.has(id)) {
        selectedTasks.delete(id);
    } else {
        selectedTasks.add(id);
    }
    updateSelectedTaskCount();
}

function updateSelectedTaskCount() {
    // 更新所有任务卡片的复选框状态
    document.querySelectorAll('.task-card .task-checkbox').forEach(cb => {
        const id = parseInt(cb.onclick.toString().match(/toggleTask\((\d+)\)/)?.[1]);
        if (id) {
            cb.checked = selectedTasks.has(id);
        }
    });
}

function goToTaskDetail(id, event) {
    if (event.target.classList.contains('task-checkbox')) return;
    window.location.href = `learning-materials-detail.html?id=${id}`;
}

async function quickPublishTasks() {
    if (selectedTasks.size === 0) {
        alert('请先选择要发布的任务');
        return;
    }
    try {
        const results = await Promise.all([...selectedTasks].map(id =>
            fetch(`${API_URL}/learning-materials/${id}/publish`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            }).then(res => res.json())
        ));
        const fail = results.filter(r => r.code !== 0).length;
        alert(fail === 0 ? '发布成功' : `成功${results.length - fail}个，失败${fail}个`);
        selectedTasks.clear();
        updateSelectedTaskCount();
        loadData();
    } catch (err) {
        alert('发布失败');
    }
}

async function batchDeleteTasks() {
    if (selectedTasks.size === 0) {
        alert('请先选择要删除的任务');
        return;
    }
    if (!confirm(`确定删除 ${selectedTasks.size} 个任务？`)) return;

    try {
        const results = await Promise.all([...selectedTasks].map(id =>
            fetch(`${API_URL}/learning-materials/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            }).then(res => res.json())
        ));
        const fail = results.filter(r => r.code !== 0).length;
        alert(fail === 0 ? '删除成功' : `成功${results.length - fail}个，失败${fail}个`);
        selectedTasks.clear();
        updateSelectedTaskCount();
        loadData();
    } catch (err) {
        alert('删除失败');
    }
}

function formatTaskTime(time) {
    if (!time) return '-';
    const d = new Date(time);
    return `${d.getMonth()+1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function showCreateTaskModal() {
    document.getElementById('taskModalTitle').textContent = '创建学习资料';
    document.getElementById('taskId').value = '';
    document.getElementById('taskTitle').value = '';
    document.getElementById('taskDescription').value = '';
    document.getElementById('taskVideoFile').value = '';
    document.getElementById('videoFileInfo').style.display = 'none';
    document.getElementById('videoFileInfo').textContent = '';
    document.getElementById('uploadProgressContainer').style.display = 'none';
    document.getElementById('uploadProgressBar').style.width = '0%';
    document.getElementById('uploadProgressPercent').textContent = '0';
    document.getElementById('taskSubmitBtn').textContent = '保存';
    document.getElementById('taskModal').style.display = 'flex';
}

function editTask(taskId) {
    const task = trainingTasks.find(t => t.id === taskId);
    if (!task) return;

    document.getElementById('taskModalTitle').textContent = '编辑学习资料';
    document.getElementById('taskId').value = task.id;
    document.getElementById('taskTitle').value = task.title || '';
    document.getElementById('taskDescription').value = task.description || '';
    document.getElementById('taskVideoFile').value = '';
    document.getElementById('videoFileInfo').style.display = 'none';
    document.getElementById('taskSubmitBtn').textContent = '保存';
    document.getElementById('taskModal').style.display = 'flex';
}

function closeTaskModal() {
    document.getElementById('taskModal').style.display = 'none';
}

async function saveTask() {
    const taskId = document.getElementById('taskId').value;
    const title = document.getElementById('taskTitle').value.trim();
    const description = document.getElementById('taskDescription').value.trim();
    const videoFile = document.getElementById('taskVideoFile').files[0];

    if (!title) {
        alert('请输入资料标题');
        return;
    }

    const data = {
        title,
        description
    };

    try {
        let res;
        let fileUrl = null;

        // 如果有视频文件，先上传
        if (videoFile) {
            try {
                const uploadRes = await uploadWithProgress(
                    `${API_URL}/import/learning/upload`,
                    videoFile,
                    token
                );

                if (uploadRes.code !== 0) {
                    alert(uploadRes.msg || '文件上传失败');
                    return;
                }
                fileUrl = uploadRes.data.file_url;
                data.file_url = fileUrl;
                data.file_type = 'mp4';
                if (uploadRes.data.duration) {
                    data.duration = uploadRes.data.duration;
                }
            } catch (err) {
                alert(err.message || '文件上传失败');
                return;
            }
        }

        if (taskId) {
            // 更新
            res = await fetch(`${API_URL}/learning-materials/${taskId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            }).then(r => r.json());
        } else {
            // 创建
            res = await fetch(`${API_URL}/learning-materials`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            }).then(r => r.json());
        }

        if (res.code === 0) {
            alert(taskId ? '资料已更新' : '资料已创建');

            // 如果有待恢复的培训表单，先恢复表单再刷新数据
            if (pendingExamForm) {
                const newTask = res.data;
                const form = pendingExamForm;
                pendingExamForm = null;

                console.log('新创建的资料:', newTask);
                console.log('当前trainingTasks数组:', trainingTasks.length, '条');

                // 将新创建的学习资料加入数组
                trainingTasks.push(newTask);

                console.log('push后trainingTasks数组:', trainingTasks.length, '条');

                // 关闭当前弹窗
                closeTaskModal();

                // 切换到学习资料标签页（确保DOM渲染）
                switchTab('training');

                // 重新打开新建培训弹窗（会刷新下拉框）
                showCreateExamModal();

                // 恢复表单数据
                document.getElementById('examTitle').value = form.title || '';
                document.getElementById('examDescription').value = form.description || '';
                document.getElementById('examDuration').value = form.duration || '60';
                document.getElementById('examPassScore').value = form.pass_score || '60';

                // 刷新学习资料下拉框并选中新建的资料
                const learningTaskSelect = document.getElementById('examLearningTask');
                if (learningTaskSelect) {
                    const options = learningTaskSelect.options;
                    for (let i = 0; i < options.length; i++) {
                        if (options[i].value === String(newTask.id)) {
                            options[i].selected = true;
                            break;
                        }
                    }
                }

                // 如果之前选了题库也恢复
                if (form.questionBankId) {
                    const questionBankSelect = document.getElementById('examQuestionBank');
                    if (questionBankSelect) {
                        const options = questionBankSelect.options;
                        for (let i = 0; i < options.length; i++) {
                            if (options[i].value === form.questionBankId) {
                                options[i].selected = true;
                                break;
                            }
                        }
                    }
                }
            } else {
                closeTaskModal();
                loadData();
            }
        } else {
            alert(res.msg || '操作失败');
        }
    } catch (err) {
        alert('操作失败: ' + err.message);
    }
}

async function deleteTask(taskId) {
    if (!confirm('确定要删除此学习任务吗？')) return;

    try {
        const res = await fetch(`${API_URL}/learning-materials/${taskId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        }).then(r => r.json());

        if (res.code === 0) {
            loadData();
        } else {
            // 如果有相关培训信息，显示详情
            if (res.data?.related_trainings?.length > 0) {
                const trainings = res.data.related_trainings.map(t => `• ${t.title || '培训' + t.id}`).join('\n');
                alert(`${res.msg}\n\n关联培训：\n${trainings}\n\n请先删除或修改这些培训的学习资料设置。`);
            } else {
                alert(res.msg || '删除失败');
            }
        }
    } catch (err) {
        alert('删除失败');
    }
}

function closeQuestionImport() {
    document.getElementById('questionImportModal').style.display = 'none';
    // 清除pending状态
    localStorage.removeItem('pendingExamTitle');
    localStorage.removeItem('pendingExamDesc');
    localStorage.removeItem('pendingExamStartTime');
    localStorage.removeItem('pendingExamEndTime');
    localStorage.removeItem('pendingExamDuration');
    localStorage.removeItem('pendingExamPassScore');
    localStorage.removeItem('pendingExamMode');
    localStorage.removeItem('pendingQuestionTitle');
    localStorage.removeItem('pendingQuestionDesc');
}

function showQuestionImport() {
    // 确保不是wizard模式
    localStorage.removeItem('pendingExamMode');
    document.getElementById('importExamTitle').value = '';
    document.getElementById('importExamDesc').value = '';
    document.getElementById('importText').value = '';
    document.getElementById('importFile').value = '';
    document.getElementById('fileInfo').textContent = '';
    document.getElementById('previewSection').style.display = 'none';
    document.getElementById('importResult').style.display = 'none';
    document.getElementById('questionImportModal').style.display = 'flex';
}

// 文件上传处理
document.getElementById('importFile')?.addEventListener('change', async function(e) {
    const file = e.target.files[0];
    if (!file) return;

    document.getElementById('fileInfo').textContent = `已选择：${file.name} (${(file.size/1024).toFixed(1)} KB)`;

    try {
        const res = await parseFileAPI(file);
        if (res.code === 0) {
            document.getElementById('importText').value = res.data.text;
            alert('文件解析成功');
        } else {
            alert(res.msg || '解析失败');
        }
    } catch (err) {
        alert('上传失败');
    }
});

async function parseFileAPI(file) {
    return new Promise((resolve, reject) => {
        const formData = new FormData();
        formData.append('file', file);

        fetch(`${API_URL}/import/parse-file`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        })
        .then(res => res.json())
        .then(data => resolve(data))
        .catch(err => reject(err));
    });
}

async function parseTextAPI(text) {
    const res = await fetch(`${API_URL}/import/parse-text`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
    });
    return res.json();
}

async function previewQuestions() {
    const text = document.getElementById('importText').value.trim();
    const fileInput = document.getElementById('importFile');
    const file = fileInput?.files?.[0];

    // 二选一：优先使用文件，其次使用文本
    if (!text && !file) {
        alert('请输入题目内容或上传文件');
        return;
    }

    try {
        let questions;
        if (file) {
            // 方式二：文件上传
            const parseRes = await parseFileAPI(file);
            if (parseRes.code !== 0) {
                alert(parseRes.msg || '文件解析失败');
                return;
            }
            questions = parseRes.data.questions;
        } else {
            // 方式一：文本解析
            const res = await parseTextAPI(text);
            if (res.code !== 0) {
                alert(res.msg || '预览失败');
                return;
            }
            questions = res.data.questions;
        }

        document.getElementById('previewCount').textContent = questions.length;

        const previewList = document.getElementById('previewList');
        if (questions.length === 0) {
            previewList.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-secondary);">未识别到题目</div>';
        } else {
            previewList.innerHTML = questions.map((q, idx) => `
                <div style="padding:12px;border-bottom:1px solid var(--border);">
                    <div style="font-weight:600;margin-bottom:8px;">
                        <span style="background:var(--accent);color:white;padding:2px 8px;border-radius:10px;font-size:11px;margin-right:8px;">${getQuestionTypeName(q.type)}</span>
                        <span style="color:var(--text-secondary);font-size:12px;">${q.score}分</span>
                        <strong>${idx + 1}.</strong> ${escapeHtml(q.content)}
                    </div>
                    ${q.options && q.options.length > 0 ? `
                        <div style="padding-left:20px;margin:8px 0;">
                            ${q.options.map((opt, i) => `<div style="margin:4px 0;">${String.fromCharCode(65 + i)}. ${escapeHtml(opt)}</div>`).join('')}
                        </div>
                    ` : ''}
                    ${q.answer ? `<div style="background:rgba(34,197,94,0.15);color:#22c55e;padding:8px;border-radius:var(--radius);font-weight:600;">✓ 答案：${escapeHtml(q.answer)}</div>` : ''}
                </div>
            `).join('');
        }

        document.getElementById('previewSection').style.display = 'block';
    } catch (err) {
        alert('预览失败');
    }
}

async function importQuestions() {
    // 检查token
    if (!token) {
        alert('请先登录');
        window.location.href = 'admin/login.html';
        return;
    }

    const examTitle = document.getElementById('importExamTitle').value.trim();
    const examDesc = document.getElementById('importExamDesc').value.trim();
    const text = document.getElementById('importText').value.trim();
    const fileInput = document.getElementById('importFile');
    const file = fileInput?.files?.[0];

    // 二选一：优先使用文件，其次使用文本
    if (!text && !file) {
        alert('请输入题目内容或上传文件');
        return;
    }

    if (!examTitle) {
        alert('请输入试卷标题');
        return;
    }

    // 检查是否是4步创建培训流程（通过pendingExamMode标记）
    const isWizardFlow = localStorage.getItem('pendingExamMode') === 'wizard';

    const resultEl = document.getElementById('importResult');

    try {
        if (isWizardFlow) {
            // 4步创建培训流程：保存题库数据，进入第4步
            if (file) {
                pendingQuestionFile = file;
                pendingQuestionData = null;
            } else {
                pendingQuestionData = text;
                pendingQuestionFile = null;
            }
            localStorage.setItem('pendingQuestionTitle', examTitle);
            localStorage.setItem('pendingQuestionDesc', examDesc);

            closeQuestionImport();
            currentStep = 4;
            updateStepUI();

            if (document.getElementById('radioManual')?.checked && step4AllStaff.length === 0) {
                loadStep4StaffList();
            }
        } else {
            // 题库管理直接导入：直接创建题库并导入题目
            resultEl.className = 'import-result';
            resultEl.textContent = '正在创建题库...';
            resultEl.style.display = 'block';

            // 1. 创建题库
            const createRes = await fetch(`${API_URL}/question-banks`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    title: examTitle,
                    description: examDesc,
                    duration: 60,
                    pass_score: 60
                })
            }).then(r => r.json());

            if (createRes.code !== 0) {
                throw new Error(createRes.msg || '创建题库失败');
            }

            const bankId = createRes.data?.id;
            resultEl.textContent = '题库创建成功，正在导入题目...';

            // 2. 导入题目
            const qRes = await importQuestionsAPI(file || text, bankId);
            if (qRes.code !== 0) {
                throw new Error(qRes.msg || '导入题目失败');
            }

            resultEl.className = 'import-result success';
            resultEl.textContent = `✅ 导入成功！已创建题库《${examTitle}》`;
            setTimeout(() => {
                closeQuestionImport();
                // 刷新题库列表
                loadData();
            }, 1500);
        }
    } catch (err) {
        console.error('Import error:', err);
        resultEl.className = 'import-result error';
        resultEl.textContent = '导入失败: ' + (err?.message || String(err));
    }
}

async function importQuestionsAPI(data, paperId) {
    console.log('importQuestionsAPI called with:', { dataType: typeof data, isFile: data instanceof File, paperId });
    console.log('Token:', token ? 'exists' : 'MISSING');

    // 判断是文件还是文本
    if (data instanceof File) {
        // 文件上传
        const formData = new FormData();
        formData.append('file', data);
        formData.append('paperId', paperId);

        const res = await fetch(`${API_URL}/import/upload`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });
        const result = await res.json();
        console.log('File import result:', result);
        return result;
    } else {
        // 文本上传
        console.log('Sending text import request:', { textLength: data.length, paperId });
        const res = await fetch(`${API_URL}/import/upload`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: data, paperId })
        });
        const result = await res.json();
        console.log('Text import result:', result);
        return result;
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============ 创建试卷 ============
function onQuestionBankChangeInline(value) {
    console.log('onQuestionBankChangeInline called, value=', value);
    const modal = document.getElementById('questionImportModal');
    console.log('questionImportModal element:', modal ? 'exists' : 'NOT FOUND');
    if (value === '__new__') {
        const title = document.getElementById('examTitle').value.trim();
        const description = document.getElementById('examDescription').value.trim();
        const start_time = document.getElementById('examStartTime').value;
        const end_time = document.getElementById('examEndTime').value;
        const duration = document.getElementById('examDuration').value || '60';
        const passScore = document.getElementById('examPassScore').value || '60';

        if (!title) {
            alert('请输入培训标题');
            document.getElementById('examQuestionBank').value = '';
            return;
        }

        pendingExamForm = {
            title, description, start_time, end_time, duration, pass_score: passScore,
            learningTaskId: document.getElementById('examLearningTask').value
        };

        localStorage.setItem('pendingExamTitle', title);
        localStorage.setItem('pendingExamDesc', description);
        localStorage.setItem('pendingExamStartTime', start_time);
        localStorage.setItem('pendingExamEndTime', end_time);
        localStorage.setItem('pendingExamDuration', duration);
        localStorage.setItem('pendingExamPassScore', passScore);
        localStorage.setItem('pendingExamMode', 'wizard');

        document.getElementById('importExamTitle').value = title;
        document.getElementById('importExamDesc').value = description;
        console.log('Setting questionImportModal display to flex');
        document.getElementById('questionImportModal').style.display = 'flex';
        console.log('questionImportModal display now:', document.getElementById('questionImportModal').style.display);
    } else if (value) {
        // 选择已有题库时，清除可能残留的待导入数据
        pendingQuestionFile = null;
        pendingQuestionData = null;
        localStorage.removeItem('pendingQuestionTitle');
        localStorage.removeItem('pendingQuestionDesc');
    }
}

function onLearningTaskChangeInline(value) {
    if (value === '__new__') {
        pendingExamForm = {
            title: document.getElementById('examTitle').value.trim(),
            description: document.getElementById('examDescription').value.trim(),
            start_time: document.getElementById('examStartTime').value,
            end_time: document.getElementById('examEndTime').value,
            duration: document.getElementById('examDuration').value || '60',
            pass_score: document.getElementById('examPassScore').value || '60',
            questionBankId: document.getElementById('examQuestionBank').value
        };
        hideCreateExamForm();
        showCreateTaskModal();
    }
}

let currentStep = 1;

function showCreateExamForm() {
    // 确保在培训任务标签页
    switchTab('papers');

    currentEditingExamId = null;
    currentStep = 1;
    step4SelectedIds.clear();
    const form = document.getElementById('createExamForm');
    if (!form) return;

    // 刷新学习资料下拉框
    const learningTaskSelect = document.getElementById('examLearningTask');
    if (learningTaskSelect) {
        let options = '<option value="">请选择学习资料</option>';
        if (trainingTasks && trainingTasks.length > 0) {
            options += trainingTasks.map(t => `<option value="${t.id}">${t.title || '资料 ' + t.id}</option>`).join('');
        }
        options += '<option value="__new__">+ 创建新资料</option>';
        learningTaskSelect.innerHTML = options;
    }

    // 刷新题库下拉框
    const questionBankSelect = document.getElementById('examQuestionBank');
    if (questionBankSelect) {
        questionBankSelect.innerHTML = '<option value="">请选择题库</option>' +
            questionBanks.map(b => `<option value="${b.id}">${b.title || '题库 ' + b.id} (${b.question_count || 0}题)</option>`).join('') +
            '<option value="__new__">+ 创建新题库</option>';
    }

    // 重置表单（保持HTML默认值）
    document.getElementById('examLearningTask').value = '';
    document.getElementById('examQuestionBank').value = '';
    const participantFileEl = document.getElementById('examParticipantsFile');
    if (participantFileEl) participantFileEl.value = '';
    const participantFileInfoEl = document.getElementById('participantFileInfo');
    if (participantFileInfoEl) participantFileInfoEl.style.display = 'none';
    document.getElementById('createExamResult').style.display = 'none';
    document.getElementById('selectedLearningTask').style.display = 'none';
    document.getElementById('selectedQuestionBank').style.display = 'none';

    // 更新标题
    const formTitle = document.getElementById('examFormTitle');
    if (formTitle) formTitle.textContent = '新建培训';

    // 初始化步骤UI
    updateStepUI();

    // 重置权限方式为"全员授权"
    const radioAll = document.getElementById('radioAllStaff');
    const radioManual = document.getElementById('radioManual');
    if (radioAll) radioAll.checked = true;
    if (radioManual) radioManual.checked = false;

    // 初始化权限UI状态
    togglePermType();

    // 显示表单
    form.style.display = 'block';
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function updateStepUI() {
    // 更新步骤指示器
    for (let i = 1; i <= 4; i++) {
        const stepItem = document.querySelector(`.step-item[data-step="${i}"]`);
        if (stepItem) {
            stepItem.classList.remove('active', 'completed');
            if (i < currentStep) {
                stepItem.classList.add('completed');
            } else if (i === currentStep) {
                stepItem.classList.add('active');
            }
        }
        const stepContent = document.getElementById(`step${i}`);
        if (stepContent) {
            stepContent.style.display = i === currentStep ? 'block' : 'none';
        }
    }

    // 更新按钮
    const prevBtn = document.getElementById('prevStepBtn');
    const nextBtn = document.getElementById('nextStepBtn');
    const submitBtn = document.getElementById('submitExamBtn');
    const draftBtn = document.getElementById('draftSubmitBtn');

    if (prevBtn) prevBtn.style.display = currentStep > 1 ? '' : 'none';
    if (nextBtn) nextBtn.style.display = currentStep < 4 ? '' : 'none';
    if (submitBtn) submitBtn.style.display = currentStep === 4 ? '' : 'none';
    if (draftBtn) draftBtn.style.display = currentStep === 4 ? 'none' : '';

    // 如果进入步骤3，刷新题库下拉框
    if (currentStep === 3) {
        refreshQuestionBankDropdown();
    }

    // 如果进入步骤4，初始化权限UI状态
    if (currentStep === 4) {
        togglePermType();
        if (document.getElementById('radioManual')?.checked && step4AllStaff.length === 0) {
            loadStep4StaffList();
        }
    }
}

function refreshQuestionBankDropdown() {
    const questionBankSelect = document.getElementById('examQuestionBank');
    if (questionBankSelect) {
        questionBankSelect.innerHTML = '<option value="">请选择题库</option>' +
            questionBanks.map(b => `<option value="${b.id}">${b.title || '题库 ' + b.id} (${b.question_count || 0}题)</option>`).join('') +
            '<option value="__new__">+ 创建新题库</option>';
    }
}

let step4AllStaff = [];
let step4SelectedIds = new Set();

async function loadStep4StaffList() {
    const container = document.getElementById('step4StaffList');
    if (!container) return;

    try {
        const res = await fetch(`${API_URL}/staff?all=1`, {
            headers: { 'Authorization': `Bearer ${token}` }
        }).then(r => r.json());

        if (res.code === 0) {
            step4AllStaff = res.data || [];
            // 默认全选所有员工（反向选择模式）
            step4SelectedIds.clear();
            step4AllStaff.forEach(s => step4SelectedIds.add(s.id));
            renderStep4StaffList('');
        } else {
            container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-soft);">加载失败</div>';
        }
    } catch (err) {
        container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-soft);">加载失败</div>';
    }
}

function renderStep4StaffList(filter) {
    const container = document.getElementById('step4StaffList');
    if (!container) return;

    const filtered = step4AllStaff.filter(s => {
        if (!filter) return true;
        const f = filter.toLowerCase();
        return (s.name || '').toLowerCase().includes(f) ||
               (s.employee_id || '').toLowerCase().includes(f);
    });

    if (filtered.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-soft);">无匹配员工</div>';
        return;
    }

    // 按部门分组
    const deptMap = {};
    filtered.forEach(s => {
        const dept = s.department || '未分组';
        if (!deptMap[dept]) deptMap[dept] = [];
        deptMap[dept].push(s);
    });

    const depts = Object.keys(deptMap).sort();
    container.innerHTML = depts.map(dept => {
        const staff = deptMap[dept];
        return `
            <div style="margin-bottom:12px;">
                <div style="font-size:12px;font-weight:600;color:var(--text-soft);padding:4px 0;border-bottom:1px solid var(--border);margin-bottom:6px;">${dept}</div>
                ${staff.map(s => `
                    <div style="display:flex;align-items:center;gap:8px;padding:6px 0;">
                        <input type="checkbox" id="step4_staff_${s.id}" value="${s.id}"
                            ${step4SelectedIds.has(s.id) ? 'checked' : ''}
                            onchange="toggleStep4Staff(${s.id})"
                            style="width:16px;height:16px;">
                        <span style="font-size:13px;">${s.name || '-'}</span>
                        <span style="font-size:11px;color:var(--text-soft);">${s.employee_id || ''}</span>
                    </div>
                `).join('')}
            </div>
        `;
    }).join('');

    document.getElementById('step4SelectedCount').textContent = step4SelectedIds.size;
    document.getElementById('step4TotalCount').textContent = step4AllStaff.length;
}

function toggleStep4Staff(id) {
    if (step4SelectedIds.has(id)) {
        step4SelectedIds.delete(id);
    } else {
        step4SelectedIds.add(id);
    }
    document.getElementById('step4SelectedCount').textContent = step4SelectedIds.size;
}

function togglePermType() {
    const radioAll = document.getElementById('radioAllStaff');
    const radioManual = document.getElementById('radioManual');
    const manualSection = document.getElementById('manualPermSection');
    const radioAllLabel = document.getElementById('radioAllStaffLabel');
    const radioManualLabel = document.getElementById('radioManualLabel');

    // 如果元素不存在，直接返回
    if (!radioAll || !radioManual || !manualSection || !radioAllLabel || !radioManualLabel) {
        return;
    }

    const isAll = radioAll.checked;

    if (isAll) {
        manualSection.style.display = 'none';
        radioAllLabel.style.borderColor = 'var(--primary)';
        radioAllLabel.style.background = 'rgba(74,144,226,0.08)';
        radioManualLabel.style.borderColor = 'var(--border)';
        radioManualLabel.style.background = 'var(--bg)';
    } else {
        manualSection.style.display = 'block';
        radioManualLabel.style.borderColor = 'var(--primary)';
        radioManualLabel.style.background = 'rgba(74,144,226,0.08)';
        radioAllLabel.style.borderColor = 'var(--border)';
        radioAllLabel.style.background = 'var(--bg)';
        // 加载员工列表
        if (step4AllStaff.length === 0) {
            loadStep4StaffList();
        }
    }
}

function filterStaffList(filter) {
    renderStep4StaffList(filter);
}

function selectAllStep4Staff() {
    step4AllStaff.forEach(s => step4SelectedIds.add(s.id));
    renderStep4StaffList(document.getElementById('staffSearchInput')?.value || '');
}

function deselectAllStep4Staff() {
    step4SelectedIds.clear();
    renderStep4StaffList(document.getElementById('staffSearchInput')?.value || '');
}

// 部门选择弹窗
function showDeptSelectModal() {
    const modal = document.getElementById('deptSelectModal');
    const container = document.getElementById('deptCheckboxes');

    // 获取所有部门
    const deptMap = {};
    step4AllStaff.forEach(s => {
        const dept = s.department || '未分组';
        if (!deptMap[dept]) deptMap[dept] = [];
        deptMap[dept].push(s);
    });

    const depts = Object.keys(deptMap).sort();
    container.innerHTML = depts.map(dept => `
        <div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border);">
            <input type="checkbox" id="dept_${dept}" value="${dept}" onchange="toggleDeptSelect('${dept}')" style="width:16px;height:16px;">
            <label for="dept_${dept}" style="flex:1;cursor:pointer;">${dept}</label>
            <span style="font-size:11px;color:var(--text-muted);">${deptMap[dept].length}人</span>
        </div>
    `).join('');

    modal.classList.add('active');
}

function closeDeptSelectModal() {
    document.getElementById('deptSelectModal').classList.remove('active');
}

function toggleDeptSelect(dept) {
    // This is just for visual feedback, the actual selection happens in confirmDeptSelect
}

function confirmDeptSelect() {
    const checkboxes = document.querySelectorAll('#deptCheckboxes input[type="checkbox"]');
    const selectedDepts = [];
    checkboxes.forEach(cb => {
        if (cb.checked) {
            selectedDepts.push(cb.value);
        }
    });

    // 选中所有属于所选部门的员工
    step4AllStaff.forEach(s => {
        const dept = s.department || '未分组';
        if (selectedDepts.includes(dept)) {
            step4SelectedIds.add(s.id);
        }
    });

    closeDeptSelectModal();
    renderStep4StaffList(document.getElementById('staffSearchInput')?.value || '');
}

function validateStep1() {
    const title = document.getElementById('examTitle').value.trim();
    const startTime = document.getElementById('examStartTime').value;
    const endTime = document.getElementById('examEndTime').value;
    const duration = document.getElementById('examDuration').value;
    const passScore = document.getElementById('examPassScore').value;

    if (!title) { alert('请输入培训标题'); return false; }
    if (!startTime) { alert('请选择培训开始时间'); return false; }
    if (!endTime) { alert('请选择培训结束时间'); return false; }
    if (new Date(startTime) >= new Date(endTime)) { alert('培训结束时间必须晚于开始时间'); return false; }
    if (!duration || duration < 1) { alert('请输入有效的考试时长'); return false; }
    if (!passScore || passScore < 1 || passScore > 100) { alert('请输入有效的及格分数(1-100)'); return false; }
    return true;
}

function nextStep() {
    console.log('nextStep called, currentStep=', currentStep);
    if (currentStep === 1) {
        if (!validateStep1()) return;
    }
    if (currentStep < 4) {
        currentStep++;
        console.log('nextStep: after increment currentStep=', currentStep, 'step4 display=', document.getElementById('step4')?.style.display);
        updateStepUI();
        console.log('nextStep: after updateStepUI step4 display=', document.getElementById('step4')?.style.display);
    } else {
        console.log('nextStep: currentStep >= 4, not incrementing');
    }
}

function prevStep() {
    if (currentStep > 1) {
        currentStep--;
        updateStepUI();
    }
}

function hideCreateExamForm() {
    const form = document.getElementById('createExamForm');
    if (form) form.style.display = 'none';
    currentStep = 1;
    step4SelectedIds.clear();
}

function showCreateExamModal() {
    showCreateExamForm();
}

function closeCreateExamModal() {
    hideCreateExamForm();
    currentEditingExamId = null;
}

async function draftExam() {
    const title = document.getElementById('examTitle').value.trim();
    const description = document.getElementById('examDescription').value.trim();
    const start_time = document.getElementById('examStartTime').value || null;
    const end_time = document.getElementById('examEndTime').value || null;
    const duration = parseInt(document.getElementById('examDuration').value) || 60;
    const pass_score = parseInt(document.getElementById('examPassScore').value) || 60;
    const questionBankId = document.getElementById('examQuestionBank').value;
    const learningTaskId = document.getElementById('examLearningTask').value;
    const participantFileEl = document.getElementById('examParticipantsFile');
    const participantFile = participantFileEl ? participantFileEl.files[0] : null;

    if (!title) {
        alert('请输入培训标题');
        return;
    }

    const resultEl = document.getElementById('createExamResult');

    try {
        const res = await fetch(`${API_URL}/exam-trainings`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                title,
                description,
                start_time,
                end_time,
                duration,
                pass_score,
                is_active: false,
                question_bank_id: questionBankId && questionBankId !== '__new__' ? parseInt(questionBankId) : null,
                learning_task_id: learningTaskId && learningTaskId !== '__new__' ? parseInt(learningTaskId) : null
            })
        }).then(r => r.json());

        if (res.code === 0) {
            resultEl.className = 'import-result success';
            resultEl.textContent = '已暂存！';
            resultEl.style.display = 'block';

            // 保存第四步选择的员工权限
            if (step4SelectedIds.size > 0) {
                await fetch(`${API_URL}/exam-trainings/${res.data.id}/permissions`, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ staff_ids: [...step4SelectedIds] })
                });
            }

            // 如果上传了人员文件，导入人员
            if (participantFile) {
                await importParticipants(res.data.id, participantFile);
            }

            closeCreateExamModal();
            loadData();
        } else {
            resultEl.className = 'import-result error';
            resultEl.textContent = res.msg || '暂存失败';
            resultEl.style.display = 'block';
        }
    } catch (err) {
        alert('暂存失败');
    }
}

async function createExam() {
    const title = document.getElementById('examTitle').value.trim();
    const description = document.getElementById('examDescription').value.trim();
    const start_time = document.getElementById('examStartTime').value || null;
    const end_time = document.getElementById('examEndTime').value || null;
    const duration = parseInt(document.getElementById('examDuration').value) || 60;
    const pass_score = parseInt(document.getElementById('examPassScore').value) || 60;
    const questionBankId = document.getElementById('examQuestionBank').value;
    const learningTaskId = document.getElementById('examLearningTask').value;
    const participantFileEl = document.getElementById('examParticipantsFile');
    const participantFile = participantFileEl ? participantFileEl.files[0] : null;

    if (!title) {
        alert('请输入培训标题');
        return;
    }

    // 如果选择创建新题库，先打开导入弹窗
    if (questionBankId === '__new__') {
        localStorage.setItem('pendingExamTitle', title);
        localStorage.setItem('pendingExamDesc', description);
        localStorage.setItem('pendingExamStartTime', start_time);
        localStorage.setItem('pendingExamEndTime', end_time);
        localStorage.setItem('pendingExamDuration', duration);
        localStorage.setItem('pendingExamPassScore', pass_score);
        localStorage.setItem('pendingLearningTaskId', learningTaskId);

        document.getElementById('importExamTitle').value = title;
        document.getElementById('importExamDesc').value = description;
        document.getElementById('questionImportModal').style.display = 'flex';
        return;
    }

    const resultEl = document.getElementById('createExamResult');

    try {
        let res;
        let successMsg = '';
        let newExam = null;

        // 如果是编辑模式，更新现有考试
        if (currentEditingExamId) {
            res = await fetch(`${API_URL}/exam-trainings/${currentEditingExamId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    title, description, start_time, end_time, duration, pass_score,
                    learning_task_id: learningTaskId && learningTaskId !== '__new__' ? parseInt(learningTaskId) : null,
                    question_bank_id: questionBankId && questionBankId !== '__new__' ? parseInt(questionBankId) : null
                })
            }).then(r => r.json());

            if (res.code !== 0) {
                resultEl.className = 'import-result error';
                resultEl.textContent = res.msg || '更新失败';
                resultEl.style.display = 'block';
                return;
            }
            successMsg = '考试设置已保存！';
        } else {
            // 创建新培训
            res = await fetch(`${API_URL}/exam-trainings`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    title, description, start_time, end_time, duration, pass_score,
                    is_active: false,
                    question_bank_id: questionBankId && questionBankId !== '__new__' ? parseInt(questionBankId) : null,
                    learning_task_id: learningTaskId && learningTaskId !== '__new__' ? parseInt(learningTaskId) : null
                })
            }).then(r => r.json());

            if (res.code !== 0) {
                resultEl.className = 'import-result error';
                resultEl.textContent = res.msg || '创建失败';
                resultEl.style.display = 'block';
                return;
            }

            newExam = res.data;
            successMsg = '考试创建成功！';

            // 如果有待导入的题库，先导入题库
            if (pendingQuestionFile || pendingQuestionData) {
                const examId = newExam.id;
                let qRes;
                if (pendingQuestionFile) {
                    qRes = await importQuestionsAPI(pendingQuestionFile, examId);
                } else {
                    qRes = await importQuestionsAPI(pendingQuestionData, examId);
                }
                if (qRes.code === 0) {
                    const qCount = qRes.data?.questionCount || qRes.data?.count || 0;
                    successMsg += `，已导入 ${qCount} 题`;
                }
                // 清除待导入数据
                pendingQuestionFile = null;
                pendingQuestionData = null;
                localStorage.removeItem('pendingQuestionTitle');
                localStorage.removeItem('pendingQuestionDesc');
            }
        }

        // 如果上传了人员文件，导入人员
        if (participantFile) {
            await importParticipants(newExam ? newExam.id : currentEditingExamId, participantFile);
            successMsg += ' 已导入考试人员';
        }

        // 保存第四步选择的员工权限
        const examId = newExam ? newExam.id : currentEditingExamId;
        const isAllStaff = document.getElementById('radioAllStaff')?.checked;

        if (isAllStaff) {
            // 全员授权：保存所有员工
            if (step4AllStaff.length === 0) {
                // 如果还没加载员工列表，先获取
                const staffRes = await fetch(`${API_URL}/staff?limit=10000`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                }).then(r => r.json());
                step4AllStaff = staffRes.data || [];
            }
            const permRes = await fetch(`${API_URL}/exam-trainings/${examId}/permissions`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ staff_ids: step4AllStaff.map(s => s.id) })
            }).then(r => r.json());

            if (permRes.code !== 0) {
                resultEl.className = 'import-result error';
                resultEl.textContent = '保存权限失败: ' + (permRes.msg || '未知错误');
                resultEl.style.display = 'block';
                return;
            }
        } else if (step4SelectedIds.size > 0) {
            // 手动选择：保存选中的员工
            const permRes = await fetch(`${API_URL}/exam-trainings/${examId}/permissions`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ staff_ids: [...step4SelectedIds] })
            }).then(r => r.json());

            if (permRes.code !== 0) {
                resultEl.className = 'import-result error';
                resultEl.textContent = '保存权限失败: ' + (permRes.msg || '未知错误');
                resultEl.style.display = 'block';
                return;
            }
        }

        resultEl.className = 'import-result success';
        resultEl.textContent = successMsg;
        resultEl.style.display = 'block';

        currentEditingExamId = null;

        setTimeout(() => {
            closeCreateExamModal();
            loadData();
        }, 1500);
    } catch (err) {
        console.error('创建培训失败:', err);
        resultEl.className = 'import-result error';
        resultEl.textContent = '操作失败: ' + (err.message || String(err));
        resultEl.style.display = 'block';
    }
}

async function copyQuestionsFromBank(sourceExamId, targetExamId) {
    try {
        await fetch(`${API_URL}/exam-trainings/${sourceExamId}/copy-questions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ targetExamId })
        });
    } catch (err) {
        console.error('复制题目失败:', err);
    }
}

async function importParticipants(examId, file) {
    const formData = new FormData();
    formData.append('file', file);

    try {
        const res = await fetch(`${API_URL}/exam-trainings/${examId}/import-participants`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });
        return res.json();
    } catch (err) {
        console.error('导入人员失败:', err);
    }
}

function downloadParticipantTemplate() {
    const link = document.createElement('a');
    link.href = '/uploads/考试人员导入模板.xlsx';
    link.download = '考试人员导入模板.xlsx';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ============ 启用/停止考试 ============
let currentToggleExamId = null;

async function toggleExamStatus(examId, currentStatus, currentTaskId) {
    if (currentStatus === 1) {
        // 当前是启用状态，点击变为停用
        if (!confirm('确定要停用此考试吗？停用后所有考试权限将失效。')) {
            return;
        }
        try {
            const res = await fetch(`${API_URL}/exam-trainings/${examId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ is_active: false })
            }).then(r => r.json());

            if (res.code === 0) {
                alert('考试已停用');
                loadData();
            } else {
                alert(res.msg || '操作失败');
            }
        } catch (err) {
            alert('操作失败');
        }
    } else {
        // 当前是停止状态，点击变为启用
        // 先检查是否绑定学习任务
        if (!currentTaskId || currentTaskId === 0) {
            alert('启用考试前请先在"设置"中绑定学习任务');
            return;
        }

        // 检查是否配置了考试人员权限
        try {
            const permRes = await fetch(`${API_URL}/exam-trainings/${examId}/permissions`, {
                headers: { 'Authorization': `Bearer ${token}` }
            }).then(r => r.json());

            const permCount = permRes.data?.length || 0;
            if (permCount === 0) {
                alert('启用考试前请先在"设置"中导入考试人员');
                return;
            }

            // 检查通过，弹出学习任务选择确认
            currentToggleExamId = examId;
            await showTaskSelectModal(examId, currentTaskId);
        } catch (err) {
            alert('检查权限失败');
        }
    }
}

// 查看考试人员权限
let currentPermExamId = null;
let allStaffForPerm = [];

async function viewExamPermissions(examId) {
    const targetExamId = examId || currentEditingExamId;
    if (!targetExamId) {
        alert('无法获取考试ID');
        return;
    }

    currentPermExamId = targetExamId;

    try {
        const res = await fetch(`${API_URL}/exam-trainings/${targetExamId}/permissions`, {
            headers: { 'Authorization': `Bearer ${token}` }
        }).then(r => r.json());

        if (res.code !== 0) {
            alert(res.msg || '获取权限失败');
            return;
        }

        allStaffForPerm = res.data || [];
        showPermissionsModal(allStaffForPerm);
    } catch (err) {
        alert('获取权限失败');
    }
}

function showPermissionsModal(staffList) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'permissionsModal';
    modal.style.cssText = 'position:fixed;z-index:2000;left:0;top:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;';

    // 按部门分组
    const deptMap = {};
    staffList.forEach(s => {
        const dept = s.department || '未分组';
        if (!deptMap[dept]) deptMap[dept] = [];
        deptMap[dept].push(s);
    });

    const depts = Object.keys(deptMap).sort();
    const selectedCount = staffList.filter(s => s.has_perm).length;

    const listHtml = depts.map(dept => {
        const staff = deptMap[dept];
        const deptSelected = staff.filter(s => s.has_perm).length;
        return `
            <div style="margin-bottom:12px;">
                <div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border);">
                    <input type="checkbox" id="dept_${dept.replace(/\s/g, '_')}"
                        ${deptSelected === staff.length ? 'checked' : ''}
                        onchange="toggleDept('${dept.replace(/'/g, "\\'")}', this.checked)">
                    <span style="font-weight:600;">${dept}</span>
                    <span style="color:var(--text-secondary);font-size:12px;">(${deptSelected}/${staff.length})</span>
                </div>
                <div style="padding-left:24px;">
                    ${staff.map(s => `
                        <div style="display:flex;align-items:center;gap:8px;padding:4px 0;">
                            <input type="checkbox" class="perm-staff-cb" data-staff-id="${s.id}"
                                ${s.has_perm ? 'checked' : ''}
                                onchange="updateDeptCheckbox('${dept.replace(/'/g, "\\'")}')">
                            <span style="font-size:13px;">${s.name}</span>
                            <span style="color:var(--text-secondary);font-size:12px;">${s.employee_id}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }).join('');

    modal.innerHTML = `
        <div style="background:var(--bg-card);border-radius:var(--radius-lg);padding:24px;width:90%;max-width:500px;max-height:80vh;overflow-y:auto;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
                <div style="font-size:18px;font-weight:700;">授权考试人员 (<span id="permSelectedCount">${selectedCount}</span>/<span id="permTotalCount">${staffList.length}</span>)</div>
                <button onclick="closePermissionsModal()" style="border:none;background:none;font-size:24px;cursor:pointer;">×</button>
            </div>

            <div style="display:flex;gap:8px;margin-bottom:12px;">
                <button class="btn btn-sm btn-secondary" onclick="selectAllPerm()">全选</button>
                <button class="btn btn-sm btn-secondary" onclick="deselectAllPerm()">全取消</button>
                <button class="btn btn-sm btn-primary" onclick="showDeptSelectModal()">按部门选择</button>
            </div>

            <div style="max-height:400px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;padding:12px;">
                ${staffList.length === 0 ? '<div style="text-align:center;padding:40px;color:var(--text-secondary);">暂无员工数据</div>' : listHtml}
            </div>

            <div style="display:flex;gap:10px;margin-top:16px;">
                <button class="btn btn-primary btn-sm" onclick="savePermissions()" style="flex:1;">保存</button>
                <button class="btn btn-secondary btn-sm" onclick="closePermissionsModal()" style="flex:1;">取消</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
}

function toggleDept(dept, checked) {
    document.querySelectorAll('.perm-staff-cb').forEach(cb => {
        const staffId = parseInt(cb.dataset.staffId);
        const staff = allStaffForPerm.find(s => s.id === staffId);
        if (staff && staff.department === dept) {
            cb.checked = checked;
        }
    });
    updateSelectedCount();
}

function updateDeptCheckbox(dept) {
    const staff = allStaffForPerm.filter(s => s.department === dept);
    const allChecked = staff.every(s => {
        const cb = document.querySelector(`.perm-staff-cb[data-staff-id="${s.id}"]`);
        return cb && cb.checked;
    });
    const deptCheckbox = document.getElementById('dept_' + dept.replace(/\s/g, '_'));
    if (deptCheckbox) deptCheckbox.checked = allChecked;
    updateSelectedCount();
}

function updateSelectedCount() {
    const checked = document.querySelectorAll('.perm-staff-cb:checked').length;
    document.getElementById('permSelectedCount').textContent = checked;
}

function selectAllPerm() {
    document.querySelectorAll('.perm-staff-cb').forEach(cb => cb.checked = true);
    document.querySelectorAll('input[id^="dept_"]').forEach(cb => cb.checked = true);
    updateSelectedCount();
}

function deselectAllPerm() {
    document.querySelectorAll('.perm-staff-cb').forEach(cb => cb.checked = false);
    document.querySelectorAll('input[id^="dept_"]').forEach(cb => cb.checked = false);
    updateSelectedCount();
}

async function savePermissions() {
    const checkedStaffIds = [];
    document.querySelectorAll('.perm-staff-cb:checked').forEach(cb => {
        checkedStaffIds.push(parseInt(cb.dataset.staffId));
    });

    try {
        const res = await fetch(`${API_URL}/exam-trainings/${currentPermExamId}/permissions`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ staff_ids: checkedStaffIds })
        }).then(r => r.json());

        if (res.code === 0) {
            alert('权限已保存');
            closePermissionsModal();
        } else {
            alert(res.msg || '保存失败');
        }
    } catch (err) {
        alert('保存失败');
    }
}

function closePermissionsModal() {
    const modal = document.getElementById('permissionsModal');
    if (modal) modal.remove();
    allStaffForPerm = [];
    currentPermExamId = null;
}

// 部门选择弹窗
function showDeptSelectModal() {
    const depts = [...new Set(allStaffForPerm.map(s => s.department || '未分组'))].sort();

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'deptSelectModal';
    modal.style.cssText = 'position:fixed;z-index:3000;left:0;top:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;';

    modal.innerHTML = `
        <div style="background:var(--bg-card);border-radius:var(--radius-lg);padding:24px;width:90%;max-width:400px;max-height:80vh;overflow-y:auto;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
                <div style="font-size:18px;font-weight:700;">选择部门</div>
                <button onclick="closeDeptSelectModal()" style="border:none;background:none;font-size:24px;cursor:pointer;">×</button>
            </div>

            <div style="max-height:400px;overflow-y:auto;">
                ${depts.map(dept => {
                    const count = allStaffForPerm.filter(s => (s.department || '未分组') === dept).length;
                    return `
                        <div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border);">
                            <input type="checkbox" id="dept_sel_${dept.replace(/\s/g, '_')}" onchange="toggleDeptSelection('${dept.replace(/'/g, "\\'")}', this.checked)">
                            <span style="flex:1;">${dept}</span>
                            <span style="color:var(--text-secondary);font-size:12px;">${count}人</span>
                        </div>
                    `;
                }).join('')}
            </div>

            <div style="display:flex;gap:10px;margin-top:16px;">
                <button class="btn btn-primary btn-sm" onclick="confirmDeptSelection()" style="flex:1;">确认</button>
                <button class="btn btn-secondary btn-sm" onclick="closeDeptSelectModal()" style="flex:1;">取消</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
}

function toggleDeptSelection(dept, checked) {
    allStaffForPerm.forEach(s => {
        if ((s.department || '未分组') === dept) {
            const cb = document.querySelector(`.perm-staff-cb[data-staff-id="${s.id}"]`);
            if (cb) cb.checked = checked;
        }
    });
}

function confirmDeptSelection() {
    document.querySelectorAll('input[id^="dept_sel_"]').forEach(deptCb => {
        if (deptCb.checked) {
            const dept = deptCb.id.replace('dept_sel_', '').replace(/_/g, ' ');
            allStaffForPerm.forEach(s => {
                if ((s.department || '未分组') === dept) {
                    const cb = document.querySelector(`.perm-staff-cb[data-staff-id="${s.id}"]`);
                    if (cb) cb.checked = true;
                }
            });
        }
    });
    closeDeptSelectModal();
    updateSelectedCount();
}

function closeDeptSelectModal() {
    const modal = document.getElementById('deptSelectModal');
    if (modal) modal.remove();
}

async function showTaskSelectModal(examId, currentTaskId) {
    const modal = document.getElementById('taskSelectModal');
    const select = document.getElementById('selectLearningTask');
    const taskInfo = document.getElementById('taskInfo');

    // 加载学习任务列表
    try {
        const res = await fetch(`${API_URL}/learning-materials`, {
            headers: { 'Authorization': `Bearer ${token}` }
        }).then(r => r.json());

        if (res.code === 0) {
            const tasks = res.data || [];
            // 过滤出未过期的学习任务
            const now = new Date();
            const validTasks = tasks.filter(t => !t.end_time || new Date(t.end_time) > now);

            select.innerHTML = '<option value="">请选择学习任务</option>';
            select.innerHTML += '<option value="0">未关联学习任务</option>';
            validTasks.forEach(task => {
                const endTime = task.end_time ? new Date(task.end_time).toLocaleString('zh-CN') : '无限制';
                const selected = task.id === currentTaskId ? 'selected' : '';
                select.innerHTML += `<option value="${task.id}" ${selected}>${task.title} (截止: ${endTime})</option>`;
            });

            // 如果有当前绑定的任务，显示信息
            if (currentTaskId) {
                const currentTask = tasks.find(t => t.id === currentTaskId);
                if (currentTask) {
                    taskInfo.style.display = 'block';
                    taskInfo.innerHTML = `<strong>当前绑定:</strong> ${currentTask.title}<br><strong>截止时间:</strong> ${currentTask.end_time ? new Date(currentTask.end_time).toLocaleString('zh-CN') : '无限制'}`;
                }
            }
        }
    } catch (err) {
        console.error('加载学习任务失败:', err);
    }

    // 选中变化时显示提示
    select.onchange = function() {
        if (this.value) {
            const selectedOption = select.options[select.selectedIndex];
            const taskTitle = selectedOption.text;
            taskInfo.style.display = 'block';
            taskInfo.innerHTML = `<strong>提示:</strong> 启用后，当学习任务"${taskTitle}"到期时，考试将自动停止。`;
        } else {
            taskInfo.style.display = 'none';
        }
    };

    modal.style.display = 'flex';
}

function closeTaskSelectModal() {
    document.getElementById('taskSelectModal').style.display = 'none';
    currentToggleExamId = null;
}

async function confirmEnableExam() {
    const select = document.getElementById('selectLearningTask');
    const taskId = select.value;

    if (!taskId) {
        alert('请选择学习任务');
        return;
    }

    // learning_task_id = 0 表示未关联学习任务
    const learningTaskId = taskId === '0' ? null : parseInt(taskId);

    try {
        const res = await fetch(`${API_URL}/exam-trainings/${currentToggleExamId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ is_active: true, learning_task_id: learningTaskId })
        }).then(r => r.json());

        if (res.code === 0) {
            alert('考试已启用');
            closeTaskSelectModal();
            loadData();
        } else {
            alert(res.msg || '启用失败');
        }
    } catch (err) {
        alert('启用失败');
    }
}

// ============ 培训记录详情 ============
async function showTrainingRecordDetail(taskId) {
    const task = myTrainingRecords.find(t => t.task_id === taskId);
    if (!task) return;

    // 获取任务详情（包括所有人员的学习进度）
    try {
        const res = await fetch(`${API_URL}/learning-materials/${taskId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        }).then(r => r.json());

        if (res.code !== 0) {
            alert(res.msg || '获取详情失败');
            return;
        }

        const taskDetail = res.data;
        const { stats, users, exam } = taskDetail;

        document.getElementById('trainingRecordModalTitle').textContent = task.task_title || '培训任务详情';

        const statusClass = task.my_status === 'completed' ? 'badge-success' : (task.my_status === 'in_progress' ? 'badge-warning' : 'badge-secondary');
        const statusText = task.my_status === 'completed' ? '已完成' : (task.my_status === 'in_progress' ? '学习中' : '未开始');

        let examInfoHtml = '';
        if (exam) {
            const examStatus = task.exam_passed === true ? '<span class="badge badge-success">已通过</span>' :
                              (task.exam_passed === false ? '<span class="badge badge-danger">未通过</span>' :
                              '<span class="badge badge-secondary">未参加</span>');
            examInfoHtml = `
                <div style="margin-top:12px;padding:12px;background:var(--bg-surface);border-radius:var(--radius);">
                    <div style="font-weight:600;margin-bottom:8px;">关联考试</div>
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <span>${exam.title}</span>
                        ${examStatus}
                    </div>
                </div>
            `;
        }

        document.getElementById('trainingRecordModalContent').innerHTML = `
            <div style="margin-bottom:16px;">
                <div style="display:flex;gap:8px;margin-bottom:12px;">
                    <span class="badge ${statusClass}">${statusText}</span>
                    <span class="badge badge-secondary">达成率 ${task.stats.achievement_rate}%</span>
                </div>
                ${task.description ? `<p style="color:var(--text-secondary);margin-bottom:12px;font-size:13px;">${escapeHtml(task.description)}</p>` : ''}
                <div style="font-size:13px;color:var(--text-secondary);margin-bottom:12px;">
                    ${task.start_time ? '开始: ' + new Date(task.start_time).toLocaleString('zh-CN') : '无开始时间'} ~
                    ${task.end_time ? '截止: ' + new Date(task.end_time).toLocaleString('zh-CN') : '无限制'}
                </div>
                <div style="display:flex;gap:16px;padding:12px;background:var(--bg-surface);border-radius:var(--radius);">
                    <div style="text-align:center;flex:1;">
                        <div style="font-size:20px;font-weight:700;color:var(--accent);">${stats.total}</div>
                        <div style="font-size:12px;color:var(--text-secondary);">总人数</div>
                    </div>
                    <div style="text-align:center;flex:1;">
                        <div style="font-size:20px;font-weight:700;color:var(--success);">${stats.completed}</div>
                        <div style="font-size:12px;color:var(--text-secondary);">已完成</div>
                    </div>
                    <div style="text-align:center;flex:1;">
                        <div style="font-size:20px;font-weight:700;color:var(--warning);">${stats.in_progress}</div>
                        <div style="font-size:12px;color:var(--text-secondary);">学习中</div>
                    </div>
                    <div style="text-align:center;flex:1;">
                        <div style="font-size:20px;font-weight:700;color:var(--text-secondary);">${stats.not_started}</div>
                        <div style="font-size:12px;color:var(--text-secondary);">未开始</div>
                    </div>
                </div>
                ${examInfoHtml}
            </div>

            <div style="margin-top:16px;">
                <div style="font-weight:600;margin-bottom:10px;">学习情况</div>
                <div style="max-height:300px;overflow-y:auto;border:1px solid var(--border);border-radius:var(--radius);">
                    <table style="width:100%;border-collapse:collapse;font-size:13px;">
                        <thead>
                            <tr style="background:var(--bg-surface);position:sticky;top:0;">
                                <th style="padding:8px;border-bottom:1px solid var(--border);text-align:left;">姓名</th>
                                <th style="padding:8px;border-bottom:1px solid var(--border);text-align:left;">工号</th>
                                <th style="padding:8px;border-bottom:1px solid var(--border);text-align:center;">状态</th>
                                <th style="padding:8px;border-bottom:1px solid var(--border);text-align:center;">进度</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${(users || []).map(u => {
                                const prog = u.progress?.progress_percent || 0;
                                const st = u.progress?.status || 'not_started';
                                const stClass = st === 'completed' ? 'badge-success' : (st === 'in_progress' ? 'badge-warning' : 'badge-secondary');
                                const stText = st === 'completed' ? '已完成' : (st === 'in_progress' ? '学习中' : '未开始');
                                return `
                                <tr>
                                    <td style="padding:8px;border-bottom:1px solid var(--border);">${u.nickname || u.username || u.name || '-'}</td>
                                    <td style="padding:8px;border-bottom:1px solid var(--border);">${u.username || u.employee_id || '-'}</td>
                                    <td style="padding:8px;border-bottom:1px solid var(--border);text-align:center;"><span class="badge ${stClass}">${stText}</span></td>
                                    <td style="padding:8px;border-bottom:1px solid var(--border);text-align:center;">${prog}%</td>
                                </tr>
                            `}).join('') || '<tr><td colspan="4" style="padding:20px;text-align:center;color:var(--text-secondary);">暂无数据</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        document.getElementById('trainingRecordModal').style.display = 'flex';
    } catch (err) {
        alert('获取详情失败');
    }
}

function closeTrainingRecordModal() {
    document.getElementById('trainingRecordModal').style.display = 'none';
}
