import { NextRequest, NextResponse } from 'next/server'
import { MastraRAGSystem } from '@/lib/mastra-rag'

const ragSystem = new MastraRAGSystem()

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json()
    
    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: '无效的消息格式' },
        { status: 400 }
      )
    }

    // 确保RAG系统已初始化
    await ragSystem.initialize()

    // 处理用户查询
    const response = await ragSystem.query(message)

    return NextResponse.json({
      message: response.answer,
      sources: response.sources.map(source => ({
        title: source.title,
        notebookName: source.notebookName,
        sectionName: source.sectionName,
        confidence: source.confidence,
        content: source.content,
        filePath: source.filePath,
        fileType: source.fileType
      })),
      confidence: response.confidence
    })

  } catch (error) {
    console.error('Chat API错误:', error)
    
    // 更详细的错误处理
    if (error instanceof Error) {
      if (error.message.includes('ChromaDB')) {
        return NextResponse.json(
          { error: 'ChromaDB服务不可用，请确保Docker容器正在运行' },
          { status: 503 }
        )
      }
      if (error.message.includes('OpenAI') || error.message.includes('DeepSeek')) {
        return NextResponse.json(
          { error: 'DeepSeek API服务不可用，请检查API密钥配置' },
          { status: 503 }
        )
      }
    }
    
    return NextResponse.json(
      { error: '服务器内部错误，请稍后重试' },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const health = await ragSystem.healthCheck()
    const stats = await ragSystem.getStats()
    
    return NextResponse.json({
      status: 'OneNote RAG Agent API 运行正常',
      health,
      stats,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('健康检查失败:', error)
    return NextResponse.json(
      { error: '健康检查失败' },
      { status: 500 }
    )
  }
} 