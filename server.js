const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { MongoClient, ObjectId } = require('mongodb');
const { marked } = require('marked');
const sanitizeHtml = require('sanitize-html');
const bcrypt = require('bcrypt');
const session = require('express-session');

const app = express();
const PORT = 3000;

// MongoDB 连接配置
const MONGODB_URI = 'mongodb://localhost:27017';
const DB_NAME = 'articleReaderDB';
const COLLECTION_NAME = 'articles';
const USERS_COLLECTION = 'users';
const ANNOTATIONS_COLLECTION = 'annotations';

let db;
let articlesCollection;
let usersCollection;
let annotationsCollection;

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
    annotationsCollection = db.collection(ANNOTATIONS_COLLECTION);
    
    // 创建索引以提高查询性能
    await articlesCollection.createIndex({ createdAt: -1 });
    await usersCollection.createIndex({ username: 1 }, { unique: true });
    await annotationsCollection.createIndex({ articleId: 1, userId: 1 });
    
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

// 管理权限中间件
function requireAdmin(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: '请先登录' });
  }
  if (!req.session.isAdmin) {
    return res.status(403).json({ error: '需要管理权限' });
  }
  next();
}

// 如果已登录，重定向到主页
function redirectIfLoggedIn(req, res, next) {
    if (req.session.userId) {
        return res.redirect('/');
    }
    next();
}

// 登录页面路由
app.get('/login', redirectIfLoggedIn, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

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
    const isRootUser = username.trim() === 'root';
    const newUser = {
      username: username.trim(),
      password: hashedPassword,
      isAdmin: isRootUser, // root 用户默认是管理
      createdAt: new Date().toISOString()
    };
    
    const result = await usersCollection.insertOne(newUser);
    
    // 自动登录
    req.session.userId = result.insertedId.toString();
    req.session.username = username.trim();
    req.session.isAdmin = isRootUser;
    
    res.status(201).json({ 
      message: '注册成功',
      username: username.trim(),
      userId: req.session.userId
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
    
    // 如果是 root 用户但数据库中没有 isAdmin 字段，自动设置为管理
    if (user.username === 'root' && !user.isAdmin) {
      await usersCollection.updateOne(
        { _id: user._id },
        { $set: { isAdmin: true } }
      );
      user.isAdmin = true;
    }
    
    // 设置会话
    req.session.userId = user._id.toString();
    req.session.username = user.username;
    req.session.isAdmin = user.isAdmin || false;
    
    res.json({ 
      message: '登录成功',
      username: user.username,
      userId: req.session.userId,
      isAdmin: req.session.isAdmin
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
      userId: req.session.userId,
      isAdmin: req.session.isAdmin || false
    });
  } else {
    res.status(401).json({ error: '未登录' });
  }
});

// 获取所有用户（仅管理）
app.get('/api/users', requireAdmin, async (req, res) => {
  try {
    const users = await usersCollection
      .find({}, { projection: { password: 0 } }) // 不返回密码
      .sort({ createdAt: 1 })
      .toArray();
    
    const formattedUsers = users.map(user => ({
      id: user._id.toString(),
      username: user.username,
      isAdmin: user.isAdmin || false,
      createdAt: user.createdAt
    }));
    
    res.json(formattedUsers);
  } catch (error) {
    console.error('获取用户列表错误:', error);
    res.status(500).json({ error: '获取用户列表失败' });
  }
});

// 修改用户管理权限（仅 root 用户）
app.patch('/api/users/:id/admin', requireAuth, async (req, res) => {
  try {
    // 只有 root 用户可以修改权限
    if (req.session.username !== 'root') {
      return res.status(403).json({ error: '只有 root 用户可以修改管理权限' });
    }
    
    const { id } = req.params;
    const { isAdmin } = req.body;
    
    // 不能修改自己的权限
    if (id === req.session.userId) {
      return res.status(400).json({ error: '不能修改自己的权限' });
    }
    
    const user = await usersCollection.findOne({ _id: new ObjectId(id) });
    
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    // root 用户的权限不能被修改
    if (user.username === 'root') {
      return res.status(400).json({ error: 'root 用户的权限不能被修改' });
    }
    
    await usersCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { isAdmin: !!isAdmin } }
    );
    
    res.json({ message: '权限已更新', userId: id, isAdmin: !!isAdmin });
  } catch (error) {
    console.error('修改用户权限错误:', error);
    res.status(500).json({ error: '修改权限失败' });
  }
});

