import { ChromaService, OneNoteNote } from './chroma-client'
import { LocalOneNoteService, LocalOneNoteNote } from './local-onenote'
import { OpenAI } from 'openai'

export interface RAGResponse {
  answer: string
  sources: Array<{
    title: string
    notebookName: string
    sectionName: string
    confidence: number
    content: string
    filePath?: string
    fileType?: string
  }>
  confidence: number
}

export interface RAGStats {
  totalNotes: number
  totalChunks: number
  lastIndexed: string | null
  chromaHealthy: boolean
}

export class MastraRAGSystem {
  private chromaService: ChromaService
  private oneNoteService: LocalOneNoteService
  private openai: OpenAI
  private initialized: boolean = false

  constructor() {
    this.chromaService = new ChromaService()
    this.oneNoteService = new LocalOneNoteService()
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || ''
    })
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return
    }

    console.log('🚀 初始化Mastra RAG系统...')
    
    try {
      // 检查ChromaDB连接
      const isHealthy = await this.chromaService.healthCheck()
      if (!isHealthy) {
        throw new Error('ChromaDB服务不可用，请确保Docker容器正在运行')
      }

      await this.chromaService.initialize()
      await this.oneNoteService.initialize()
      
      this.initialized = true
      console.log('✅ Mastra RAG系统初始化完成')
    } catch (error) {
      console.error('❌ RAG系统初始化失败:', error)
      throw error
    }
  }

  async indexNotes(): Promise<void> {
    if (!this.initialized) {
      await this.initialize()
    }

    console.log('📚 开始索引本地笔记...')
    
    try {
      const localNotes = await this.oneNoteService.getAllNotes()
      
      if (localNotes.length === 0) {
        console.log('⚠️  未找到任何笔记文件')
        return
      }

      // 转换为OneNoteNote格式
      const notes: OneNoteNote[] = localNotes.map(note => ({
        id: note.id,
        title: note.title,
        content: note.content,
        lastModified: note.lastModified,
        sectionName: note.fileType || '默认分区',
        notebookName: '本地笔记',
        filePath: note.filePath,
        fileType: note.fileType
      }))

      await this.chromaService.addNotes(notes)
      console.log(`✅ 成功索引了 ${notes.length} 个笔记`)
    } catch (error) {
      console.error('❌ 索引笔记时出错:', error)
      throw error
    }
  }

  async query(question: string): Promise<RAGResponse> {
    if (!this.initialized) {
      await this.initialize()
    }

    console.log(`🔍 处理查询: ${question}`)

    try {
      // 1. 在向量数据库中搜索相关文档
      const searchResults = await this.chromaService.searchSimilar(question, 5)
      
      if (searchResults.documents.length === 0) {
        return {
          answer: '抱歉，我在您的笔记中没有找到相关信息。请确保已经上传了相关的笔记文件，并完成了索引。',
          sources: [],
          confidence: 0
        }
      }

      // 2. 准备上下文
      const context = searchResults.documents.join('\n\n---\n\n')
      
      // 3. 构建增强的提示词
      const systemPrompt = `你是一个智能的OneNote助手，专门帮助用户从他们的笔记中查找和分析信息。

请遵循以下原则：
1. 基于提供的笔记内容回答问题
2. 如果信息不足，诚实地说明
3. 尽量引用具体的笔记内容
4. 保持回答的准确性和相关性
5. 用中文回答

笔记内容：
${context}`

      const userPrompt = `基于上述笔记内容，请回答以下问题：

${question}

请提供详细且有用的回答，并在可能的情况下引用具体的笔记内容。`

      // 4. 调用OpenAI生成回答
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: userPrompt
          }
        ],
        max_tokens: 1000,
        temperature: 0.7
      })

      const answer = completion.choices[0]?.message?.content || '抱歉，我无法生成回答。'

      // 5. 准备来源信息
      const sources = searchResults.metadatas.map((metadata, index) => ({
        title: metadata.title,
        notebookName: metadata.notebookName,
        sectionName: metadata.sectionName,
        confidence: Math.max(0, 1 - (searchResults.distances[index] || 0)),
        content: searchResults.documents[index].substring(0, 200) + '...',
        filePath: metadata.filePath,
        fileType: metadata.fileType
      }))

      // 6. 计算整体置信度
      const avgConfidence = sources.reduce((sum, source) => sum + source.confidence, 0) / sources.length

      console.log(`✅ 查询完成，找到 ${sources.length} 个相关来源`)

      return {
        answer,
        sources,
        confidence: avgConfidence
      }
    } catch (error) {
      console.error('❌ 查询处理失败:', error)
      throw new Error(`查询处理失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  async getStats(): Promise<RAGStats> {
    try {
      if (!this.initialized) {
        await this.initialize()
      }

      const chromaStats = await this.chromaService.getCollectionStats()
      const fileStats = await this.oneNoteService.getFileStats()
      const isHealthy = await this.chromaService.healthCheck()
      
      return {
        totalNotes: fileStats.totalFiles,
        totalChunks: chromaStats.count,
        lastIndexed: fileStats.lastModified?.toISOString() || null,
        chromaHealthy: isHealthy
      }
    } catch (error) {
      console.error('获取统计信息失败:', error)
      return {
        totalNotes: 0,
        totalChunks: 0,
        lastIndexed: null,
        chromaHealthy: false
      }
    }
  }

  async updateNote(noteId: string): Promise<void> {
    if (!this.initialized) {
      await this.initialize()
    }

    console.log(`🔄 更新笔记: ${noteId}`)
    
    try {
      // 重新索引所有笔记（简化版本）
      await this.indexNotes()
      console.log(`✅ 笔记更新完成`)
    } catch (error) {
      console.error(`❌ 更新笔记失败:`, error)
      throw error
    }
  }

  async deleteNote(noteId: string): Promise<void> {
    if (!this.initialized) {
      await this.initialize()
    }

    console.log(`🗑️  删除笔记: ${noteId}`)
    
    try {
      await this.chromaService.deleteNoteChunks(noteId)
      console.log(`✅ 笔记 ${noteId} 删除完成`)
    } catch (error) {
      console.error(`❌ 删除笔记 ${noteId} 失败:`, error)
      throw error
    }
  }

  async clearIndex(): Promise<void> {
    if (!this.initialized) {
      await this.initialize()
    }

    console.log('🧹 清空索引...')
    
    try {
      await this.chromaService.clearCollection()
      console.log('✅ 索引已清空')
    } catch (error) {
      console.error('❌ 清空索引失败:', error)
      throw error
    }
  }

  async healthCheck(): Promise<{
    status: string
    chroma: boolean
    openai: boolean
    files: boolean
  }> {
    const health = {
      status: 'healthy',
      chroma: false,
      openai: false,
      files: false
    }

    try {
      // 检查ChromaDB
      health.chroma = await this.chromaService.healthCheck()

      // 检查OpenAI
      try {
        await this.openai.models.list()
        health.openai = true
      } catch (error) {
        console.error('OpenAI连接失败:', error)
      }

      // 检查文件系统
      try {
        await this.oneNoteService.getFileStats()
        health.files = true
      } catch (error) {
        console.error('文件系统检查失败:', error)
      }

      if (!health.chroma || !health.openai || !health.files) {
        health.status = 'degraded'
      }
    } catch (error) {
      health.status = 'unhealthy'
      console.error('健康检查失败:', error)
    }

    return health
  }
} 