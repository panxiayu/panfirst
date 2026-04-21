// js/admin-new.js - 管理后台（简化版）

console.log('admin-new.js loaded');

function showToast(message, duration = 2000) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), duration);
}

async function initAdmin() {
  console.log('initAdmin start');
  
  // 1. 检查权限
  try {
    const userRes = await api.getCurrentUser();
    if (!userRes || userRes.data.role !== 'admin') {
      showToast('需要管理员权限');
      setTimeout(() => window.location.href = '/admin/login.html', 1500);
      return;
    }
    console.log('auth ok');
  } catch (err) {
    console.error('auth failed:', err);
    showToast('认证失败，请重新登录');
    return;
  }

  // 2. 确保容器存在
  const container = document.getElementById('mainContent');
  if (!container) {
    console.error('mainContent not found');
    document.body.innerHTML = '<div style="padding:20px;color:red;">错误：页面结构不完整，请刷新重试</div>';
    return;
  }
  console.log('container found');

  // 3. 加载数据
  let papers = [];
  try {
    const res = await api.getPaperList();
    console.log('getPaperList response:', res);
    if (res.code === 0) {
      papers = res.data || [];
    } else {
      throw new Error(res.msg || '获取试卷列表失败');
    }
  } catch (err) {
    console.error('load papers error:', err);
    showToast('加载试卷失败，请刷新重试');
    return;
  }
  console.log('papers:', papers);

  // 4. 渲染试卷列表
  try {
    renderPapers(container, papers);
    console.log('renderPapers success');
  } catch (err) {
    console.error('render error:', err);
    container.innerHTML = `<div style="padding:20px;color:red;">渲染失败：${err.message}</div>`;
  }

  // 5. 绑定事件
  setupEvents(container, papers);
}

function renderPapers(container, papers) {
  if (papers.length === 0) {
    container.innerHTML = `
      <div class="section">
        <div class="text-center" style="padding:40px;color:#999;">
          暂无试卷，请先导入题目
        </div>
      </div>
    `;
    return;
  }

  const html = `
    <div class="section">
      <h2 class="section-title">📚 试卷管理</h2>

      <div style="margin-bottom: 20px;">
        <button id="showImportBtn" class="btn btn-primary btn-small">导入新试卷</button>
      </div>

      <div class="paper-list" id="paperList">
        ${papers.map(p => `
          <div class="paper-card" data-paper-id="${p.id}">
            <div class="paper-card-header">
              <h3>${p.title || `试卷 ${p.id}`}</h3>
              <span class="paper-status ${p.is_active ? 'active' : 'inactive'}">
                ${p.is_active ? '已发布' : '未发布'}
              </span>
            </div>
            <div class="paper-card-body">
              <div class="paper-stat">
                <span class="stat-label">题目数量</span>
                <span class="stat-value">${p.question_count || 0} 题</span>
              </div>
              <div class="paper-stat">
                <span class="stat-label">试卷总分</span>
                <span class="stat-value">${p.total_score || 0} 分</span>
              </div>
              <div class="paper-stat">
                <span class="stat-label">答题人数</span>
                <span class="stat-value">${p.recordCount || 0} 人</span>
              </div>
              <div class="paper-stat">
                <span class="stat-label">创建时间</span>
                <span class="stat-value">${formatDate(p.created_at)}</span>
              </div>
            </div>
            <div class="paper-card-actions">
              <button class="btn btn-secondary btn-small view-detail-btn" data-paper-id="${p.id}">
                查看详细答题
              </button>
            </div>
          </div>
        `).join('')}
      </div>
    </div>

    <div class="section" id="importSection" style="display:none;">
      <h2 class="section-title">📥 导入试卷</h2>

      <div style="margin-bottom: 20px;">
        <label style="font-weight:600;margin-bottom:8px;display:block;">方式一：粘贴题目文本</label>
        <textarea id="importText" class="import-area" placeholder="请粘贴题目文本，每题格式：
1. 题目内容
A. 选项A
B. 选项B
C. 选项C
D. 选项D
答案：A

支持直接粘贴 Word 或记事本中的题目"></textarea>
      </div>

      <div style="margin-bottom: 20px;">
        <label style="font-weight:600;margin-bottom:8px;display:block;">方式二：上传文件（支持 docx/txt/doc）</label>
        <input type="file" id="importFile" accept=".docx,.txt,.doc" style="margin-bottom:8px;">
        <div id="fileInfo" style="font-size:12px;color:#999;margin-top:5px;"></div>
      </div>

      <div style="margin:15px 0;">
        <label style="font-weight:600;margin-bottom:8px;display:block;">试卷标题</label>
        <input type="text" id="paperTitle" class="form-control" placeholder="例如：第三套试卷">
      </div>

      <div style="display:flex;gap:10px;margin-bottom:15px;">
        <button id="previewBtn" class="btn btn-secondary btn-small">🔍 预览题目</button>
        <button id="importBtn" class="btn btn-primary btn-small">✅ 导入题目</button>
        <button id="cancelImportBtn" class="btn btn-secondary btn-small">取消</button>
      </div>

      <div id="previewSection" style="display:none;margin-top:15px;">
        <h4 style="margin-bottom:10px;">📋 预览（共 <span id="previewCount">0</span> 题）</h4>
        <div id="previewList" style="max-height:400px;overflow-y:auto;border:1px solid var(--border);border-radius:var(--radius);padding:10px;background:var(--bg-primary);"></div>
      </div>

      <div id="importResult" class="alert alert-info" style="display:none;margin-top:15px;"></div>
    </div>

    <style>
      .preview-item { padding: 12px; border-bottom: 1px solid var(--border); }
      .preview-item:last-child { border-bottom: none; }
      .preview-item .q-content { font-weight: 600; margin-bottom: 8px; }
      .preview-item .q-type { display: inline-block; padding: 2px 8px; background: var(--accent); color: white; border-radius: 10px; font-size: 11px; margin-right: 8px; }
      .preview-item .q-score { color: var(--text-secondary); font-size: 12px; }
      .preview-item .q-options { margin: 8px 0; padding-left: 20px; }
      .preview-item .q-option { margin: 4px 0; }
      .preview-item .q-answer { margin-top: 8px; padding: 8px; background: rgba(38,166,65,0.15); border-radius: var(--radius); color: var(--success); font-weight: 600; }
      .preview-empty { text-align: center; padding: 40px; color: var(--text-secondary); }
    </style>
  `;

  container.innerHTML = html;
}

