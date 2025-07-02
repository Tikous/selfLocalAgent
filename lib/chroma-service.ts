import { ChromaClient, Collection, OpenAIEmbeddingFunction } from 'chromadb'

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

export class ChromaService {
  private client: ChromaClient
  private collection: Collection | null = null
  private embeddingFunction: OpenAIEmbeddingFunction
  private collectionName: string

  constructor() {
    const chromaHost = process.env.CHROMA_HOST || 'localhost'
    const chromaPort = process.env.CHROMA_PORT || '8000'
    this.collectionName = process.env.CHROMA_COLLECTION_NAME || 'onenote_documents'

    // 修复ChromaDB客户端配置
    this.client = new ChromaClient({
      path: `http://${chromaHost}:${chromaPort}`
    })

    // 确保DeepSeek API密钥存在
    const deepseekKey = process.env.DEEPSEEK_API_KEY
    if (!deepseekKey || deepseekKey === 'your_deepseek_api_key_here') {
      throw new Error('DEEPSEEK_API_KEY未设置或使用默认值')
    }

    this.embeddingFunction = new OpenAIEmbeddingFunction({
      openai_api_key: deepseekKey,
      openai_model: 'text-embedding-ada-002'
    })
  }

  async initialize(): Promise<void> {
    try {
      console.log('🔌 连接到ChromaDB服务器...')
      
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

      console.log('✅ ChromaDB服务初始化完成')
    } catch (error) {
      console.error('❌ ChromaDB初始化失败:', error)
      throw new Error(`ChromaDB初始化失败: ${error}`)
    }
  }

  async addNotes(notes: OneNoteNote[]): Promise<void> {
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
    if (!this.collection) {
      throw new Error('ChromaDB集合未初始化')
    }

    try {
      const results = await this.collection.query({
        queryTexts: [query],
        nResults: limit
      })

      return {
        documents: (results.documents[0] || []).filter((doc): doc is string => doc !== null),
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
    
    return chunks.filter(chunk => chunk.length > 10)
  }

  async getCollectionStats(): Promise<{
    count: number
    metadata: any
  }> {
    if (!this.collection) {
      throw new Error('ChromaDB集合未初始化')
    }

    try {
      const count = await this.collection.count()
      
      return {
        count,
        metadata: {
          name: this.collectionName,
          created_at: new Date().toISOString(),
          service: 'ChromaService'
        }
      }
    } catch (error) {
      console.error('获取集合统计失败:', error)
      throw error
    }
  }

  async updateNote(note: OneNoteNote): Promise<void> {
    // 删除旧的文档块
    await this.deleteNoteChunks(note.id)
    // 添加新的
    await this.addNotes([note])
  }

  async deleteNoteChunks(noteId: string): Promise<void> {
    if (!this.collection) {
      throw new Error('ChromaDB集合未初始化')
    }

    try {
      // 获取所有相关的文档ID
      const results = await this.collection.get({
        where: { noteId: { "$eq": noteId } }
      })

      if (results.ids && results.ids.length > 0) {
        await this.collection.delete({
          ids: results.ids
        })
        console.log(`✅ 已删除笔记 ${noteId} 的 ${results.ids.length} 个文档块`)
      }
    } catch (error) {
      console.error(`❌ 删除笔记块失败 ${noteId}:`, error)
      throw error
    }
  }

  async clearCollection(): Promise<void> {
    if (!this.collection) {
      throw new Error('ChromaDB集合未初始化')
    }

    try {
      await this.client.deleteCollection({
        name: this.collectionName
      })
      
      // 重新创建集合
      this.collection = await this.client.createCollection({
        name: this.collectionName,
        embeddingFunction: this.embeddingFunction,
        metadata: {
          description: 'OneNote文档向量存储',
          created_at: new Date().toISOString()
        }
      })
      
      console.log('✅ 集合已清空并重新创建')
    } catch (error) {
      console.error('❌ 清空集合失败:', error)
      throw error
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.client.heartbeat()
      return true
    } catch (error) {
      console.error('ChromaDB健康检查失败:', error)
      return false
    }
  }
} 