// 获取所有文章
app.get('/api/articles', async (req, res) => {
  try {
    // 仅返回公开文章，或当前用户自己的私有文章；没有 isPrivate 字段的旧文章视为公开
    const userId = req.session.userId;
    const visibilityFilter = userId
      ? { $or: [ { isPrivate: { $ne: true } }, { authorId: userId } ] }
      : { isPrivate: { $ne: true } };

    // 按创建时间倒序排列
    const articles = await articlesCollection
      .find(visibilityFilter)
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
      authorId: article.authorId,
      isPrivate: !!article.isPrivate
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
    let isPrivate = req.body.isPrivate === true || req.body.isPrivate === 'true';
    
    // 普通用户（非管理）只能创建私有文章
    if (!req.session.isAdmin) {
      isPrivate = true;
    }
    
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
      createdAt: new Date().toISOString(),
      isPrivate: !!isPrivate
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
    let isPrivate = req.body.isPrivate === true || req.body.isPrivate === 'true';
    
    // 普通用户（非管理）只能创建私有文章
    if (!req.session.isAdmin) {
      isPrivate = true;
    }
    
    // 读取文件内容
    const content = fs.readFileSync(req.file.path, 'utf-8');
    
    // 删除临时文件
    fs.unlinkSync(req.file.path);
    
    if (!content || content.trim() === '') {
      return res.status(400).json({ error: '文件内容不能为空' });
    }
    
    const newArticle = {
      title: title || req.file.originalname.replace('.md', ''),
      content: content.trim(),
      wordCount: content.trim().split(/\s+/).length,
      author: req.session.username,
      authorId: req.session.userId,
      createdAt: new Date().toISOString(),
      isPrivate: !!isPrivate
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

    // 访问权限校验：私有文章仅作者可见
    const isAuthor = req.session.userId && req.session.userId === article.authorId;
    const isPublic = !article.isPrivate;
    if (!isPublic && !isAuthor) {
      return res.status(403).send('<h1>无权访问该私有文章</h1>');
    }
  
  // 渲染 Markdown 为 HTML 并清理（防 XSS）
  const rawHtml = marked.parse(article.content || '');
  const safeHtml = sanitizeHtml(rawHtml, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([ 'img' ]),
    allowedAttributes: {
      a: [ 'href', 'name', 'target', 'rel', 'title' ],
      img: [ 'src', 'alt', 'title', 'width', 'height' ],
      '*': [ 'class', 'id', 'style' ]
    },
    transformTags: {
      'a': function(_tagName, attribs) {
        // 强制外链在新标签页打开并且安全
        attribs.target = '_blank';
        attribs.rel = (attribs.rel ? attribs.rel + ' ' : '') + 'noopener noreferrer';
        return { tagName: 'a', attribs };
      }
    }
  });

  // 读取并渲染 HTML 模板
  const templatePath = path.join(__dirname, 'article-template.html');
  let html = fs.readFileSync(templatePath, 'utf-8');

  // 检查当前用户是否是管理
  const currentUser = req.session.userId ? await usersCollection.findOne({ _id: new ObjectId(req.session.userId) }) : null;
  const isAdmin = currentUser && currentUser.isAdmin;

  // 准备动态内容
  let authorButtons = '';
  if (isAuthor) {
    authorButtons = `
            <button class="ui red button" onclick="deleteArticle()">
                <i class="trash icon"></i>
                删除文章
            </button>`;
    
    // 只有管理才能看到"设为公开"按钮
    if (isAdmin && article.isPrivate) {
      authorButtons += `
      <button class="ui orange button" onclick="publishArticle()">
        <i class="unlock icon"></i>
        设为公开
      </button>`;
    }
  }

  const authorInfo = article.author ? `<i class="user icon"></i>作者: ${article.author}` : '';
  
  // 只有管理才能看到权限标签
  const privacyLabel = isAdmin && article.isPrivate ? '<span style="margin-left: 20px;"><i class="lock icon"></i>私有</span>' : '';

  // 替换模板占位符
  html = html
    .replace(/{{TITLE}}/g, article.title)
    .replace(/{{AUTHOR_BUTTONS}}/g, authorButtons)
    .replace(/{{AUTHOR_INFO}}/g, authorInfo)
    .replace(/{{CREATED_AT}}/g, new Date(article.createdAt).toLocaleString('zh-CN'))
    .replace(/{{WORD_COUNT}}/g, article.wordCount)
    .replace(/{{PRIVACY_LABEL}}/g, privacyLabel)
    .replace(/{{CONTENT}}/g, safeHtml)
    .replace(/{{ARTICLE_ID}}/g, id);
  
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
    
    // 删除文章
    const result = await articlesCollection.deleteOne({ _id: new ObjectId(id) });
    
    // 删除该文章的所有笔记
    await annotationsCollection.deleteMany({ articleId: id });
    
    res.json({ message: '文章已删除', id });
  } catch (error) {
    console.error('删除文章错误:', error);
    res.status(500).json({ error: '删除文章失败' });
  }
});

// 将私有文章设为公开
app.patch('/api/articles/:id/publish', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const article = await articlesCollection.findOne({ _id: new ObjectId(id) });
    if (!article) {
      return res.status(404).json({ error: '文章不存在' });
    }
    if (article.authorId !== req.session.userId) {
      return res.status(403).json({ error: '无权修改此文章' });
    }
    if (!article.isPrivate) {
      return res.status(400).json({ error: '文章已是公开状态' });
    }
    await articlesCollection.updateOne({ _id: new ObjectId(id) }, { $set: { isPrivate: false } });
    res.json({ message: '已设为公开', id });
  } catch (error) {
    console.error('设为公开错误:', error);
    res.status(500).json({ error: '操作失败' });
  }
});

