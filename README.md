# OneNote RAG Agent

基于本地ChromaDB和OpenAI的智能文档问答系统，支持多种文档格式的语义搜索和智能问答。

## 🌟 主要功能

- **智能问答**: 基于您的本地文档进行智能问答
- **多格式支持**: 支持Word(.docx)、PDF、文本(.txt)、Markdown(.md)、HTML等格式
- **本地部署**: 完全本地化部署，保护数据隐私
- **向量检索**: 使用ChromaDB进行高效的语义搜索
- **实时索引**: 自动索引新上传的文档
- **文件上传**: 支持拖拽上传和手动选择文件

## 🛠️ 技术栈

- **前端**: Next.js 14 + React + TypeScript + Tailwind CSS
- **后端**: Next.js API Routes
- **向量数据库**: ChromaDB (本地安装)
- **AI模型**: OpenAI GPT + 本地嵌入函数
- **文档处理**: Mammoth (Word), PDF-Parse (PDF)

## 🚀 快速开始

### 系统要求
- Node.js 18+
- Python 3.8+
- 4GB+ 内存

### 方法一：一键启动（推荐）

```bash
# 1. 克隆项目
git clone <repository-url>
cd selfLocalAgent

# 2. 配置OpenAI API密钥
cp config/env.example .env.local
# 编辑 .env.local 文件，设置 OPENAI_API_KEY

# 3. 一键启动（会自动安装依赖和启动服务）
yarn start-all
```

### 方法二：手动启动

#### 1. 克隆项目
```bash
git clone <repository-url>
cd selfLocalAgent
```

#### 2. 安装Node.js依赖
```bash
yarn install
```

#### 3. 安装ChromaDB
```bash
# 创建Python虚拟环境
python3 -m venv venv

# 激活虚拟环境
source venv/bin/activate  # Linux/Mac
# 或 venv\Scripts\activate  # Windows

# 安装ChromaDB
pip install chromadb
```

#### 4. 配置环境变量
创建 `.env.local` 文件：
```env
# OpenAI API配置
OPENAI_API_KEY=your_openai_api_key_here

# ChromaDB配置
CHROMA_HOST=localhost
CHROMA_PORT=8000
CHROMA_COLLECTION_NAME=onenote_documents

# 本地文件配置
ONENOTE_FILES_PATH=./data/onenote
```

#### 5. 启动ChromaDB服务器
```bash
# 激活虚拟环境
source venv/bin/activate

# 启动ChromaDB服务器
chroma run --host 0.0.0.0 --port 8000
```

#### 6. 启动应用（新终端窗口）
```bash
# 设置代理（如果需要）
export HTTP_PROXY=http://127.0.0.1:7890
export HTTPS_PROXY=http://127.0.0.1:7890

# 启动开发服务器
yarn dev
```

### 访问应用
打开浏览器访问 [http://localhost:3003](http://localhost:3003)

### 停止服务
```bash
yarn stop-all
```

## 📁 项目结构

```
selfLocalAgent/
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
│   ├── chroma-client.ts   # ChromaDB服务
│   ├── mastra-rag.ts      # RAG系统
│   ├── local-onenote.ts   # 本地文件处理
│   ├── local-chroma-embedding.ts  # 本地嵌入函数
│   └── utils.ts           # 工具函数
├── data/                  # 数据目录
│   └── onenote/          # 文档存储目录
├── venv/                 # Python虚拟环境
└── chroma/               # ChromaDB数据文件
```

## 🔧 API接口

### 聊天API
- `POST /api/chat` - 发送消息并获取AI回答
  ```json
  {
    "message": "你好，请介绍一下你自己",
    "context": {
      "sessionId": "session_xxx"
    }
  }
  ```
- `GET /api/chat` - 获取系统状态

### 文件管理API
- `POST /api/upload` - 上传文件并自动索引
- `POST /api/reindex` - 重新索引所有文件
- `DELETE /api/reindex` - 清空索引

### 测试API
- `GET /api/test` - 系统健康检查

## 📋 使用指南

### 1. 添加文档
**方式一：文件上传**
- 在聊天界面点击上传按钮
- 选择支持的文件格式(.docx, .pdf, .txt, .md, .html)
- 系统会自动处理和索引

**方式二：文件夹放置**
- 将文件放入 `./data/onenote/` 目录
- 访问 `/api/reindex` 重新索引

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
| PDF文档 | .pdf | ✅ 完全支持 |
| 纯文本 | .txt | ✅ 完全支持 |
| Markdown | .md | ✅ 完全支持 |
| HTML | .html | ✅ 完全支持 |

## 🛠️ 开发

### 开发模式
```bash
yarn dev
```

### 构建
```bash
yarn build
```

### 类型检查
```bash
yarn lint
```

## 🆘 故障排除

### ChromaDB连接失败
```bash
# 检查ChromaDB是否运行
curl http://localhost:8000/api/v1/heartbeat

# 重启ChromaDB
source venv/bin/activate
chroma run --host 0.0.0.0 --port 8000
```

### OpenAI API错误
1. 检查API密钥是否正确设置
2. 确认账户有足够的余额
3. 检查网络连接和代理设置

### 文件上传失败
1. 检查文件格式是否支持
2. 确认文件大小不超过限制
3. 检查目录权限

## 📝 环境变量说明

| 变量名 | 描述 | 默认值 |
|--------|------|--------|
| `OPENAI_API_KEY` | OpenAI API密钥 | 必填 |
| `CHROMA_HOST` | ChromaDB主机地址 | localhost |
| `CHROMA_PORT` | ChromaDB端口 | 8000 |
| `CHROMA_COLLECTION_NAME` | ChromaDB集合名称 | onenote_documents |
| `ONENOTE_FILES_PATH` | 本地文件路径 | ./data/onenote |

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交Issue和Pull Request！