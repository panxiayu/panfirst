// js/api.js - HTTP API 封装
// 使用相对路径，自动适配当前域名和端口
const API_BASE = '';

// 获取 token
function getToken() {
  return localStorage.getItem('token') || '';
}

// 设置 token
function setToken(token) {
  localStorage.setItem('token', token);
}

// 清除 token（退出登录）
function clearToken() {
  localStorage.removeItem('token');
}

// 通用请求方法
async function request(options) {
  const token = getToken();

  const headers = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config = {
    url: `${API_BASE}${options.url}`,
    method: options.method || 'GET',
    headers: headers,
    data: options.data || {},
  };

  try {
    const response = await fetch(config.url, {
      method: config.method,
      headers: config.headers,
      body: ['GET', 'HEAD'].includes(config.method) ? undefined : JSON.stringify(config.data),
    });

    const data = await response.json();

    if (!response.ok || data.code !== 0) {
      throw new Error(data.msg || '请求失败');
    }

    return data;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}

// API 方法
const api = {
  // 登录
  login: async (openid, nickname, avatar = '') => {
    const res = await request({
      url: '/api/auth/login',
      method: 'POST',
      data: { openid, nickname, avatar }
    });
    if (res.code === 0) {
      setToken(res.data.token);
    }
    return res;
  },

  // 管理员登录
  adminLogin: async (username, password) => {
    const res = await request({
      url: '/api/auth/login',
      method: 'POST',
      data: { username, password }
    });
    if (res.code === 0) {
      setToken(res.data.token);
    }
    return res;
  },

  // 获取考试列表
  getExamList: () => request({
    url: '/api/exam/list'
  }),

  // 获取考试详情
  getExamDetail: (examId) => request({
    url: `/api/exam/${examId}`
  }),

  // 获取用户信息
  getCurrentUser: () => request({
    url: '/api/auth/me',
    method: 'GET'
  }),

  // 开始考试
  startExam: (examId) => request({
    url: '/api/exam/start',
    method: 'POST',
    data: { examId }
  }),

  // 提交答案
  submitExam: (answerId, responses) => request({
    url: '/api/exam/submit',
    method: 'POST',
    data: { answerId, responses }
  }),

  // 获取所有考试记录（管理员）
  getAllExamRecords: () => request({
    url: '/api/exam-admin/records',
    method: 'GET'
  }),

  // 导入题目（管理员）
  importQuestions: (text, paperTitle) => request({
    url: '/api/import/upload',
    method: 'POST',
    data: { text, paperTitle }
  }),

  // 上传文件并提取文本（管理员）
  uploadFile: (file) => {
    return new Promise((resolve, reject) => {
      const token = getToken();
      const formData = new FormData();
      formData.append('file', file);

      fetch(`${API_BASE}/api/import/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      })
      .then(res => res.json())
      .then(data => {
        if (data.code !== 0) {
          throw new Error(data.msg || '上传失败');
        }
        resolve(data);
      })
      .catch(err => reject(err));
    });
  },

  // 解析文本题目（管理员）
  parseText: (text) => request({
    url: '/api/import/parse-text',
    method: 'POST',
    data: { text }
  }),

  // 上传并解析文件（管理员）
  parseFile: (file) => {
    return new Promise((resolve, reject) => {
      const token = getToken();
      const formData = new FormData();
      formData.append('file', file);

      fetch(`${API_BASE}/api/import/parse-file`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      })
      .then(res => res.json())
      .then(data => {
        if (data.code !== 0) {
          throw new Error(data.msg || '解析失败');
        }
        resolve(data);
      })
      .catch(err => reject(err));
    });
  },

  // 获取试卷列表（管理员）
  getPaperList: () => request({
    url: '/api/exam-admin/papers',
    method: 'GET'
  }),

  // 获取试卷详细答题记录（管理员）
  getPaperDetail: (paperId) => request({
    url: `/api/exam-admin/paper/${paperId}`,
    method: 'GET'
  }),
};

// 退出登录
function logout() {
  clearToken();
  window.location.href = '/';
}

// 检查登录状态
function checkLogin() {
  return !!getToken();
}
