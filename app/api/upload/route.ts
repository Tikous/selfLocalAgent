import { NextRequest, NextResponse } from 'next/server'
import { MastraRAGSystem } from '@/lib/mastra-rag'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { existsSync } from 'fs'

const ragSystem = new MastraRAGSystem()

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json(
        { error: '未找到文件' },
        { status: 400 }
      )
    }

    // 检查文件类型
    const allowedTypes = ['.docx', '.pdf', '.txt', '.html', '.md']
    const fileExt = path.extname(file.name).toLowerCase()
    
    if (!allowedTypes.includes(fileExt)) {
      return NextResponse.json(
        { error: `不支持的文件类型: ${fileExt}。支持的类型: ${allowedTypes.join(', ')}` },
        { status: 400 }
      )
    }

    // 检查文件大小 (限制为10MB)
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: '文件大小超过限制（最大10MB）' },
        { status: 400 }
      )
    }

    // 保存文件
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    
    const uploadDir = process.env.ONENOTE_FILES_PATH || './data/onenote'
    
    // 确保上传目录存在
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true })
    }
    
    const filePath = path.join(uploadDir, file.name)
    
    await writeFile(filePath, buffer)
    
    // 初始化并重新索引
    await ragSystem.initialize()
    await ragSystem.indexNotes()
    
    // 获取更新后的统计信息
    const stats = await ragSystem.getStats()
    
    return NextResponse.json({
      success: true,
      message: `文件 ${file.name} 上传成功并已索引`,
      fileName: file.name,
      fileSize: file.size,
      fileType: fileExt,
      stats: stats
    })

  } catch (error) {
    console.error('文件上传失败:', error)
    
    // 更详细的错误处理
    if (error instanceof Error) {
      if (error.message.includes('ChromaDB')) {
        return NextResponse.json(
          { error: 'ChromaDB服务不可用，文件已保存但未索引' },
          { status: 503 }
        )
      }
      if (error.message.includes('ENOENT')) {
        return NextResponse.json(
          { error: '文件保存失败，请检查目录权限' },
          { status: 500 }
        )
      }
    }
    
    return NextResponse.json(
      { error: '文件上传失败' },
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
      message: '文件上传API运行正常',
      currentStats: stats,
      health: health,
      supportedTypes: ['.docx', '.pdf', '.txt', '.html', '.md'],
      maxFileSize: '10MB',
      uploadPath: process.env.ONENOTE_FILES_PATH || './data/onenote'
    })
  } catch (error) {
    console.error('获取上传状态失败:', error)
    return NextResponse.json(
      { error: '获取上传状态失败' },
      { status: 500 }
    )
  }
} 