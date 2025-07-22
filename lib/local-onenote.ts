import fs from 'fs'
import path from 'path'
import mammoth from 'mammoth'
import { extractTextFromHTML } from './utils'

export interface LocalOneNoteNote {
  id: string
  title: string
  content: string
  lastModified: Date
  filePath: string
  fileType: string
  size: number
}

export interface OneNoteNote {
  id: string
  title: string
  content: string
  lastModified: Date
  sectionName: string
  notebookName: string
  filePath?: string
  fileType?: string
}

export class LocalOneNoteService {
  private watchFolder: string
  private supportedExtensions: string[]

  constructor() {
    this.watchFolder = process.env.ONENOTE_FILES_PATH || './data/onenote'
    this.supportedExtensions = (process.env.SUPPORTED_EXTENSIONS || '.docx,.pdf,.txt,.html,.md')
      .split(',')
      .map(ext => ext.trim())
  }

  async initialize(): Promise<void> {
    // 确保目录存在
    if (!fs.existsSync(this.watchFolder)) {
      fs.mkdirSync(this.watchFolder, { recursive: true })
      console.log(`✅ 已创建OneNote文件目录: ${this.watchFolder}`)
    }
  }

  async getAllNotes(): Promise<LocalOneNoteNote[]> {
    await this.initialize()
    
    const notes: LocalOneNoteNote[] = []
    const files = this.getAllFiles(this.watchFolder)

    for (const filePath of files) {
      try {
        const note = await this.processFile(filePath)
        if (note) {
          notes.push(note)
        }
      } catch (error) {
        console.error(`处理文件失败 ${filePath}:`, error)
      }
    }

    console.log(`📚 已处理 ${notes.length} 个本地文件`)
    return notes
  }

  private getAllFiles(dir: string): string[] {
    const files: string[] = []
    
    if (!fs.existsSync(dir)) {
      return files
    }

    const items = fs.readdirSync(dir)
    
    for (const item of items) {
      const fullPath = path.join(dir, item)
      const stat = fs.statSync(fullPath)
      
      if (stat.isDirectory()) {
        files.push(...this.getAllFiles(fullPath))
      } else if (this.isSupportedFile(fullPath)) {
        files.push(fullPath)
      }
    }
    
    return files
  }

  private isSupportedFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase()
    return this.supportedExtensions.includes(ext)
  }

  private async processFile(filePath: string): Promise<LocalOneNoteNote | null> {
    const stat = fs.statSync(filePath)
    const ext = path.extname(filePath).toLowerCase()
    const fileName = path.basename(filePath, ext)
    
    let content = ''
    
    try {
      switch (ext) {
        case '.docx':
          content = await this.extractFromDocx(filePath)
          break
        case '.pdf':
          content = await this.extractFromPdf(filePath)
          break
        case '.txt':
        case '.md':
          content = fs.readFileSync(filePath, 'utf-8')
          break
        case '.html':
          const htmlContent = fs.readFileSync(filePath, 'utf-8')
          content = extractTextFromHTML(htmlContent)
          break
        default:
          console.warn(`不支持的文件类型: ${ext}`)
          return null
      }

      if (!content.trim()) {
        console.warn(`文件内容为空: ${filePath}`)
        return null
      }

      return {
        id: this.generateFileId(filePath),
        title: fileName,
        content: content.trim(),
        lastModified: stat.mtime,
        filePath: filePath,
        fileType: ext,
        size: stat.size
      }
    } catch (error) {
      console.error(`提取文件内容失败 ${filePath}:`, error)
      return null
    }
  }

  private async extractFromDocx(filePath: string): Promise<string> {
    const buffer = fs.readFileSync(filePath)
    const result = await mammoth.extractRawText({ buffer })
    return result.value
  }

  private async extractFromPdf(filePath: string): Promise<string> {
    // PDF解析功能待实现
    console.warn(`PDF文件暂不支持: ${filePath}`)
    return `PDF文件: ${path.basename(filePath)} (暂不支持内容提取，请转换为其他格式)`
  }

  private generateFileId(filePath: string): string {
    // 使用文件路径生成唯一ID（使用哈希而不是简单截取）
    let hash = 0
    for (let i = 0; i < filePath.length; i++) {
      const char = filePath.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // 转换为32位整数
    }
    return 'file_' + Math.abs(hash).toString(36)
  }

  async watchForChanges(callback: (notes: LocalOneNoteNote[]) => void): Promise<void> {
    if (process.env.ONENOTE_WATCH_FOLDER !== 'true') {
      return
    }

    console.log(`👀 开始监控文件夹: ${this.watchFolder}`)
    
    fs.watch(this.watchFolder, { recursive: true }, async (eventType, filename) => {
      if (filename && this.isSupportedFile(filename)) {
        console.log(`📝 检测到文件变化: ${filename}`)
        
        // 延迟一点时间，确保文件写入完成
        setTimeout(async () => {
          try {
            const notes = await this.getAllNotes()
            callback(notes)
          } catch (error) {
            console.error('重新加载文件失败:', error)
          }
        }, 1000)
      }
    })
  }

  async getFileStats(): Promise<{
    totalFiles: number
    totalSize: number
    fileTypes: Record<string, number>
    lastModified: Date | null
  }> {
    const files = this.getAllFiles(this.watchFolder)
    const stats = {
      totalFiles: files.length,
      totalSize: 0,
      fileTypes: {} as Record<string, number>,
      lastModified: null as Date | null
    }

    for (const filePath of files) {
      const stat = fs.statSync(filePath)
      const ext = path.extname(filePath).toLowerCase()
      
      stats.totalSize += stat.size
      stats.fileTypes[ext] = (stats.fileTypes[ext] || 0) + 1
      
      if (!stats.lastModified || stat.mtime > stats.lastModified) {
        stats.lastModified = stat.mtime
      }
    }

    return stats
  }

  // 添加新文件的方法
  async addFile(sourceFilePath: string, targetFileName?: string): Promise<boolean> {
    await this.initialize()
    
    const fileName = targetFileName || path.basename(sourceFilePath)
    const targetPath = path.join(this.watchFolder, fileName)
    
    try {
      fs.copyFileSync(sourceFilePath, targetPath)
      console.log(`✅ 已添加文件: ${fileName}`)
      return true
    } catch (error) {
      console.error(`添加文件失败:`, error)
      return false
    }
  }

  // 删除文件的方法
  async removeFile(fileName: string): Promise<boolean> {
    const filePath = path.join(this.watchFolder, fileName)
    
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
        console.log(`🗑️ 已删除文件: ${fileName}`)
        return true
      }
      return false
    } catch (error) {
      console.error(`删除文件失败:`, error)
      return false
    }
  }
} 