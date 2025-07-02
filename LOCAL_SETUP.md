# 🏠 本地设置指南

本指南详细说明如何在本地环境中设置和配置OneNote RAG Agent。

## 🎯 系统要求

### 硬件要求
- **内存**: 最少4GB，推荐8GB+
- **存储**: 最少2GB可用空间
- **CPU**: 现代多核处理器

### 软件要求
- **Node.js**: 18.0.0 或更高版本
- **npm**: 9.0.0 或更高版本
- **Docker**: 20.0.0 或更高版本
- **Docker Compose**: 2.0.0 或更高版本

## 📦 详细安装步骤

### 1. 环境准备

#### 安装Node.js
```bash
# 使用nvm安装（推荐）
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 18
nvm use 18

# 验证安装
node --version
npm --version
```

#### 安装Docker
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install docker.io docker-compose-plugin

# macOS (使用Homebrew)
brew install docker docker-compose

# Windows
# 下载并安装 Docker Desktop
```

### 2. 项目设置

#### 克隆项目
```bash
git clone <your-repository-url>
cd slefAgent
```

#### 运行自动设置
```bash
npm run setup
```

这将创建以下目录结构：
```
slefAgent/
├── data/
│   └── onenote/           # 文档存储目录
├── chroma/                # ChromaDB数据目录
└── .env.local             # 环境配置文件
```

### 3. 环境配置

#### 编辑环境变量
```bash
# 编辑 .env.local 文件
code .env.local

# 必需配置
OPENAI_API_KEY=sk-your-openai-api-key-here

# 可选配置（已有默认值）
CHROMA_HOST=localhost
CHROMA_PORT=8000
CHROMA_COLLECTION_NAME=onenote_documents
ONENOTE_FILES_PATH=./data/onenote
SUPPORTED_EXTENSIONS=.docx,.pdf,.txt,.html,.md
```

#### 获取OpenAI API密钥
1. 访问 [OpenAI平台](https://platform.openai.com/)
2. 注册/登录账户
3. 导航到 API Keys 页面
4. 创建新的API密钥
5. 复制密钥到 `.env.local` 文件

### 4. 服务启动

#### 启动ChromaDB
```bash
# 启动ChromaDB容器
docker-compose up -d

# 验证服务状态
docker-compose ps
docker-compose logs chroma

# 测试连接
curl http://localhost:8000/api/v1/heartbeat
```

#### 安装依赖
```bash
# 安装项目依赖
npm install

# 验证安装
npm list --depth=0
```

#### 启动开发服务器
```bash
# 启动Next.js开发服务器
npm run dev

# 服务将在 http://localhost:3000 启动
```

## 🔧 配置选项

### ChromaDB配置

#### 自定义端口
```yaml
# docker-compose.yml
services:
  chroma:
    ports:
      - "8001:8000"  # 使用8001端口
```

```env
# .env.local
CHROMA_PORT=8001
```

#### 数据持久化
```yaml
# docker-compose.yml
services:
  chroma:
    volumes:
      - ./chroma_data:/chroma/chroma  # 自定义数据目录
