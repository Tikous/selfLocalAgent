// 仅在服务端使用的ChromaDB客户端包装器

export interface DocumentChunk {
  id: string
  content: string
  metadata: {
    noteId: string
    title: string
    sectionName: string
    notebookName: string
    chunkIndex: number
    lastModified: string
    filePath: string
    fileType: string
  }
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

// 动态导入ChromaDB（仅在服务端）
let ChromaClientClass: any = null
let OpenAIEmbeddingFunctionClass: any = null

async function loadChromaDB() {
  if (typeof window !== 'undefined') {
    throw new Error('ChromaDB只能在服务端使用')
  }
  
  if (!ChromaClientClass) {
    const chromadb = await import('chromadb')
    ChromaClientClass = chromadb.ChromaClient
    OpenAIEmbeddingFunctionClass = chromadb.OpenAIEmbeddingFunction
  }
  
  return { 
    ChromaClient: ChromaClientClass, 
    OpenAIEmbeddingFunction: OpenAIEmbeddingFunctionClass 
  }
}

export class ChromaService {
  private client: any = null
  private collection: any = null
  private embeddingFunction: any = null
  private collectionName: string
  private initialized: boolean = false

  constructor() {
    this.collectionName = process.env.CHROMA_COLLECTION_NAME || 'onenote_documents'
  }

  async initialize(): Promise<void> {
    if (this.initialized) return

    try {
      console.log('🔌 初始化ChromaDB服务...')
      
      // 动态加载ChromaDB
      const { ChromaClient: Client, OpenAIEmbeddingFunction: EmbedFunc } = await loadChromaDB()
      
      const chromaHost = process.env.CHROMA_HOST || 'localhost'
      const chromaPort = process.env.CHROMA_PORT || '8000'

      this.client = new Client({
        path: `http://${chromaHost}:${chromaPort}`
      })

      // 确保DeepSeek API密钥存在
      const deepseekKey = process.env.DEEPSEEK_API_KEY
      if (!deepseekKey || deepseekKey === 'your_deepseek_api_key_here') {
        throw new Error('DEEPSEEK_API_KEY未设置或使用默认值')
      }

      this.embeddingFunction = new EmbedFunc({
        openai_api_key: deepseekKey,
        openai_model: 'text-embedding-ada-002'
      })

      // 尝试获取现有集合
      try {
        this.collection = await this.client.getCollection({
          name: this.collectionName,
          embeddingFunction: this.embeddingFunction
        })
        console.log(`✅ 连接到现有集合: ${this.collectionName}`)
      } catch (error) {
        // 如果集合不存在，创建新集合
        console.log(`📚 创建新集合: ${this.collectionName}`)
        this.collection = await this.client.createCollection({
          name: this.collectionName,
          embeddingFunction: this.embeddingFunction,
          metadata: {
            description: 'OneNote文档向量存储',
            created_at: new Date().toISOString()
          }
        })
      }

      this.initialized = true
      console.log('✅ ChromaDB服务初始化完成')
    } catch (error) {
      console.error('❌ ChromaDB初始化失败:', error)
      throw new Error(`ChromaDB初始化失败: ${error}`)
    }
  }

  async addNotes(notes: OneNoteNote[]): Promise<void> {
    await this.initialize()
    
    if (!this.collection) {
      throw new Error('ChromaDB集合未初始化')
    }

    console.log(`📝 开始处理 ${notes.length} 个笔记...`)
    
    const chunks: DocumentChunk[] = []
    
    // 将每个笔记分割成较小的块
    for (const note of notes) {
      const noteChunks = this.chunkText(note.content, 1000)
      
      noteChunks.forEach((chunk, index) => {
        chunks.push({
          id: `${note.id}_chunk_${index}`,
          content: chunk,
          metadata: {
            noteId: note.id,
            title: note.title,
            sectionName: note.sectionName,
            notebookName: note.notebookName,
            chunkIndex: index,
            lastModified: note.lastModified.toISOString(),
            filePath: note.filePath || '',
            fileType: note.fileType || ''
          }
        })
      })
    }

    if (chunks.length === 0) {
      console.log('⚠️  没有找到有效的文档块')
      return
    }

    // 批量添加到ChromaDB
    console.log(`🔄 添加 ${chunks.length} 个文档块到向量数据库...`)
    
    const batchSize = 100
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize)
      
      try {
        await this.collection.add({
          ids: batch.map(chunk => chunk.id),
          documents: batch.map(chunk => chunk.content),
          metadatas: batch.map(chunk => chunk.metadata)
        })
        
        console.log(`✅ 已处理批次 ${Math.floor(i / batchSize) + 1}/${Math.ceil(chunks.length / batchSize)}`)
      } catch (error) {
        console.error(`❌ 批次 ${Math.floor(i / batchSize) + 1} 添加失败:`, error)
        throw error
      }
    }

