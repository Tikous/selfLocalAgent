import { NextRequest, NextResponse } from 'next/server'
import { MastraRAGSystem } from '@/lib/mastra-rag'

const ragSystem = new MastraRAGSystem()

export async function POST(request: NextRequest) {
  try {
    console.log('开始重新索引本地OneNote文件...')
    
    // 初始化RAG系统
    await ragSystem.initialize()
    
    // 重新索引所有本地文件
    await ragSystem.indexNotes()
    
    // 获取索引统计信息
    const stats = await ragSystem.getStats()
    
    console.log('重新索引完成')
    
    return NextResponse.json({
      success: true,
      message: '本地文件索引已成功更新',
      stats: stats
    })

  } catch (error) {
    console.error('重新索引失败:', error)
    
    // 更详细的错误处理
    if (error instanceof Error) {
      if (error.message.includes('PostgreSQL')) {
        return NextResponse.json(
          { 
            success: false,
            error: 'PostgreSQL向量数据库服务不可用，请检查数据库连接配置'
          },
          { status: 503 }
        )
      }
    }
    
    return NextResponse.json(
      { 
        success: false,
        error: '重新索引失败: ' + (error instanceof Error ? error.message : '未知错误')
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    await ragSystem.initialize()
    const stats = await ragSystem.getStats()
    const health = await ragSystem.healthCheck()
    
    return NextResponse.json({
      status: '本地文件索引状态正常',
      stats: stats,
      health: health,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('获取索引状态失败:', error)
    return NextResponse.json(
      { error: '获取索引状态失败' },
      { status: 500 }
    )
  }
}

export async function DELETE() {
  try {
    console.log('开始清空索引...')
    
    await ragSystem.initialize()
    await ragSystem.clearIndex()
    
    console.log('索引清空完成')
    
    return NextResponse.json({
      success: true,
      message: '索引已成功清空'
    })

  } catch (error) {
    console.error('清空索引失败:', error)
    return NextResponse.json(
      { 
        success: false,
        error: '清空索引失败: ' + (error instanceof Error ? error.message : '未知错误')
      },
      { status: 500 }
    )
  }
} 