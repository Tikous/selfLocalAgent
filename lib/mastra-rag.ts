import { PostgresVectorService, DocumentChunk } from './postgres-vector-service'
import { LocalOneNoteService, LocalOneNoteNote, OneNoteNote } from './local-onenote'
import { HttpsProxyAgent } from 'https-proxy-agent'
import * as https from 'https'

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
  databaseHealthy: boolean
}

export class MastraRAGSystem {
  private vectorService: PostgresVectorService
  private oneNoteService: LocalOneNoteService
  private apiKey: string
  private apiBaseUrl: string
  private initialized: boolean = false

  constructor() {
    this.vectorService = new PostgresVectorService()
    this.oneNoteService = new LocalOneNoteService()
    
    // 配置API
    if (process.env.KIMI_API_KEY) {
      console.log('🤖 使用Kimi API (Moonshot AI)')
      this.apiKey = process.env.KIMI_API_KEY
      this.apiBaseUrl = 'https://api.moonshot.cn/v1'
    } else {
      throw new Error('需要配置KIMI_API_KEY环境变量')
    }
  }

  private async callKimiAPI(messages: Array<{role: string, content: string}>, model: string = 'moonshot-v1-8k'): Promise<string> {
    const response = await fetch(`${this.apiBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: 1000,
        temperature: 0.7
      })
    })

    if (!response.ok) {
      throw new Error(`Kimi API调用失败: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    return data.choices[0]?.message?.content || '抱歉，我无法生成回答。'
  }

  private async checkKimiAPI(): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      })
      return response.ok
    } catch (error) {
      return false
    }
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return
    }

    console.log('🚀 初始化Mastra RAG系统...')
    
    try {
      // 检查PostgreSQL向量数据库连接
      const isHealthy = await this.vectorService.healthCheck()
      if (!isHealthy) {
        throw new Error('PostgreSQL向量数据库服务不可用，请检查数据库连接配置')
      }

      await this.vectorService.initialize()
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

      await this.vectorService.addNotes(notes)
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
      const searchLimit = parseInt(process.env.VECTOR_SEARCH_LIMIT || '5')
      const searchResults = await this.vectorService.searchSimilar(question, searchLimit)
      
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

      // 4. 调用AI API生成回答
      const answer = await this.callKimiAPI([
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: userPrompt
        }
      ])

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

      const vectorStats = await this.vectorService.getCollectionStats()
      const fileStats = await this.oneNoteService.getFileStats()
      const isHealthy = await this.vectorService.healthCheck()
      
      return {
        totalNotes: fileStats.totalFiles,
        totalChunks: vectorStats.count,
        lastIndexed: fileStats.lastModified?.toISOString() || null,
        databaseHealthy: isHealthy
      }
    } catch (error) {
      console.error('获取统计信息失败:', error)
      return {
        totalNotes: 0,
        totalChunks: 0,
        lastIndexed: null,
        databaseHealthy: false
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
      // PostgreSQL版本暂时使用重新索引来处理删除
      // TODO: 实现具体的删除逻辑
      await this.indexNotes()
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
      await this.vectorService.clearCollection()
      console.log('✅ 索引已清空')
    } catch (error) {
      console.error('❌ 清空索引失败:', error)
      throw error
    }
  }

  async healthCheck(): Promise<{
    status: string
    database: boolean
    ai: boolean
    files: boolean
  }> {
    const health = {
      status: 'healthy',
      database: false,
      ai: false,
      files: false
    }

    try {
      // 检查PostgreSQL向量数据库
      health.database = await this.vectorService.healthCheck()

      // 检查AI API
      health.ai = await this.checkKimiAPI()
      if (!health.ai) {
        console.error('AI API连接失败')
      }

      // 检查文件系统
      try {
        await this.oneNoteService.getFileStats()
        health.files = true
      } catch (error) {
        console.error('文件系统检查失败:', error)
      }

      if (!health.database || !health.ai || !health.files) {
        health.status = 'degraded'
      }
    } catch (error) {
      health.status = 'unhealthy'
      console.error('健康检查失败:', error)
    }

    return health
  }
} 