    console.log(`✅ 已添加 ${chunks.length} 个文档块到向量数据库`)
  }

  async searchSimilar(query: string, limit: number = 5): Promise<{
    documents: string[]
    metadatas: any[]
    distances: number[]
  }> {
    await this.initialize()
    
    if (!this.collection) {
      throw new Error('ChromaDB集合未初始化')
    }

    try {
      const results = await this.collection.query({
        queryTexts: [query],
        nResults: limit
      })

      return {
        documents: (results.documents[0] || []).filter((doc: any): doc is string => doc !== null),
        metadatas: results.metadatas[0] || [],
        distances: results.distances?.[0] || []
      }
    } catch (error) {
      console.error('❌ 向量搜索失败:', error)
      throw new Error(`向量搜索失败: ${error}`)
    }
  }

  private chunkText(text: string, maxChunkSize: number): string[] {
    const chunks: string[] = []
    
    // 首先尝试按段落分割
    const paragraphs = text.split(/\n\s*\n/)
    
    for (const paragraph of paragraphs) {
      if (paragraph.trim().length === 0) continue
      
      if (paragraph.length <= maxChunkSize) {
        chunks.push(paragraph.trim())
      } else {
        // 如果段落太长，按句子分割
        const sentences = paragraph.split(/[.!?]+/)
        let currentChunk = ''
        
        for (const sentence of sentences) {
          const trimmedSentence = sentence.trim()
          if (!trimmedSentence) continue
          
          if (currentChunk.length + trimmedSentence.length + 2 <= maxChunkSize) {
            currentChunk += (currentChunk ? '. ' : '') + trimmedSentence
          } else {
            if (currentChunk) {
              chunks.push(currentChunk + '.')
            }
            currentChunk = trimmedSentence
          }
        }
        
        if (currentChunk) {
          chunks.push(currentChunk + '.')
        }
      }
    }
    
    return chunks.filter(chunk => chunk.trim().length > 0)
  }

  async getCollectionStats(): Promise<{
    count: number
    metadata: any
  }> {
    await this.initialize()
    
    if (!this.collection) {
      throw new Error('ChromaDB集合未初始化')
    }

    try {
      const count = await this.collection.count()
      return {
        count,
        metadata: {
          name: this.collectionName,
          lastUpdated: new Date().toISOString()
        }
      }
    } catch (error) {
      console.error('❌ 获取集合统计信息失败:', error)
      throw new Error(`获取集合统计信息失败: ${error}`)
    }
  }

  async deleteNoteChunks(noteId: string): Promise<void> {
    await this.initialize()
    
    if (!this.collection) {
      throw new Error('ChromaDB集合未初始化')
    }

    try {
      console.log(`🗑️  删除笔记块: ${noteId}`)
      
      // 查找所有属于这个笔记的块
      const results = await this.collection.get({
        where: { noteId: noteId }
      })
      
      if (results.ids && results.ids.length > 0) {
        await this.collection.delete({
          ids: results.ids
        })
        console.log(`✅ 已删除 ${results.ids.length} 个文档块`)
      } else {
        console.log('⚠️  未找到要删除的文档块')
      }
    } catch (error) {
      console.error('❌ 删除笔记块失败:', error)
      throw new Error(`删除笔记块失败: ${error}`)
    }
  }

  async clearCollection(): Promise<void> {
    await this.initialize()
    
    if (!this.collection) {
      throw new Error('ChromaDB集合未初始化')
    }

    try {
      console.log('🗑️  清空向量数据库...')
      
      // 删除现有集合
      await this.client.deleteCollection({ name: this.collectionName })
      
      // 重新创建集合
      this.collection = await this.client.createCollection({
        name: this.collectionName,
        embeddingFunction: this.embeddingFunction,
        metadata: {
          description: 'OneNote文档向量存储',
          created_at: new Date().toISOString()
        }
      })
      
      console.log('✅ 向量数据库已清空')
    } catch (error) {
      console.error('❌ 清空向量数据库失败:', error)
      throw new Error(`清空向量数据库失败: ${error}`)
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      if (!this.initialized) {
        await this.initialize()
      }
      
      // 简单的健康检查：尝试获取集合计数
      if (this.collection) {
        await this.collection.count()
        return true
      }
      return false
    } catch (error) {
      console.error('❌ ChromaDB健康检查失败:', error)
      return false
    }
  }
} 