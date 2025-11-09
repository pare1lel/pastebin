const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');
const session = require('express-session');

const app = express();
const PORT = 3000;

// MongoDB 连接配置
const MONGODB_URI = 'mongodb://localhost:27017';
const DB_NAME = 'articleReaderDB';
const COLLECTION_NAME = 'articles';
const USERS_COLLECTION = 'users';

let db;
let articlesCollection;
let usersCollection;

// 配置文件上传
const upload = multer({ dest: 'uploads/' });

// 中间件
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));
app.use(bodyParser.json());
app.use(session({
  secret: 'your-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false, // 在生产环境中使用 HTTPS 时设为 true
    maxAge: 24 * 60 * 60 * 1000 // 24小时
  }
}));
app.use(express.static('public'));

// 处理 favicon 请求，避免 404 错误
app.get('/favicon.ico', (req, res) => {
  // 返回 204 No Content，或者你可以提供一个实际的 favicon 文件
  res.status(204).end();
});

// 连接 MongoDB
async function connectDB() {
  try {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    console.log('成功连接到 MongoDB');
    
    db = client.db(DB_NAME);
    articlesCollection = db.collection(COLLECTION_NAME);
    usersCollection = db.collection(USERS_COLLECTION);
    
    // 创建索引以提高查询性能
    await articlesCollection.createIndex({ createdAt: -1 });
    await usersCollection.createIndex({ username: 1 }, { unique: true });
    
    // 确保上传目录存在
    if (!fs.existsSync('uploads')) {
      fs.mkdirSync('uploads');
    }
    
    return client;
  } catch (error) {
    console.error('MongoDB 连接错误:', error);
    process.exit(1);
  }
}

// 认证中间件
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: '请先登录' });
  }
  next();
}

// API 路由

// 用户注册
app.post('/api/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || username.trim() === '') {
      return res.status(400).json({ error: '用户名不能为空' });
    }
    
    if (!password || password.length < 6) {
      return res.status(400).json({ error: '密码至少需要6个字符' });
    }
    
    // 检查用户名是否已存在
    const existingUser = await usersCollection.findOne({ username: username.trim() });
    if (existingUser) {
      return res.status(400).json({ error: '用户名已存在' });
    }
    
    // 加密密码
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // 创建新用户
    const newUser = {
      username: username.trim(),
      password: hashedPassword,
      createdAt: new Date().toISOString()
    };
    
    const result = await usersCollection.insertOne(newUser);
    
    // 自动登录
    req.session.userId = result.insertedId.toString();
    req.session.username = username.trim();
    
    res.status(201).json({ 
      message: '注册成功',
      username: username.trim()
    });
  } catch (error) {
    console.error('注册错误:', error);
    res.status(500).json({ error: '注册失败' });
  }
});

// 用户登录
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' });
    }
    
    // 查找用户
    const user = await usersCollection.findOne({ username: username.trim() });
    if (!user) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }
    
    // 验证密码
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }
    
    // 设置会话
    req.session.userId = user._id.toString();
    req.session.username = user.username;
    
    res.json({ 
      message: '登录成功',
      username: user.username
    });
  } catch (error) {
    console.error('登录错误:', error);
    res.status(500).json({ error: '登录失败' });
  }
});

// 用户登出
app.post('/api/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: '登出失败' });
    }
    res.json({ message: '登出成功' });
  });
});

// 获取当前用户信息
app.get('/api/current-user', (req, res) => {
  if (req.session.userId) {
    res.json({ 
      username: req.session.username,
      userId: req.session.userId
    });
  } else {
    res.status(401).json({ error: '未登录' });
  }
});

// 获取所有文章
app.get('/api/articles', async (req, res) => {
  try {
    // 按创建时间倒序排列
    const articles = await articlesCollection
      .find({})
      .sort({ createdAt: -1 })
      .toArray();
    
    // 将 _id 转换为 id 字符串以保持前端兼容性
    const formattedArticles = articles.map(article => ({
      id: article._id.toString(),
      title: article.title,
      content: article.content,
      wordCount: article.wordCount,
      createdAt: article.createdAt,
      author: article.author,
      authorId: article.authorId
    }));
    
    res.json(formattedArticles);
  } catch (error) {
    console.error('获取文章错误:', error);
    res.status(500).json({ error: '获取文章失败' });
  }
});

// 添加新文章（通过文本）
app.post('/api/articles', requireAuth, async (req, res) => {
  try {
    const { title, content } = req.body;
    
    if (!title || title.trim() === '') {
      return res.status(400).json({ error: '标题不能为空' });
    }
    
    if (!content || content.trim() === '') {
      return res.status(400).json({ error: '内容不能为空' });
    }
    
    const newArticle = {
      title: title.trim(),
      content: content.trim(),
      wordCount: content.trim().split(/\s+/).length,
      author: req.session.username,
      authorId: req.session.userId,
      createdAt: new Date().toISOString()
    };
    
    // 插入单个文档
    const result = await articlesCollection.insertOne(newArticle);
    
    // 返回插入的文章
    const insertedArticle = {
      id: result.insertedId.toString(),
      ...newArticle
    };
    
    res.status(201).json(insertedArticle);
  } catch (error) {
    console.error('添加文章错误:', error);
    res.status(500).json({ error: '添加文章失败' });
  }
});

