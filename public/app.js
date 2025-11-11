// API 基础 URL
const API_URL = 'http://localhost:3000/api';

let currentUser = null;

// 页面加载时检查登录状态
document.addEventListener('DOMContentLoaded', () => {
  checkLoginStatus();
  loadArticles(); // 无论是否登录都加载文章
  initTabMenu();
  initFileUpload();
});

// 检查登录状态
async function checkLoginStatus() {
  try {
    const response = await fetch(`${API_URL}/current-user`, {
      credentials: 'include'
    });
    
    if (response.ok) {
      const data = await response.json();
      currentUser = data; // includes userId
      showUserUI(currentUser);
    } else {
      showGuestUI();
    }
  } catch (error) {
    console.error('检查登录状态错误:', error);
    showGuestUI();
  }
}

// 显示已登录用户界面
function showUserUI(user) {
  document.getElementById('addArticleForm').classList.remove('hidden');
  const userInfo = document.getElementById('userInfo');
  userInfo.innerHTML = `
    <div class="ui secondary menu">
        <div class="item">
            <i class="user icon"></i>
            <span>${escapeHtml(user.username)}</span>
        </div>
        <div class="item">
            <button class="ui button" onclick="logout()">登出</button>
        </div>
    </div>
  `;
  userInfo.style.display = 'block';
}

// 显示访客界面
function showGuestUI() {
  document.getElementById('addArticleForm').classList.add('hidden');
  const userInfo = document.getElementById('userInfo');
  userInfo.innerHTML = `
    <div class="ui secondary menu">
      <div class="item">
        <a href="/login" class="ui primary button">登录/注册</a>
      </div>
    </div>
  `;
  userInfo.style.display = 'block';
}


// 用户登出
async function logout() {
  try {
    const response = await fetch(`${API_URL}/logout`, {
      method: 'POST',
      credentials: 'include'
    });
    
    if (response.ok) {
      currentUser = null;
      showGuestUI();
      loadArticles(); // 重新加载文章列表，以访客身份
    }
  } catch (error) {
    console.error('登出错误:', error);
    showError('登出失败');
  }
}

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
    if (files.length > 0 && files[0].name.endsWith('.md')) {
      fileInput.files = files;
      fileName.textContent = files[0].name;
      fileInfo.style.display = 'block';
    } else {
      showWarning('请上传 .md 格式的文件');
    }
  });
}

// 获取所有文章
async function loadArticles() {
  try {
    const response = await fetch(`${API_URL}/articles`, {
      credentials: 'include'
    });
    const articles = await response.json();
    
    renderArticles(articles);
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
  
  container.innerHTML = articles.map(article => {
    const isAuthor = currentUser && article.authorId === currentUser.userId;
    const deleteButton = isAuthor ? `
      <button class="ui red mini button" onclick="event.stopPropagation(); deleteArticle('${article.id}')">
        <i class="trash icon"></i>
        删除
      </button>
    ` : '';
    const publishButton = isAuthor && article.isPrivate ? `
      <button class="ui orange mini button" onclick="event.stopPropagation(); publishArticle('${article.id}')">
        <i class="unlock icon"></i>
        设为公开
      </button>
    ` : '';
    const privacyBadge = article.isPrivate
      ? '<span class="ui red mini label">私有</span>'
      : '<span class="ui green mini label">公开</span>';
    
    return `
      <div class="ui segment article-item" data-id="${article.id}">
        <div class="article-title">${escapeHtml(article.title)} ${privacyBadge}</div>
        <div class="article-preview">${escapeHtml(article.content)}</div>
        <div class="article-meta">
          ${article.author ? `<i class="user icon"></i>${escapeHtml(article.author)}` : '<i class="user outline icon"></i>匿名'}
          <span style="margin-left: 20px;">
            <i class="calendar icon"></i>
            ${formatDate(article.createdAt)}
          </span>
          <span style="margin-left: 20px;">
            <i class="font icon"></i>
            ${article.wordCount} 词
          </span>
          <span style="margin-left: 20px;">
            ${deleteButton} ${publishButton}
          </span>
        </div>
      </div>
    `;
  }).join('');

  // 让整块文章卡片都可点击跳转到详情
  const items = container.querySelectorAll('.article-item');
  items.forEach(item => {
    item.addEventListener('click', () => {
      const id = item.getAttribute('data-id');
      if (id) {
        window.location.href = `/article/${id}`;
      }
    });
  });
}

// 通过文本添加文章
async function addArticleByText() {
  const title = document.getElementById('articleTitle').value.trim();
  const content = document.getElementById('articleContent').value.trim();
  const isPrivate = document.getElementById('textPrivateCheckbox').checked;
  
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
      credentials: 'include',
      body: JSON.stringify({ title, content, isPrivate })
    });
    
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || '添加文章失败');
    }
    
    document.getElementById('articleTitle').value = '';
    document.getElementById('articleContent').value = '';
    document.getElementById('textPrivateCheckbox').checked = false;
    showSuccess('文章已添加');
    loadArticles();
  } catch (error) {
    console.error('添加文章错误:', error);
    showError(error.message || '添加文章失败');
  }
}

// 通过文件上传添加文章
async function addArticleByFile() {
  const fileInput = document.getElementById('fileInput');
  const title = document.getElementById('fileArticleTitle').value.trim();
  const isPrivate = document.getElementById('filePrivateCheckbox').checked;
  
  if (fileInput.files.length === 0) {
    showWarning('请选择要上传的文件');
    return;
  }
  
  const file = fileInput.files[0];
  
  if (!file.name.endsWith('.md')) {
    showWarning('只支持 .md 格式文件');
    return;
  }
  
  try {
    const formData = new FormData();
    formData.append('file', file);
    if (title) {
      formData.append('title', title);
    }
    formData.append('isPrivate', isPrivate);
    
    const response = await fetch(`${API_URL}/articles/upload`, {
      method: 'POST',
      credentials: 'include',
      body: formData
    });
    
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || '上传文件失败');
    }
    
    document.getElementById('fileArticleTitle').value = '';
    fileInput.value = '';
    document.getElementById('fileInfo').style.display = 'none';
    document.getElementById('filePrivateCheckbox').checked = false;
    showSuccess('文章已上传');
    loadArticles();
  } catch (error) {
    console.error('上传文件错误:', error);
    showError(error.message || '上传文件失败');
  }
}

// 设为公开
async function publishArticle(id) {
  if (!confirm('确定将该私有文章设为公开吗？')) {
    return;
  }
  try {
    const response = await fetch(`${API_URL}/articles/${id}/publish`, {
      method: 'PATCH',
      credentials: 'include'
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || '操作失败');
    }
    showSuccess('文章已设为公开');
    loadArticles();
  } catch (error) {
    console.error('设为公开错误:', error);
    showError(error.message || '设为公开失败');
  }
}

// 删除文章
async function deleteArticle(id) {
  if (!confirm('确定要删除这篇文章吗？')) {
    return;
  }
  
  try {
    const response = await fetch(`${API_URL}/articles/${id}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || '删除文章失败');
    }
    
    showSuccess('文章已删除');
    loadArticles();
  } catch (error) {
    console.error('删除文章错误:', error);
    showError(error.message || '删除文章失败');
  }
}

// 工具函数
function escapeHtml(text) {
  if (typeof text !== 'string') return '';
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
  
  setTimeout(() => {
    if (notification.parentElement) {
      notification.remove();
    }
  }, 3000);
}
