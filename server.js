const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const app = express();
const PORT = 3000;

// 数据文件路径
const dataFile = path.join(__dirname, 'articles.json');

// 配置文件上传
const upload = multer({ dest: 'uploads/' });

// 中间件
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// 初始化数据文件和上传目录
function initDataFile() {
  if (!fs.existsSync(dataFile)) {
    fs.writeFileSync(dataFile, JSON.stringify([], null, 2));
  }
  if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
  }
}

// 读取所有文章
function readArticles() {
  try {
    const data = fs.readFileSync(dataFile, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('读取数据文件错误:', error);
    return [];
  }
}

// 保存文章到文件
function saveArticles(articles) {
  try {
    fs.writeFileSync(dataFile, JSON.stringify(articles, null, 2));
  } catch (error) {
    console.error('保存数据文件错误:', error);
  }
}

// API 路由

// 获取所有文章
app.get('/api/articles', (req, res) => {
  const articles = readArticles();
  res.json(articles);
});

// 添加新文章（通过文本）
app.post('/api/articles', (req, res) => {
  const { title, content } = req.body;
  
  if (!title || title.trim() === '') {
    return res.status(400).json({ error: '标题不能为空' });
  }
  
  if (!content || content.trim() === '') {
    return res.status(400).json({ error: '内容不能为空' });
  }
  
  const articles = readArticles();
  const newArticle = {
    id: Date.now(),
    title: title.trim(),
    content: content.trim(),
    wordCount: content.trim().split(/\s+/).length,
    createdAt: new Date().toISOString()
  };
  
  articles.push(newArticle);
  saveArticles(articles);
  
  res.status(201).json(newArticle);
});

// 通过文件上传添加文章
app.post('/api/articles/upload', upload.single('file'), (req, res) => {
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
    
    const articles = readArticles();
    const newArticle = {
      id: Date.now(),
      title: title || req.file.originalname.replace('.txt', ''),
      content: content.trim(),
      wordCount: content.trim().split(/\s+/).length,
      createdAt: new Date().toISOString()
    };
    
    articles.push(newArticle);
    saveArticles(articles);
    
    res.status(201).json(newArticle);
  } catch (error) {
    console.error('文件上传错误:', error);
    res.status(500).json({ error: '文件上传失败' });
  }
});

// 删除文章
app.delete('/api/articles/:id', (req, res) => {
  const { id } = req.params;
  
  const articles = readArticles();
  const index = articles.findIndex(a => a.id === parseInt(id));
  
  if (index === -1) {
    return res.status(404).json({ error: '文章不存在' });
  }
  
  const deletedArticle = articles.splice(index, 1)[0];
  saveArticles(articles);
  
  res.json(deletedArticle);
});

// 初始化
initDataFile();

app.listen(PORT, () => {
  console.log(`服务器已启动，访问 http://localhost:${PORT}`);
});