// 通过文件上传添加文章
app.post('/api/articles/upload', requireAuth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请选择文件' });
    }

    const { title } = req.body;
    
    // 读取文件内容
    const content = fs.readFileSync(req.file.path, 'utf-8');
    
    // 删除临时文件
    fs.unlinkSync(req.file.path);
    
    if (!content || content.trim() === '') {
      return res.status(400).json({ error: '文件内容不能为空' });
    }
    
    const newArticle = {
      title: title || req.file.originalname.replace('.txt', ''),
      content: content.trim(),
      wordCount: content.trim().split(/\s+/).length,
      author: req.session.username,
      authorId: req.session.userId,
      createdAt: new Date().toISOString()
    };
    
    // 插入单个文档
    const result = await articlesCollection.insertOne(newArticle);
    
    // 返回插入的文章
    const insertedArticle = {
      id: result.insertedId.toString(),
      ...newArticle
    };
    
    res.status(201).json(insertedArticle);
  } catch (error) {
    console.error('文件上传错误:', error);
    res.status(500).json({ error: '文件上传失败' });
  }
});

// 获取单个文章（用于在新标签页显示）
app.get('/article/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 查询单个文档
    const article = await articlesCollection.findOne({ _id: new ObjectId(id) });
    
    if (!article) {
      return res.status(404).send('<h1>文章未找到</h1>');
    }
  
  // 生成 HTML 页面
  const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${article.title}</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/semantic-ui@2.4.2/dist/semantic.min.css">
    <style>
        body {
            background-color: #f5f5f5;
            padding: 40px 20px;
        }
        .container {
            max-width: 900px;
            margin: 0 auto;
        }
        .article-header {
            background: white;
            padding: 30px;
            border-radius: 5px;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .article-title {
            font-size: 2.5em;
            margin-bottom: 20px;
            color: #2185d0;
        }
        .article-meta {
            color: #666;
            font-size: 1em;
            padding: 15px 0;
            border-top: 1px solid #eee;
            border-bottom: 1px solid #eee;
        }
        .article-content {
            background: white;
            padding: 40px;
            border-radius: 5px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            white-space: pre-wrap;
            word-break: break-word;
            line-height: 1.8;
            font-size: 1.1em;
            color: #333;
        }
        .back-button {
            margin-bottom: 20px;
        }
        .delete-button {
            margin-top: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="back-button">
            <a href="/" class="ui button">
                <i class="arrow left icon"></i>
                返回首页
            </a>
            ${req.session.userId && req.session.userId === article.authorId ? `
            <button class="ui red button" onclick="deleteArticle()">
                <i class="trash icon"></i>
                删除文章
            </button>
            ` : ''}
        </div>
        
        <div class="article-header">
            <h1 class="article-title">${article.title}</h1>
            <div class="article-meta">
                ${article.author ? `<i class="user icon"></i>作者: ${article.author}` : ''}
                <span style="margin-left: 20px;">
                    <i class="calendar icon"></i>
                    添加于: ${new Date(article.createdAt).toLocaleString('zh-CN')}
                </span>
                <span style="margin-left: 30px;">
                    <i class="font icon"></i>
                    词数: ${article.wordCount}
                </span>
            </div>
        </div>
        
        <div class="article-content">${article.content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
    </div>

    <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/semantic-ui@2.4.2/dist/semantic.min.js"></script>
    <script>
        async function deleteArticle() {
            if (!confirm('确定要删除这篇文章吗？删除后将返回首页。')) {
                return;
            }
            
            try {
                const response = await fetch('http://localhost:3000/api/articles/${id}', {
                    method: 'DELETE'
                });
                
                if (response.ok) {
                    alert('文章已删除');
                    window.location.href = '/';
                } else {
                    alert('删除失败');
                }
            } catch (error) {
                console.error('删除错误:', error);
                alert('删除失败');
            }
        }
    </script>
</body>
</html>
  `;
  
  res.send(html);
  } catch (error) {
    console.error('获取文章详情错误:', error);
    res.status(500).send('<h1>服务器错误</h1>');
  }
});

// 删除文章
app.delete('/api/articles/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    // 先查找文章，检查权限
    const article = await articlesCollection.findOne({ _id: new ObjectId(id) });
    
    if (!article) {
      return res.status(404).json({ error: '文章不存在' });
    }
    
    // 检查是否是文章作者
    if (article.authorId !== req.session.userId) {
      return res.status(403).json({ error: '无权删除此文章' });
    }
    
    // 删除文档
    const result = await articlesCollection.deleteOne({ _id: new ObjectId(id) });
    
    res.json({ message: '文章已删除', id });
  } catch (error) {
    console.error('删除文章错误:', error);
    res.status(500).json({ error: '删除文章失败' });
  }
});

// 初始化并启动服务器
async function startServer() {
  await connectDB();
  
  app.listen(PORT, () => {
    console.log(`服务器已启动，访问 http://localhost:${PORT}`);
  });
}

startServer().catch(console.error);
