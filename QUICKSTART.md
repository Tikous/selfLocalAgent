# 🚀 OneNote RAG Agent 快速启动指南

本指南将帮助您在5分钟内启动并运行OneNote RAG Agent。

## 📋 前置要求

- Node.js 18+ 
- Docker 和 Docker Compose
- DeepSeek API 密钥

## ⚡ 快速启动（5步）

### 1️⃣ 下载并设置项目

```bash
# 克隆项目（如果还没有）
git clone <repository-url>
cd slefAgent

# 自动设置项目
npm run setup
```

### 2️⃣ 配置DeepSeek API密钥

编辑 `.env.local` 文件：

```bash
# 打开环境变量文件
code .env.local  # 或使用其他编辑器

# 设置您的DeepSeek API密钥
DEEPSEEK_API_KEY=sk-your-actual-deepseek-api-key-here
```

### 3️⃣ 启动ChromaDB

```bash
# 启动ChromaDB服务（后台运行）
docker-compose up -d

# 验证服务运行状态
docker-compose ps
```

### 4️⃣ 安装依赖并启动

```bash
# 安装项目依赖
npm install

# 启动开发服务器
npm run dev
```

### 5️⃣ 开始使用

1. 打开浏览器访问 [http://localhost:3000](http://localhost:3000)
2. 上传您的文档或使用示例文件
3. 开始智能问答！

## 🎯 验证安装

访问以下URL验证各组件状态：

- **应用主页**: http://localhost:3000
- **系统状态**: http://localhost:3000/api/chat
- **ChromaDB**: http://localhost:8000
- **测试API**: http://localhost:3000/api/test

## 📁 添加您的文档

### 方法1：直接上传（推荐）

1. 在网页界面点击上传按钮 📎
2. 选择文档文件（.docx, .pdf, .txt, .md, .html）
3. 等待自动索引完成

### 方法2：文件夹放置

1. 将文档放入 `./data/onenote/` 目录
2. 点击界面上的"重新索引"按钮

## 💬 开始对话

尝试这些示例问题：

- "我的笔记中有哪些重要内容？"
- "关于[某个主题]有什么信息？"
- "总结一下我的学习笔记"
- "帮我找找关于[关键词]的内容"

## 🔧 常见问题

### Q: ChromaDB连接失败怎么办？

```bash
# 检查Docker容器状态
docker-compose ps

# 重启ChromaDB服务
docker-compose restart

# 查看日志
docker-compose logs chroma
```

### Q: DeepSeek API错误怎么解决？

1. 确认API密钥正确设置
2. 检查账户余额
3. 验证网络连接

### Q: 文件上传失败？

1. 确认文件格式支持（.docx, .pdf, .txt, .md, .html）
2. 检查文件大小不超过10MB
3. 确保有足够的磁盘空间

### Q: 系统运行缓慢？

1. 检查可用内存
2. 减少同时处理的文档数量
3. 考虑升级硬件配置

## 🎛️ 系统管理

### 查看系统状态

```bash
# 检查所有服务
curl http://localhost:3000/api/test

# 查看索引统计
curl http://localhost:3000/api/reindex
```

### 重新索引文档

```bash
# API方式
curl -X POST http://localhost:3000/api/reindex

# 或在网页界面点击"重新索引"按钮
```

### 清空索引

```bash
# 清空所有索引（谨慎使用）
curl -X DELETE http://localhost:3000/api/reindex
```

## 📊 性能优化

### 1. 调整文档块大小

编辑 `lib/chroma-service.ts`：

```typescript
// 调整块大小（默认1000字符）
const noteChunks = this.chunkText(note.content, 1500)
```

### 2. 优化搜索结果数量

编辑 `lib/mastra-rag.ts`：

```typescript
// 调整搜索结果数量（默认5个）
const searchResults = await this.chromaService.searchSimilar(question, 3)
```

### 3. 调整AI模型

编辑环境变量或代码中的模型设置：

```typescript
model: 'gpt-4',  // 或 'gpt-3.5-turbo'
```

## 🔄 更新项目

```bash
# 拉取最新代码
git pull

# 更新依赖
npm install

# 重启服务
docker-compose restart
npm run dev
```

## 🆘 获取帮助

- **文档**: 查看完整的 [README.md](./README.md)
- **Issues**: 在GitHub上创建Issue
- **日志**: 查看浏览器控制台和服务器日志

## 🎉 下一步

- 探索更多API功能
- 自定义聊天界面
- 集成更多文档格式
- 部署到生产环境

祝您使用愉快！ 🚀 