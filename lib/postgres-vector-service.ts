import { Pool } from 'pg'
import { LocalEmbeddingFunction } from './local-embedding'
import { OneNoteNote } from '@/lib/local-onenote'

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

export class PostgresVectorService {
  private writePool: Pool | null = null
  private readPool: Pool | null = null
  private embeddingFunction: LocalEmbeddingFunction | null = null
  private tableName: string
  private initialized: boolean = false

  constructor() {
    this.tableName = process.env.POSTGRES_COLLECTION_NAME || 'onenote_documents'
  }

  async initialize(): Promise<void> {
    if (this.initialized) return

    try {
      console.log('🔌 初始化PostgreSQL向量数据库服务...')
      
      // 创建写入连接池
      this.writePool = new Pool({
        host: process.env.POSTGRES_WRITE_HOST,
        port: parseInt(process.env.POSTGRES_PORT || '5432'),
        database: process.env.POSTGRES_DATABASE,
        user: process.env.POSTGRES_USER,
        password: process.env.POSTGRES_PASSWORD,
        max: parseInt(process.env.POSTGRES_MAX_CONNECTIONS || '10'),
        min: parseInt(process.env.POSTGRES_MIN_CONNECTIONS || '2'),
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
      })

      // 创建读取连接池
      this.readPool = new Pool({
        host: process.env.POSTGRES_READ_HOST,
        port: parseInt(process.env.POSTGRES_PORT || '5432'),
        database: process.env.POSTGRES_DATABASE,
        user: process.env.POSTGRES_USER,
        password: process.env.POSTGRES_PASSWORD,
        max: parseInt(process.env.POSTGRES_MAX_CONNECTIONS || '10'),
        min: parseInt(process.env.POSTGRES_MIN_CONNECTIONS || '2'),
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
      })

      // 测试连接
      await this.writePool.query('SELECT 1')
      await this.readPool.query('SELECT 1')
      console.log('✅ PostgreSQL连接测试成功')

      // 初始化嵌入函数
      console.log('🔧 使用本地嵌入函数')
      this.embeddingFunction = new LocalEmbeddingFunction({
        model: 'local-text-embedding'
      })

      // 确保表和扩展存在
      await this.ensureTableExists()

      this.initialized = true
      console.log('✅ PostgreSQL向量数据库服务初始化完成')
    } catch (error) {
      console.error('❌ PostgreSQL初始化失败:', error)
      throw new Error(`PostgreSQL初始化失败: ${error}`)
    }
  }

  private async ensureTableExists(): Promise<void> {
    if (!this.writePool) throw new Error('写入连接池未初始化')

    try {
      // 创建pgvector扩展（如果不存在）
      await this.writePool.query('CREATE EXTENSION IF NOT EXISTS vector;')
      
      // 创建表（如果不存在）
      const createTableQuery = `
        CREATE TABLE IF NOT EXISTS ${this.tableName} (
          id VARCHAR(255) PRIMARY KEY,
          content TEXT NOT NULL,
                     embedding vector(1536), -- 本地嵌入维度为1536
          metadata JSONB NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        
        -- 创建向量相似性搜索索引
        CREATE INDEX IF NOT EXISTS ${this.tableName}_embedding_idx 
        ON ${this.tableName} USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100);
        
        -- 创建元数据搜索索引
        CREATE INDEX IF NOT EXISTS ${this.tableName}_metadata_idx 
        ON ${this.tableName} USING gin (metadata);
        
        -- 创建更新时间触发器函数
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = CURRENT_TIMESTAMP;
          RETURN NEW;
        END;
        $$ language 'plpgsql';
        
        -- 创建更新时间触发器
        DROP TRIGGER IF EXISTS update_${this.tableName}_updated_at ON ${this.tableName};
        CREATE TRIGGER update_${this.tableName}_updated_at 
        BEFORE UPDATE ON ${this.tableName} 
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
      `
      
      await this.writePool.query(createTableQuery)
      console.log(`✅ 表 ${this.tableName} 创建/验证成功`)
    } catch (error) {
      console.error('❌ 创建表失败:', error)
      throw error
    }
  }

  async addNotes(notes: OneNoteNote[]): Promise<void> {
    await this.initialize()
    
    if (!this.writePool) throw new Error('写入连接池未初始化')

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

    // 生成嵌入向量并批量插入
    console.log(`🔄 添加 ${chunks.length} 个文档块到向量数据库...`)
    
    const batchSize = parseInt(process.env.EMBEDDING_BATCH_SIZE || '50')
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize)
      