function setupEvents(container, papers) {
  // 显示导入区域
  const showImportBtn = container.querySelector('#showImportBtn');
  const importSection = container.querySelector('#importSection');

  if (showImportBtn && importSection) {
    showImportBtn.addEventListener('click', () => {
      importSection.style.display = 'block';
      showImportBtn.style.display = 'none';
    });
  }

  // 取消导入
  const cancelImportBtn = container.querySelector('#cancelImportBtn');
  if (cancelImportBtn && showImportBtn && importSection) {
    cancelImportBtn.addEventListener('click', () => {
      importSection.style.display = 'none';
      showImportBtn.style.display = 'block';
    });
  }

  // 查看详情
  container.querySelectorAll('.view-detail-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const paperId = e.target.dataset.paperId;
      await viewPaperDetail(paperId);
    });
  });

  // 文件上传
  setupFileUpload(container);

  // 预览题目
  setupPreview(container);

  // 导入题目
  setupImport(container, papers);
}

function setupFileUpload(container) {
  const fileInput = container.querySelector('#importFile');
  if (!fileInput) return;

  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const fileInfo = container.querySelector('#fileInfo');
    fileInfo.textContent = `已选择：${file.name} (${(file.size/1024).toFixed(1)} KB)`;

    // 上传并解析文件
    try {
      const res = await api.parseFile(file);
      if (res.code === 0) {
        container.querySelector('#importText').value = res.data.text;
        showToast('文件解析成功');
      } else {
        showToast(res.msg || '解析失败');
      }
    } catch (err) {
      showToast(err.message || '上传失败');
    }
  });
}

