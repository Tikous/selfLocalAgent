# 🚀 DeepSeek API 迁移指南

本项目已从 OpenAI API 迁移到 DeepSeek API，以提供更稳定的网络连接和更好的性能。

## 🔄 主要变更

### API 提供商
- **之前**: OpenAI GPT-3.5/4
- **现在**: DeepSeek Chat

### 环境变量
- **之前**: `OPENAI_API_KEY`
- **现在**: `DEEPSEEK_API_KEY`

### API 端点
- **之前**: `https://api.openai.com`
- **现在**: `https://api.deepseek.com`

### 模型名称
- **之前**: `gpt-3.5-turbo`, `gpt-4`
- **现在**: `deepseek-chat`, `deepseek-coder`

## 📝 配置步骤

### 1. 获取 DeepSeek API 密钥

1. 访问 [DeepSeek 平台](https://platform.deepseek.com/)
2. 注册/登录账户
3. 导航到 API Keys 页面
4. 创建新的 API 密钥
5. 复制密钥（以 `sk-` 开头）

### 2. 更新环境变量

编辑你的 `.env` 文件：

```env
# DeepSeek API配置
DEEPSEEK_API_KEY=sk-your-deepseek-api-key-here

# ChromaDB配置
CHROMA_HOST=localhost
CHROMA_PORT=8000
CHROMA_COLLECTION_NAME=onenote_documents

# 本地文件配置
ONENOTE_FILES_PATH=./data/onenote
SUPPORTED_EXTENSIONS=.docx,.pdf,.txt,.html,.md
ONENOTE_WATCH_FOLDER=false

# Mastra配置
MASTRA_LOG_LEVEL=info

# 应用配置
NODE_ENV=development
NEXT_PUBLIC_APP_NAME=OneNote RAG Agent
```

### 3. 重启服务

```bash
# 停止现有服务
yarn dev # Ctrl+C 停止
chroma run # Ctrl+C 停止

# 重新启动
chroma run --host localhost --port 8000 --path ./chroma &
yarn dev
```

## ✨ DeepSeek 优势

### 🌐 网络连接
- 国内访问更稳定
- 响应速度更快
- 减少网络超时问题

### 💰 成本效益
- 更具竞争力的定价
- 高性价比的API调用

### 🎯 性能表现
- 优秀的中文理解能力
- 代码生成能力强
- 推理能力出色

### 🔧 兼容性
- 完全兼容 OpenAI API 格式
- 无需修改现有代码逻辑
- 平滑迁移体验

## 🛠️ 可用模型

### deepseek-chat
- **用途**: 通用对话和问答
- **特点**: 均衡的性能，适合大多数场景
- **推荐**: 默认选择

### deepseek-coder
- **用途**: 代码生成和编程相关任务
- **特点**: 专门优化的代码理解能力
- **推荐**: 如果主要处理代码文档

## 🔍 迁移验证

### 1. 测试 API 连接
访问 `http://localhost:3000/api/test` 检查系统状态

### 2. 验证对话功能
在聊天界面发送测试消息，确认正常响应

### 3. 检查系统状态
确认界面显示 "DeepSeek" 连接状态为绿色

## ❓ 常见问题

### Q: 如何获取 DeepSeek API 密钥？
A: 访问 [platform.deepseek.com](https://platform.deepseek.com/)，注册账户后在 API Keys 页面创建

### Q: 迁移后功能有变化吗？
A: 功能完全一致，只是底层API提供商改变

### Q: 可以同时使用 OpenAI 和 DeepSeek 吗？
A: 目前版本只支持一个API提供商，建议统一使用 DeepSeek

### Q: 如何回退到 OpenAI？
A: 修改代码中的 API 端点和环境变量即可回退

### Q: 成本会有什么变化？
A: DeepSeek 通常比 OpenAI 更具成本效益

## 🆘 故障排除

### API 连接失败
1. 检查 API 密钥是否正确
2. 确认网络连接正常
3. 验证环境变量设置

### 响应异常
1. 检查模型名称是否正确
2. 确认请求格式符合 DeepSeek API 规范
3. 查看控制台错误日志

### 性能问题
1. 调整 `max_tokens` 参数
2. 优化 `temperature` 设置
3. 考虑使用不同的模型

## 📞 技术支持

如果遇到迁移问题，请：

1. 查看应用日志和控制台输出
2. 检查 DeepSeek API 文档
3. 提交 GitHub Issue 寻求帮助

---

**迁移完成后，您将享受到更稳定、更快速的 AI 服务体验！** 🎉 