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

// 获取单个文章（用于在新标签页显示）
app.get('/article/:id', (req, res) => {
  const { id } = req.params;
  const articles = readArticles();
  const article = articles.find(a => a.id === parseInt(id));
  
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
            <button class="ui red button" onclick="deleteArticle()">
                <i class="trash icon"></i>
                删除文章
            </button>
        </div>
        
        <div class="article-header">
            <h1 class="article-title">${article.title}</h1>
            <div class="article-meta">
                <i class="calendar icon"></i>
                添加于: ${new Date(article.createdAt).toLocaleString('zh-CN')}
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