function setupPreview(container) {
  const previewBtn = container.querySelector('#previewBtn');
  if (!previewBtn) return;

  previewBtn.addEventListener('click', async () => {
    const text = container.querySelector('#importText').value.trim();
    if (!text) {
      showToast('请输入或粘贴题目内容');
      return;
    }

    try {
      const res = await api.parseText(text);
      if (res.code === 0) {
        const questions = res.data.questions;
        const previewSection = container.querySelector('#previewSection');
        const previewList = container.querySelector('#previewList');
        const previewCount = container.querySelector('#previewCount');

        previewCount.textContent = questions.length;

        if (questions.length === 0) {
          previewList.innerHTML = '<div class="preview-empty">未识别到题目，请检查格式</div>';
        } else {
          previewList.innerHTML = questions.map((q, idx) => `
            <div class="preview-item">
              <div class="q-content">
                <span class="q-type">${getTypeName(q.type)}</span>
                <span class="q-score">${q.score}分</span>
                <strong>${idx + 1}.</strong> ${escapeHtml(q.content)}
              </div>
              ${q.options && q.options.length > 0 ? `
                <div class="q-options">
                  ${q.options.map((opt, i) => `<div class="q-option">${String.fromCharCode(65 + i)}. ${escapeHtml(opt)}</div>`).join('')}
                </div>
              ` : ''}
              ${q.answer ? `<div class="q-answer">✓ 答案：${escapeHtml(q.answer)}</div>` : ''}
            </div>
          `).join('');
        }

        previewSection.style.display = 'block';
      } else {
        showToast(res.msg || '预览失败');
      }
    } catch (err) {
      showToast(err.message || '预览失败');
    }
  });
}

function getTypeName(type) {
  const typeMap = {
    'single_choice': '单选题',
    'multiple_choice': '多选题',
    'true_false': '判断题',
    'fill_blank': '填空题',
    'essay': '简答题'
  };
  return typeMap[type] || type || '选择题';
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function setupImport(container, papers) {
  const importBtn = container.querySelector('#importBtn');
  if (!importBtn) return;

  importBtn.addEventListener('click', async () => {
    const text = container.querySelector('#importText').value.trim();
    const title = container.querySelector('#paperTitle').value.trim() || `第${papers.length + 1}套试卷`;
    
    if (!text) {
      showToast('请输入题目内容');
      return;
    }

    try {
      const res = await api.importQuestions(text, title);
      if (res.code === 0) {
        const resultEl = container.querySelector('#importResult');
        resultEl.style.display = 'block';
        resultEl.innerHTML = `
          <strong>导入成功！</strong><br>
          试卷：${title}<br>
          题目：${res.data.questionCount} 题<br>
          总分：${res.data.totalScore} 分
        `;
        container.querySelector('#importText').value = '';
        container.querySelector('#fileInfo').textContent = '';
        container.querySelector('#importFile').value = '';
        container.querySelector('#paperTitle').value = '';

        // 刷新列表
        const newRes = await api.getPaperList();
        if (newRes.code === 0) {
          renderPapers(container, newRes.data);
          setupEvents(container, newRes.data);
        }
      } else {
        showToast(res.msg || '导入失败');
      }
    } catch (err) {
      showToast(err.message || '导入失败');
    }
  });
}

async function viewPaperDetail(paperId) {
  const container = document.getElementById('mainContent');
  if (!container) return;

  try {
    const res = await api.getPaperDetail(paperId);
    if (res.code !== 0) {
      showToast(res.msg || '加载失败');
      return;
    }
    renderPaperDetail(container, res.data);
  } catch (err) {
    showToast(err.message || '加载失败');
  }
}

function renderPaperDetail(container, data) {
  const exam = data.exam;
  const records = data.records;

  container.innerHTML = `
    <div class="section">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
        <h2 class="section-title" style="margin:0;">
          📝 ${exam.title || `试卷 ${exam.id}`} - 答题详情
        </h2>
        <div>
          <button id="backToPapers" class="btn btn-secondary btn-small">← 返回</button>
          <button id="exportDetailBtn" class="btn btn-primary btn-small">打印成绩</button>
        </div>
      </div>

      <div class="alert alert-info">
        总分：${exam.total_score || 0} 分 | 及格：${exam.pass_score || 60} 分 | 
        题数：${data.questions.length} 题 | 人数：${records.length} 人
      </div>

      <div class="records-detail-list">
        ${records.map(r => `
          <div class="record-detail-item">
            <div class="record-detail-header">
              <div class="record-detail-name">
                <span class="name">${r.nickname || '未命名'}</span>
                <span class="openid">${r.openid.substring(0,15)}</span>
              </div>
              <div class="record-detail-score">
                <span class="score ${r.totalScore >= exam.pass_score ? 'pass' : 'fail'}">
                  ${r.totalScore} 分
                </span>
                <span class="status">${r.isPassed ? '及格' : '不及格'}</span>
              </div>
            </div>
            <div class="record-detail-answers">
              ${r.detailedAnswers.map((ans, idx) => `
                <div class="answer-item ${ans.isCorrect ? 'correct' : 'wrong'}">
                  <div class="question-preview">
                    <strong>第${idx + 1}题：</strong>${ans.questionContent.substring(0, 80)}...
                  </div>
                  <div class="answer-detail">
                    <span class="answer-user">你的答案：${formatAnswer(ans.userAnswer, ans.questionType)}</span>
                    <span class="answer-correct">正确答案：${formatAnswer(ans.correctAnswer, ans.questionType)}</span>
                    <span class="answer-score">${ans.isCorrect ? '+' + ans.score : '0'}分</span>
                  </div>
                </div>
              `).join('')}
            </div>
            <div class="record-detail-time">
              提交时间：${formatDateTime(r.submittedAt)}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  // 绑定返回按钮
  const backBtn = container.querySelector('#backToPapers');
  if (backBtn) {
    backBtn.addEventListener('click', () => initAdmin());
  }

  // 打印按钮
  const exportBtn = container.querySelector('#exportDetailBtn');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => generateDetailPrintPage(data));
  }
}