// ============ 笔记相关 API ============

// 获取文章的所有笔记（所有用户可见，包括未登录用户）
app.get('/api/articles/:articleId/annotations', async (req, res) => {
  try {
    const { articleId } = req.params;
    const currentUserId = req.session.userId; // 可能为 undefined（未登录）
    
    // 获取该文章的所有笔记，按编号排序
    const annotations = await annotationsCollection
      .find({ articleId })
      .sort({ annotationNumber: 1 })
      .toArray();
    
    const formattedAnnotations = annotations.map(ann => ({
      id: ann._id.toString(),
      articleId: ann.articleId,
      userId: ann.userId,
      username: ann.username,
      annotationNumber: ann.annotationNumber,
      selectedText: ann.selectedText,
      startOffset: ann.startOffset,
      endOffset: ann.endOffset,
      notes: ann.notes,
      createdAt: ann.createdAt,
      updatedAt: ann.updatedAt,
      isOwner: currentUserId && currentUserId === ann.userId // 是否是当前用户创建的
    }));
    
    res.json(formattedAnnotations);
  } catch (error) {
    console.error('获取笔记错误:', error);
    res.status(500).json({ error: '获取笔记失败' });
  }
});

// 创建新笔记
app.post('/api/articles/:articleId/annotations', requireAuth, async (req, res) => {
  try {
    const { articleId } = req.params;
    const userId = req.session.userId;
    const username = req.session.username;
    const { selectedText, startOffset, endOffset, notes } = req.body;
    
    if (!selectedText || !notes || notes.length === 0) {
      return res.status(400).json({ error: '选中的文字和笔记内容不能为空' });
    }
    
    // 获取该文章所有笔记的最大编号（所有用户共享编号）
    const lastAnnotation = await annotationsCollection
      .findOne({ articleId }, { sort: { annotationNumber: -1 } });
    
    const annotationNumber = lastAnnotation ? lastAnnotation.annotationNumber + 1 : 1;
    
    const newAnnotation = {
      articleId,
      userId,
      username,
      annotationNumber,
      selectedText,
      startOffset,
      endOffset,
      notes, // [{title, content}, ...]
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    const result = await annotationsCollection.insertOne(newAnnotation);
    
    res.status(201).json({
      id: result.insertedId.toString(),
      ...newAnnotation
    });
  } catch (error) {
    console.error('创建笔记错误:', error);
    res.status(500).json({ error: '创建笔记失败' });
  }
});

// 更新笔记
app.put('/api/annotations/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.session.userId;
    const { notes } = req.body;
    
    if (!notes || notes.length === 0) {
      return res.status(400).json({ error: '笔记内容不能为空' });
    }
    
    const annotation = await annotationsCollection.findOne({ _id: new ObjectId(id) });
    
    if (!annotation) {
      return res.status(404).json({ error: '笔记不存在' });
    }
    
    if (annotation.userId !== userId) {
      return res.status(403).json({ error: '无权修改此笔记' });
    }
    
    await annotationsCollection.updateOne(
      { _id: new ObjectId(id) },
      { 
        $set: { 
          notes,
          updatedAt: new Date().toISOString()
        } 
      }
    );
    
    res.json({ message: '笔记已更新', id });
  } catch (error) {
    console.error('更新笔记错误:', error);
    res.status(500).json({ error: '更新笔记失败' });
  }
});

// 删除笔记
app.delete('/api/annotations/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.session.userId;
    
    const annotation = await annotationsCollection.findOne({ _id: new ObjectId(id) });
    
    if (!annotation) {
      return res.status(404).json({ error: '笔记不存在' });
    }
    
    if (annotation.userId !== userId) {
      return res.status(403).json({ error: '无权删除此笔记' });
    }
    
    const deletedNumber = annotation.annotationNumber;
    
    await annotationsCollection.deleteOne({ _id: new ObjectId(id) });
    
    // 重新编号该文章的所有笔记（所有用户的笔记都重新编号）
    const remainingAnnotations = await annotationsCollection
      .find({ articleId: annotation.articleId })
      .sort({ annotationNumber: 1 })
      .toArray();
    
    // 只需要更新编号大于被删除笔记的那些笔记
    for (const ann of remainingAnnotations) {
      if (ann.annotationNumber > deletedNumber) {
        await annotationsCollection.updateOne(
          { _id: ann._id },
          { $set: { annotationNumber: ann.annotationNumber - 1 } }
        );
      }
    }
    
    res.json({ message: '笔记已删除', id });
  } catch (error) {
    console.error('删除笔记错误:', error);
    res.status(500).json({ error: '删除笔记失败' });
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
