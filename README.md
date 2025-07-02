# OneNote RAG Agent

基于Mastra RAG和ChromaDB的智能OneNote助手，支持多种文档格式的智能问答系统。

## 🌟 主要功能

- **智能问答**: 基于您的笔记内容进行智能问答
- **多格式支持**: 支持Word(.docx)、PDF、文本(.txt)、Markdown(.md)、HTML等格式
- **向量检索**: 使用ChromaDB进行高效的语义搜索
- **实时索引**: 自动索引新上传的文档
- **文件上传**: 支持拖拽上传和手动选择文件
- **系统监控**: 实时显示系统状态和健康检查

## 🛠️ 技术栈

- **前端**: Next.js 14 + React + TypeScript + Tailwind CSS
- **后端**: Next.js API Routes
- **向量数据库**: ChromaDB
- **AI模型**: OpenAI GPT-3.5/4 + text-embedding-ada-002
- **文档处理**: Mammoth (Word), PDF-Parse (PDF)
- **容器化**: Docker Compose

## 🚀 快速开始

### 1. 克隆项目

```bash
git clone <repository-url>
cd slefAgent
```

### 2. 自动设置

```bash
npm run setup
```

这将自动创建必要的目录和配置文件。

### 3. 配置环境变量

编辑 `.env.local` 文件，设置必要的环境变量：

```env
# OpenAI API配置
OPENAI_API_KEY=your_openai_api_key_here

# ChromaDB配置
CHROMA_HOST=localhost
CHROMA_PORT=8000
CHROMA_COLLECTION_NAME=onenote_documents

# 本地文件配置
ONENOTE_FILES_PATH=./data/onenote
SUPPORTED_EXTENSIONS=.docx,.pdf,.txt,.html,.md
```

### 4. 启动ChromaDB服务

```bash
docker-compose up -d
```

### 5. 安装依赖

```bash
npm install
```

### 6. 启动开发服务器

```bash
npm run dev
```

### 7. 访问应用

打开浏览器访问 [http://localhost:3000](http://localhost:3000)

## 📁 项目结构

```
slefAgent/
├── app/                    # Next.js App Router
│   ├── api/               # API路由
│   │   ├── chat/          # 聊天API
│   │   ├── upload/        # 文件上传API
│   │   ├── reindex/       # 重新索引API
│   │   └── test/          # 测试API
│   ├── globals.css        # 全局样式
│   ├── layout.tsx         # 根布局
│   └── page.tsx           # 首页
├── components/            # React组件
│   └── ChatInterface.tsx  # 聊天界面组件
├── lib/                   # 核心库
│   ├── chroma-service.ts  # ChromaDB服务
│   ├── mastra-rag.ts      # Mastra RAG系统
│   ├── local-onenote.ts   # 本地文件处理
│   └── utils.ts           # 工具函数
├── data/                  # 数据目录
│   └── onenote/          # OneNote文件存储
├── config/               # 配置文件
├── scripts/              # 脚本文件
└── docker-compose.yml    # Docker配置
```

## 🔧 API接口

### 聊天API
- `POST /api/chat` - 发送消息并获取AI回答
- `GET /api/chat` - 获取系统状态

### 文件管理API
- `POST /api/upload` - 上传文件并自动索引
- `GET /api/upload` - 获取上传状态

### 索引管理API
- `POST /api/reindex` - 重新索引所有文件
- `GET /api/reindex` - 获取索引状态
- `DELETE /api/reindex` - 清空索引

### 测试API
- `GET /api/test` - 系统健康检查
- `POST /api/test` - 执行测试查询

## 📋 使用指南

### 1. 添加文档

有两种方式添加文档：

**方式一：直接上传**
- 在聊天界面点击上传按钮
- 选择支持的文件格式
- 系统会自动处理和索引

**方式二：文件夹放置**
- 将文件放入 `./data/onenote/` 目录
- 点击"重新索引"按钮

### 2. 智能问答

- 在聊天框中输入问题
- 系统会基于您的文档内容回答
- 查看来源引用和置信度

### 3. 系统监控

- 查看ChromaDB连接状态
- 监控OpenAI API状态
- 查看已索引的文档数量

## 🔍 支持的文件格式

| 格式 | 扩展名 | 状态 |
|------|--------|------|
| Word文档 | .docx | ✅ 完全支持 |
| PDF文档 | .pdf | ⚠️ 基础支持 |
| 纯文本 | .txt | ✅ 完全支持 |
| Markdown | .md | ✅ 完全支持 |
| HTML | .html | ✅ 完全支持 |

## 🐳 Docker部署

### 开发环境

```bash
docker-compose up -d
```

### 生产环境

```bash
docker-compose -f docker-compose.prod.yml up -d
```

## 🛠️ 开发

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

### 构建

```bash
npm run build
```

### 类型检查

```bash
npm run lint
```

## 📝 环境变量说明

| 变量名 | 描述 | 默认值 |
|--------|------|--------|
| `OPENAI_API_KEY` | OpenAI API密钥 | 必填 |
| `CHROMA_HOST` | ChromaDB主机地址 | localhost |
| `CHROMA_PORT` | ChromaDB端口 | 8000 |
| `CHROMA_COLLECTION_NAME` | ChromaDB集合名称 | onenote_documents |
| `ONENOTE_FILES_PATH` | 本地文件路径 | ./data/onenote |
| `SUPPORTED_EXTENSIONS` | 支持的文件扩展名 | .docx,.pdf,.txt,.html,.md |

## 🤝 贡献

欢迎提交Issue和Pull Request！

## 📄 许可证

MIT License

## 🆘 故障排除

### ChromaDB连接失败

1. 确保Docker容器正在运行：
   ```bash
   docker-compose ps
   ```

2. 检查端口是否被占用：
   ```bash
   netstat -an | grep 8000
   ```

### OpenAI API错误

1. 检查API密钥是否正确设置
2. 确认账户有足够的余额
3. 检查网络连接

### 文件上传失败

1. 检查文件格式是否支持
2. 确认文件大小不超过10MB
3. 检查目录权限

## 📞 支持

如有问题，请创建Issue或联系开发团队。 