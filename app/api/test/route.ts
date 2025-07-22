import { NextRequest, NextResponse } from 'next/server'
import { MastraRAGSystem } from '@/lib/mastra-rag'

const ragSystem = new MastraRAGSystem()

export async function GET() {
  try {
    console.log('🧪 开始系统测试...')
    
    // 健康检查
    const health = await ragSystem.healthCheck()
    
    // 获取统计信息
    const stats = await ragSystem.getStats()
    
    // 测试结果
    const testResults = {
      timestamp: new Date().toISOString(),
      health,
      stats,
      tests: {
        databaseConnection: health.database,
        aiConnection: health.ai,
        fileSystem: health.files,
        overallStatus: health.status
      }
    }
    
    console.log('✅ 系统测试完成')
    
    return NextResponse.json({
      success: true,
      message: '系统测试完成',
      results: testResults
    })

  } catch (error) {
    console.error('❌ 系统测试失败:', error)
    
    return NextResponse.json({
      success: false,
      error: '系统测试失败: ' + (error instanceof Error ? error.message : '未知错误'),
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json()
    
    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: '请提供测试查询' },
        { status: 400 }
      )
    }

    console.log(`🧪 测试查询: ${query}`)
    
    // 初始化系统
    await ragSystem.initialize()
    
    // 执行测试查询
    const startTime = Date.now()
    const response = await ragSystem.query(query)
    const endTime = Date.now()
    
    const testResult = {
      query,
      response,
      responseTime: endTime - startTime,
      timestamp: new Date().toISOString()
    }
    
    console.log(`✅ 测试查询完成，耗时: ${testResult.responseTime}ms`)
    
    return NextResponse.json({
      success: true,
      message: '测试查询完成',
      result: testResult
    })

  } catch (error) {
    console.error('❌ 测试查询失败:', error)
    
    return NextResponse.json({
      success: false,
      error: '测试查询失败: ' + (error instanceof Error ? error.message : '未知错误'),
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
} 