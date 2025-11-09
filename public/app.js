// API 基础 URL
const API_URL = 'http://localhost:3000/api';

let currentArticleId = null;

// 页面加载时获取所有文章
document.addEventListener('DOMContentLoaded', () => {
  loadArticles();
  initTabMenu();
  initFileUpload();
});

// 初始化标签页菜单
function initTabMenu() {
  $('.menu .item').tab();
}

// 初始化文件上传
function initFileUpload() {
  const uploadArea = document.getElementById('uploadArea');
  const fileInput = document.getElementById('fileInput');
  const fileInfo = document.getElementById('fileInfo');
  const fileName = document.getElementById('fileName');

  // 点击上传区域触发文件选择
  uploadArea.addEventListener('click', () => {
    fileInput.click();
  });

  // 文件选择变化
  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      const file = e.target.files[0];
      fileName.textContent = file.name;
      fileInfo.style.display = 'block';
    }
  });

  // 拖拽上传
  uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
  });

  uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
  });

  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].name.endsWith('.txt')) {
      fileInput.files = files;
      fileName.textContent = files[0].name;
      fileInfo.style.display = 'block';
    } else {
      showWarning('请上传 .txt 格式的文件');
    }
  });
}

// 获取所有文章
async function loadArticles() {
  try {
    const response = await fetch(`${API_URL}/articles`);
    const articles = await response.json();
    
    renderArticles(articles);
    updateStats(articles);
  } catch (error) {
    console.error('加载文章错误:', error);
    showError('加载文章失败');
  }
}

// 渲染文章列表
function renderArticles(articles) {
  const container = document.getElementById('articlesList');
  
  if (articles.length === 0) {
    container.innerHTML = '<div class="ui placeholder segment"><div class="ui icon header"><i class="inbox icon"></i>暂无文章</div></div>';
    return;
  }
  
  container.innerHTML = articles.map(article => `
    <div class="ui segment article-item" data-id="${article.id}">
      <div class="article-title">${escapeHtml(article.title)}</div>
      <div class="article-preview">${escapeHtml(article.content)}</div>
      <div class="article-meta">
        <i class="calendar icon"></i>
        ${formatDate(article.createdAt)}
        <span style="margin-left: 20px;">
          <i class="font icon"></i>
          ${article.wordCount} 词
        </span>
        <span style="margin-left: 20px;">
          <a href="/article/${article.id}" target="_blank" class="ui primary mini button" onclick="event.stopPropagation()">
            <i class="external alternate icon"></i>
            查看详情
          </a>
          <button class="ui red mini button" onclick="event.stopPropagation(); deleteArticle(${article.id})">
            <i class="trash icon"></i>
            删除
          </button>
        </span>
      </div>
    </div>
  `).join('');
}

// 通过文本添加文章
async function addArticleByText() {
  const title = document.getElementById('articleTitle').value.trim();
  const content = document.getElementById('articleContent').value.trim();
  
  if (!title) {
    showWarning('请输入文章标题');
    return;
  }
  
  if (!content) {
    showWarning('请输入文章内容');
    return;
  }
  
  try {
    const response = await fetch(`${API_URL}/articles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ title, content })
    });
    
    if (!response.ok) {
      throw new Error('添加文章失败');
    }
    
    document.getElementById('articleTitle').value = '';
    document.getElementById('articleContent').value = '';
    showSuccess('文章已添加');
    loadArticles();
  } catch (error) {
    console.error('添加文章错误:', error);
    showError('添加文章失败');
  }
}

// 通过文件上传添加文章
async function addArticleByFile() {
  const fileInput = document.getElementById('fileInput');
  const title = document.getElementById('fileArticleTitle').value.trim();
  
  if (fileInput.files.length === 0) {
    showWarning('请选择要上传的文件');
    return;
  }
  
  const file = fileInput.files[0];
  
  if (!file.name.endsWith('.txt')) {
    showWarning('只支持 .txt 格式文件');
    return;
  }
  
  try {
    const formData = new FormData();
    formData.append('file', file);
    if (title) {
      formData.append('title', title);
    }
    
    const response = await fetch(`${API_URL}/articles/upload`, {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      throw new Error('上传文件失败');
    }
    
    document.getElementById('fileArticleTitle').value = '';
    fileInput.value = '';
    document.getElementById('fileInfo').style.display = 'none';
    showSuccess('文章已上传');
    loadArticles();
  } catch (error) {
    console.error('上传文件错误:', error);
    showError('上传文件失败');
  }
}

// 删除文章
async function deleteArticle(id) {
  if (!confirm('确定要删除这篇文章吗？')) {
    return;
  }
  
  try {
    const response = await fetch(`${API_URL}/articles/${id}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      throw new Error('删除文章失败');
    }
    
    showSuccess('文章已删除');
    loadArticles();
  } catch (error) {
    console.error('删除文章错误:', error);
    showError('删除文章失败');
  }
}

// 更新统计信息
function updateStats(articles) {
  document.getElementById('articleCount').textContent = articles.length;
  
  const totalWords = articles.reduce((sum, article) => sum + article.wordCount, 0);
  document.getElementById('totalWords').textContent = totalWords.toLocaleString();
  
  if (articles.length > 0) {
    const latest = articles[articles.length - 1];
    document.getElementById('lastUpdateTime').textContent = formatDate(latest.createdAt);
  } else {
    document.getElementById('lastUpdateTime').textContent = '-';
  }
}

// 工具函数

function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins} 分钟前`;
  if (diffHours < 24) return `${diffHours} 小时前`;
  if (diffDays < 7) return `${diffDays} 天前`;
  
  return date.toLocaleDateString('zh-CN') + ' ' + date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

// 通知函数
function showSuccess(message) {
  showNotification(message, 'success');
}

function showWarning(message) {
  showNotification(message, 'warning');
}

function showError(message) {
  showNotification(message, 'error');
}

function showNotification(message, type) {
  // 使用 Semantic UI 的 toast 或其他通知方式
  // 简单实现：使用浏览器的 alert（可以用 Semantic UI 的 modal 替代）
  const icon = type === 'success' ? '✓' : type === 'warning' ? '⚠' : '✕';
  console.log(`[${type.toUpperCase()}] ${message}`);
  
  // 创建一个临时的通知元素
  const notification = document.createElement('div');
  notification.className = `ui ${type === 'success' ? 'positive' : type === 'warning' ? 'warning' : 'negative'} message`;
  notification.style.position = 'fixed';
  notification.style.top = '20px';
  notification.style.right = '20px';
  notification.style.minWidth = '300px';
  notification.style.zIndex = '9999';
  notification.innerHTML = `
    <i class="close icon" onclick="this.parentElement.remove()"></i>
    <div class="header">${message}</div>
  `;
  
  document.body.appendChild(notification);
  
  // 3 秒后自动删除
  setTimeout(() => {
    if (notification.parentElement) {
      notification.remove();
    }
  }, 3000);
}