function generateDetailPrintPage(data) {
  const exam = data.exam;
  const records = data.records;
  const printDate = new Date().toLocaleString();

  const printContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${exam.title} - 答题详情</title>
  <style>
    body { font-family: sans-serif; padding: 20px; }
    h1 { text-align: center; margin-bottom: 10px; }
    .info { text-align: center; color: #666; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; page-break-inside: auto; }
    thead { display: table-header-group; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
    th { background: #f5f5f5; font-weight: bold; }
    tr { page-break-inside: avoid; page-break-after: auto; }
    .pass { color: #07c160; }
    .fail { color: #ff6b6b; }
    .correct { background-color: #e8f5e9; }
    .wrong { background-color: #ffebee; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <h1>${exam.title}</h1>
  <div class="info">
    打印时间：${printDate}<br>
    总分：${exam.total_score || 0} 分 | 及格：${exam.pass_score || 60} 分<br>
    人数：${records.length} 人
  </div>
  ${records.map((r, idx) => `
    <div class="student-record">
      <h3 style="margin:15px 0 5px;">
        姓名：${r.nickname || '未命名'} | 
        总分：<span class="${r.totalScore >= exam.pass_score ? 'pass' : 'fail'}">${r.totalScore}</span> 分 |
        状态：${r.isPassed ? '及格' : '不及格'}
      </h3>
      <table>
        <thead>
          <tr>
            <th style="width:50px;">题号</th>
            <th>题目</th>
            <th style="width:80px;">你的答案</th>
            <th style="width:80px;">正确答案</th>
            <th style="width:50px;">得分</th>
          </tr>
        </thead>
        <tbody>
          ${r.detailedAnswers.map((ans, qIdx) => `
            <tr class="${ans.isCorrect ? 'correct' : 'wrong'}">
              <td>${qIdx + 1}</td>
              <td>${ans.questionContent}</td>
              <td>${formatAnswer(ans.userAnswer, ans.questionType)}</td>
              <td>${formatAnswer(ans.correctAnswer, ans.questionType)}</td>
              <td class="${ans.isCorrect ? 'pass' : 'fail'}">${ans.isCorrect ? '+' + ans.score : '0'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      ${idx < records.length - 1 ? '<div style="page-break-after: always;"></div>' : ''}
    </div>
  `).join('')}
  <script>window.onload = () => setTimeout(() => window.print(), 500);</script>
</body>
</html>
  `;

  const printWindow = window.open('', '_blank');
  printWindow.document.write(printContent);
  printWindow.document.close();
}

function formatAnswer(answer, type) {
  if (!answer) return '未作答';
  if (type === 'multiple_choice') {
    return answer.split(',').join('、');
  }
  return answer;
}

function formatDate(isoString) {
  if (!isoString) return '-';
  const d = new Date(isoString);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function formatDateTime(isoString) {
  if (!isoString) return '-';
  const d = new Date(isoString);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

// 启动
initAdmin().catch(err => {
  console.error('initAdmin failed:', err);
  document.body.innerHTML = `<div style="padding:20px;color:red;">初始化失败：${err.message}</div>`;
});