      try {
        // 生成嵌入向量
        const embeddings = await this.embeddingFunction.generate(
          batch.map(chunk => chunk.content)
        )
        
        // 准备插入数据
        const insertQuery = `
          INSERT INTO ${this.tableName} (id, content, embedding, metadata)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (id) DO UPDATE SET
            content = EXCLUDED.content,
            embedding = EXCLUDED.embedding,
            metadata = EXCLUDED.metadata,
            updated_at = CURRENT_TIMESTAMP
        `
        
        // 批量插入
        for (let j = 0; j < batch.length; j++) {
          const chunk = batch[j]
          const embedding = embeddings[j]
          
          await this.writePool.query(insertQuery, [
            chunk.id,
            chunk.content,
            `[${embedding.join(',')}]`, // PostgreSQL向量格式
            JSON.stringify(chunk.metadata)
          ])
        }
        
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
    
    if (!this.readPool) throw new Error('读取连接池未初始化')

    try {
      console.log(`🔍 开始向量搜索: "${query}"`)
      
      // 生成查询向量
      const queryEmbedding = await this.embeddingFunction.generate([query])
      const queryVector = `[${queryEmbedding[0].join(',')}]`
      
      console.log(`📊 查询向量维度: ${queryEmbedding[0].length}`)
      
      // 首先检查表中是否有数据
      const countQuery = `SELECT COUNT(*) as total FROM ${this.tableName} WHERE embedding IS NOT NULL`
      const countResult = await this.readPool.query(countQuery)
      console.log(`📊 表 ${this.tableName} 中有 ${countResult.rows[0].total} 个文档包含向量`)
      
      // 先测试简单查询，不做向量计算
      const simpleQuery = `
        SELECT 
          content,
          metadata
        FROM ${this.tableName}
        WHERE embedding IS NOT NULL
        LIMIT $1
      `
      
      console.log(`🧪 测试简单查询（不做向量计算）`)
      const simpleResult = await this.readPool.query(simpleQuery, [limit])
      console.log(`📋 简单查询找到 ${simpleResult.rows.length} 个结果`)
      
      if (simpleResult.rows.length === 0) {
        // 如果连简单查询都没结果，直接返回
        return { documents: [], metadatas: [], distances: [] }
      }
      
      // 暂时返回所有文档，先确保基本功能正常
      console.log(`🔧 暂时跳过向量相似性计算，返回所有文档`)
      
      const documents = simpleResult.rows.map(row => row.content)
      const metadatas = simpleResult.rows.map(row => row.metadata)
      const distances = simpleResult.rows.map(() => 0.5) // 使用默认距离
      
      console.log(`📋 返回 ${documents.length} 个文档`)
      return { documents, metadatas, distances }
    } catch (error) {
      console.error('❌ 向量搜索失败:', error)
      throw new Error(`向量搜索失败: ${error}`)
    }
  }

  private chunkText(text: string, maxChunkSize: number): string[] {
    const chunks: string[] = []
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0)
    
    let currentChunk = ''
    
    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim()
      if (currentChunk.length + trimmedSentence.length + 1 <= maxChunkSize) {
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
    
    return chunks.length > 0 ? chunks : [text]
  }

  async getCollectionStats(): Promise<{
    count: number
    metadata: any
  }> {
    await this.initialize()
    
    if (!this.readPool) throw new Error('读取连接池未初始化')

    try {
      const countQuery = `SELECT COUNT(*) as count FROM ${this.tableName}`
      const result = await this.readPool.query(countQuery)
      
      return {
        count: parseInt(result.rows[0].count),
        metadata: {
          name: this.tableName,
          lastUpdated: new Date().toISOString(),
          type: 'postgresql_vector'
        }
      }
    } catch (error) {
      console.error('❌ 获取集合统计信息失败:', error)
      throw new Error(`获取集合统计信息失败: ${error}`)
    }
  }

  async clearCollection(): Promise<void> {
    await this.initialize()
    
    if (!this.writePool) throw new Error('写入连接池未初始化')

    try {
      console.log('🗑️  清空向量数据库...')
      await this.writePool.query(`DELETE FROM ${this.tableName}`)
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
      
      // 检查读写连接池
      if (this.writePool && this.readPool) {
        await this.writePool.query('SELECT 1')
        await this.readPool.query('SELECT 1')
        return true
      }
      return false
    } catch (error) {
      console.error('❌ PostgreSQL健康检查失败:', error)
      return false
    }
  }

  async close(): Promise<void> {
    if (this.writePool) {
      await this.writePool.end()
      this.writePool = null
    }
    if (this.readPool) {
      await this.readPool.end()
      this.readPool = null
    }
    this.initialized = false
    console.log('✅ PostgreSQL连接池已关闭')
  }
} 