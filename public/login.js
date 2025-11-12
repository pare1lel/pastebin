// API 基础 URL - 使用相对路径，自动适配当前域名
const API_URL = '/api';

// 显示登录表单
function showLoginForm() {
  document.getElementById('loginForm').classList.remove('hidden');
  document.getElementById('registerForm').classList.add('hidden');
}

// 显示注册表单
function showRegisterForm() {
  document.getElementById('loginForm').classList.add('hidden');
  document.getElementById('registerForm').classList.remove('hidden');
}

// 用户登录
async function login() {
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;
  
  if (!username || !password) {
    showWarning('用户名和密码不能为空');
    return;
  }
  
  try {
    const response = await fetch(`${API_URL}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({ username, password })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      showSuccess('登录成功，正在返回...');
      setTimeout(() => {
        // 如果有来源页面，跳转到来源页面，否则跳转到主页
        const referrer = document.referrer;
        if (referrer && !referrer.includes('/login')) {
          window.location.href = referrer;
        } else {
          window.location.href = '/';
        }
      }, 500);
    } else {
      showError(data.error || '登录失败');
    }
  } catch (error) {
    console.error('登录错误:', error);
    showError('登录失败');
  }
}

// 用户注册
async function register() {
  const username = document.getElementById('registerUsername').value.trim();
  const password = document.getElementById('registerPassword').value;
  const confirmPassword = document.getElementById('registerPasswordConfirm').value;
  
  if (!username || !password) {
    showWarning('用户名和密码不能为空');
    return;
  }
  
  if (password.length < 6) {
    showWarning('密码至少需要6个字符');
    return;
  }
  
  if (password !== confirmPassword) {
    showWarning('两次输入的密码不一致');
    return;
  }
  
  try {
    const response = await fetch(`${API_URL}/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({ username, password })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      showSuccess('注册成功，正在返回...');
      setTimeout(() => {
        // 如果有来源页面，跳转到来源页面，否则跳转到主页
        const referrer = document.referrer;
        if (referrer && !referrer.includes('/login')) {
          window.location.href = referrer;
        } else {
          window.location.href = '/';
        }
      }, 500);
    } else {
      showError(data.error || '注册失败');
    }
  } catch (error) {
    console.error('注册错误:', error);
    showError('注册失败');
  }
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
