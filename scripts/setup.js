const fs = require('fs')
const path = require('path')

console.log('🚀 开始设置OneNote RAG Agent项目...')

// 创建必要的目录
const directories = [
  './data',
  './data/onenote',
  './chroma'
]

directories.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
    console.log(`✅ 创建目录: ${dir}`)
  } else {
    console.log(`📁 目录已存在: ${dir}`)
  }
})

// 检查环境变量文件
const envExamplePath = './config/env.example'
const envPath = './.env.local'

if (fs.existsSync(envExamplePath) && !fs.existsSync(envPath)) {
  fs.copyFileSync(envExamplePath, envPath)
  console.log('✅ 创建环境变量文件: .env.local')
  console.log('⚠️  请编辑 .env.local 文件，设置您的 OPENAI_API_KEY')
} else if (fs.existsSync(envPath)) {
  console.log('📝 环境变量文件已存在: .env.local')
} else {
  console.log('❌ 未找到环境变量示例文件')
}

// 创建示例笔记文件
const sampleNotePath = './data/onenote/示例笔记.md'
const sampleContent = `# 欢迎使用OneNote RAG Agent

这是一个示例笔记文件，用于测试系统功能。

## 功能特点

1. **智能问答**: 基于您的笔记内容回答问题
2. **文档上传**: 支持多种格式的文档上传
3. **向量检索**: 使用ChromaDB进行高效的语义搜索
4. **实时索引**: 自动索引新上传的文档

## 支持的文件格式

- Word文档 (.docx)
- PDF文件 (.pdf) 
- 纯文本 (.txt)
- Markdown (.md)
- HTML文件 (.html)

## 快速开始

1. 启动ChromaDB服务: \`docker-compose up -d\`
2. 配置环境变量: 编辑 \`.env.local\` 文件
3. 启动开发服务器: \`npm run dev\`
4. 上传您的笔记文件
5. 开始智能问答

## 技术栈

- **前端**: Next.js + React + TypeScript
- **向量数据库**: ChromaDB
- **AI模型**: OpenAI GPT-3.5/4
- **文档处理**: Mammoth (Word), PDF-Parse (PDF)

祝您使用愉快！
`

if (!fs.existsSync(sampleNotePath)) {
  fs.writeFileSync(sampleNotePath, sampleContent, 'utf8')
  console.log('✅ 创建示例笔记文件')
} else {
  console.log('📝 示例笔记文件已存在')
}

// 检查Docker Compose文件
if (fs.existsSync('./docker-compose.yml')) {
  console.log('🐳 Docker Compose配置文件已就绪')
  console.log('   运行 "docker-compose up -d" 启动ChromaDB服务')
} else {
  console.log('❌ 未找到Docker Compose配置文件')
}

console.log('\n🎉 项目设置完成！')
console.log('\n📋 接下来的步骤:')
console.log('1. 编辑 .env.local 文件，设置您的 OPENAI_API_KEY')
console.log('2. 运行 "docker-compose up -d" 启动ChromaDB服务')
console.log('3. 运行 "npm install" 安装依赖')
console.log('4. 运行 "npm run dev" 启动开发服务器')
console.log('5. 访问 http://localhost:3000 开始使用')
console.log('\n💡 提示: 您可以将OneNote导出的文件放入 ./data/onenote 目录')
console.log('   或使用网页界面上传文件进行索引。') 