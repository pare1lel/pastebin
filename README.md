# 英语翻译练习工具

一个使用 Semantic UI 和 Node.js/Express 构建的英语翻译练习应用。支持上传英语文章，自动将文章分割为句子，支持句子级别的翻译练习。

## 功能特性

- 📤 **文章上传** - 上传英语 .txt 文件进行翻译练习
- 🔤 **智能分句** - 使用 compromise 库自动将英文文章分割为句子
- � **课文管理** - 实时添加和删除英语课文
- ✍️ **句子练习** - 点击句子进行翻译练习
- 💾 **数据持久化** - 所有数据自动保存到 JSON 文件
- 🎨 **现代 UI** - 使用 Semantic UI 组件库和渐变背景
- ⏰ **时间戳** - 记录每篇文章的创建时间
- � **实时预览** - 预览文章中的每个句子

## 安装和运行

### 前置需求
- Node.js (v12 或更高版本)
- npm

### 安装依赖
```bash
npm install
```

### 启动服务器
```bash
npm start
```

服务器将在 `http://localhost:3000` 上运行

### 访问应用
在浏览器中打开：`http://localhost:3000`

## 项目结构

```
trans1at0r/
├── server.js           # Express 服务器和 API
├── package.json        # 项目依赖
├── articles.json       # 文章数据存储
├── sentences.json      # 备用句子存储（可选）
├── public/
│   ├── index.html      # 前端 HTML
│   └── app.js          # 前端 JavaScript
└── README.md           # 本文件
```

## API 端点

### 获取所有文章
```
GET /api/articles
```
返回所有已上传的文章列表

### 获取单篇文章详情
```
GET /api/articles/:id
```
返回指定文章的详细信息，包括所有句子

### 上传文章
```
POST /api/articles
Content-Type: multipart/form-data

Parameters:
- title: 文章标题 (string)
- file: 英语文章文件 (File, .txt 格式)
```
上传新文章，自动分割为句子

### 删除文章
```
DELETE /api/articles/:id
```
删除指定文章

## 数据格式

### 文章对象结构
```json
{
  "id": "1234567890",
  "title": "文章标题",
  "content": "完整的文章内容...",
  "sentences": [
    {
      "id": "1234567890_0",
      "text": "First sentence.",
      "order": 0
    }
  ],
  "sentenceCount": 10,
  "createdAt": "2025-11-09T12:34:56.000Z",
  "updatedAt": "2025-11-09T12:34:56.000Z"
}
```

### 句子对象结构
```json
{
  "id": "1234567890_0",
  "text": "The sentence text here.",
  "order": 0
}
```

## 技术栈

### 后端
- **Node.js** - 运行时环境
- **Express.js** - Web 服务器框架
- **Multer** - 文件上传处理
- **Compromise** - 自然语言处理（NLP）库，用于英文句子分割
- **Body Parser** - 请求体解析
- **CORS** - 跨域资源共享

### 前端
- **HTML5** - 页面结构
- **CSS3** - 样式和响应式设计
- **JavaScript (ES6+)** - 应用逻辑
- **Fetch API** - HTTP 请求
- **Semantic UI 2.4.2** - UI 组件库

### 数据存储
- **JSON 文件** - 简单的本地数据存储

## 使用说明

### 1. 上传文章
1. 点击顶部导航栏的"上传文章"标签
2. 输入文章标题
3. 通过拖拽或点击选择英语 .txt 文件
4. 点击"上传文章"按钮
5. 系统会自动分割文章为句子，并显示识别的句子数量

### 2. 进行翻译练习
1. 点击顶部导航栏的"练习翻译"标签
2. 从左侧文章列表中选择一篇文章
3. 在右侧显示的句子列表中点击某个句子
4. 在文本框中输入该句子的中文翻译
5. 点击"保存翻译"按钮保存翻译结果

### 3. 管理文章
- 在"上传文章"页面的已上传文章列表中可以删除不需要的文章
- 删除操作会立即从系统中移除该文章

## 依赖包说明

- **express**: Web 应用框架，用于构建 REST API
- **body-parser**: 中间件，用于解析 JSON 和 URL 编码的请求体
- **cors**: 中间件，用于处理跨域请求
- **multer**: 中间件，用于处理文件上传
- **compromise**: NLP 库，用于英文文本的自然语言处理和句子分割

## 句子分割算法

项目使用 **compromise** 库进行英文句子分割，这是一个轻量级的自然语言处理库，特别适合处理英文文本。

### 工作原理：
1. 将上传的文本传递给 compromise 库
2. compromise 使用内置的 NLP 算法识别句子边界
3. 返回分割后的句子数组
4. 每个句子被赋予唯一的 ID 和顺序号

### 备选方案：
如果 compromise 处理失败，系统会自动使用正则表达式作为备选方案进行分割：
```javascript
const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
```

## 翻译练习工作流

```
上传文章 → 自动分句 → 选择文章 → 选择句子 → 输入翻译 → 保存翻译
   ↓
识别句子数  
   ↓
显示在列表中
```

## 扩展功能建议

- 添加翻译结果保存和历史记录
- 集成翻译 API 提供参考翻译
- 添加词汇难度分析
- 支持更多文件格式（PDF、Word 等）
- 实现用户系统和进度跟踪
- 添加语音朗读功能
- 支持多语言翻译

## 许可证

ISC

## 贡献

欢迎提交问题和改进建议！