```

### 文件处理配置

#### 支持的文件类型
```env
# .env.local
SUPPORTED_EXTENSIONS=.docx,.pdf,.txt,.html,.md,.rtf
```

#### 文件大小限制
编辑 `app/api/upload/route.ts`：
```typescript
const maxSize = 20 * 1024 * 1024 // 20MB
```

#### 自定义文档目录
```env
# .env.local
ONENOTE_FILES_PATH=/path/to/your/documents
```

### AI模型配置

#### 使用不同的OpenAI模型
编辑 `lib/mastra-rag.ts`：
```typescript
const completion = await this.openai.chat.completions.create({
  model: 'gpt-4',  // 或 'gpt-3.5-turbo-16k'
  // ...
})
```

#### 调整响应参数
```typescript
const completion = await this.openai.chat.completions.create({
  model: 'gpt-3.5-turbo',
  max_tokens: 1500,      // 增加最大令牌数
  temperature: 0.5,      // 降低随机性
  top_p: 0.9,           // 调整核采样
  // ...
})
```

## 📊 性能调优

### 内存优化

#### 调整文档块大小
```typescript
// lib/chroma-service.ts
private chunkText(text: string, maxChunkSize: number = 800): string[] {
  // 减小块大小以节省内存
}
```

#### 批处理大小
```typescript
// lib/chroma-service.ts
const batchSize = 50  // 减小批处理大小
```

### 搜索优化

#### 调整搜索结果数量
```typescript
// lib/mastra-rag.ts
const searchResults = await this.chromaService.searchSimilar(question, 3)
```

#### 相似度阈值
```typescript
// 过滤低相似度结果
const filteredResults = searchResults.documents.filter((_, index) => 
  searchResults.distances[index] < 0.7  // 调整阈值
)
```

## 🐛 故障排除

### 常见问题

#### 1. ChromaDB连接失败
```bash
# 检查Docker状态
docker --version
docker-compose --version

# 重启服务
docker-compose down
docker-compose up -d

# 查看详细日志
docker-compose logs -f chroma
```

#### 2. 端口冲突
```bash
# 查看端口占用
netstat -tulpn | grep :8000
lsof -i :8000

# 修改端口配置
# 编辑 docker-compose.yml 和 .env.local
```

#### 3. 内存不足
```bash
# 监控内存使用
docker stats

# 调整Docker内存限制
# Docker Desktop -> Settings -> Resources
```

#### 4. 文件权限问题
```bash
# 修复目录权限
chmod -R 755 ./data
chmod -R 755 ./chroma

# 确保Docker有访问权限
sudo usermod -aG docker $USER
```

### 日志调试

#### 应用日志
```bash
# 开发服务器日志
npm run dev

# 查看浏览器控制台
# F12 -> Console 标签
```

#### ChromaDB日志
```bash
# 实时查看日志
docker-compose logs -f chroma

# 查看历史日志
docker-compose logs chroma --tail=100
```

#### 系统监控
```bash
# 监控资源使用
htop
docker stats

# 磁盘空间
df -h
du -sh ./data ./chroma
```

## 🔄 备份和恢复

### 数据备份
```bash
# 备份ChromaDB数据
tar -czf chroma_backup_$(date +%Y%m%d).tar.gz ./chroma

# 备份文档
tar -czf documents_backup_$(date +%Y%m%d).tar.gz ./data/onenote
```

### 数据恢复
```bash
# 停止服务
docker-compose down

# 恢复数据
tar -xzf chroma_backup_20231201.tar.gz
tar -xzf documents_backup_20231201.tar.gz

# 重启服务
docker-compose up -d
```

## 🚀 生产部署准备

### 环境变量安全
```bash
# 使用更安全的环境变量管理
# 不要将 .env.local 提交到版本控制

# 生产环境配置
NODE_ENV=production
NEXT_PUBLIC_APP_NAME="OneNote RAG Agent"
```

### 性能优化
```bash
# 构建生产版本
npm run build

# 启动生产服务器
npm start
```

### 监控设置
```typescript
// 添加应用监控
// 集成 Sentry, DataDog 等监控服务
```

## 📝 开发工作流

### 代码格式化
```bash
# 安装开发工具
npm install -D prettier eslint

# 格式化代码
npm run lint
npx prettier --write .
```

### 测试
```bash
# 运行测试
npm test

# API测试
curl -X GET http://localhost:3000/api/test
curl -X POST http://localhost:3000/api/test -d '{"query":"测试问题"}'
```

### 版本控制
```bash
# 提交前检查
npm run lint
npm run build

# 创建功能分支
git checkout -b feature/new-feature
git add .
git commit -m "Add new feature"
```

需要更多帮助？查看 [README.md](./README.md) 或 [QUICKSTART.md](./QUICKSTART.md)。 