// ChromaDB兼容的本地嵌入函数
export class LocalChromaEmbeddingFunction {
  private modelName: string

  constructor(options?: {
    model?: string
  }) {
    this.modelName = options?.model || 'local-embedding'
    console.log('🔧 使用本地ChromaDB嵌入函数 (避免网络连接)')
  }

  async generate(texts: string[]): Promise<number[][]> {
    try {
      console.log(`🔄 正在为 ${texts.length} 个文本生成本地嵌入向量...`)
      
      const embeddings: number[][] = []
      
      for (const text of texts) {
        const embedding = this.generateSimpleEmbedding(text)
        embeddings.push(embedding)
      }
      
      console.log(`✅ 成功生成 ${embeddings.length} 个本地嵌入向量`)
      return embeddings
    } catch (error) {
      console.error('❌ 本地嵌入生成失败:', error)
      throw new Error(`嵌入生成失败: ${error}`)
    }
  }

  private generateSimpleEmbedding(text: string): number[] {
    // 简化的嵌入算法 - 基于文本特征
    const dimension = 1536 // 与OpenAI兼容的维度
    const embedding = new Array(dimension).fill(0)
    
    // 基于文本内容生成特征
    const words = text.toLowerCase().split(/\s+/)
    const chars = text.split('')
    
    // 特征1: 文本长度
    embedding[0] = Math.tanh(text.length / 1000)
    
    // 特征2-10: 字符频率
    for (let i = 0; i < 9; i++) {
      const char = String.fromCharCode(97 + i) // a-i
      const freq = chars.filter(c => c === char).length / chars.length
      embedding[i + 1] = freq
    }
    
    // 特征11-100: 词汇特征
    for (let i = 0; i < 90; i++) {
      const word = words[i % words.length] || ''
      let hash = 0
      for (let j = 0; j < word.length; j++) {
        hash = ((hash << 5) - hash + word.charCodeAt(j)) & 0xffffffff
      }
      embedding[i + 10] = Math.tanh(hash / 1000000000)
    }
    
    // 特征101-1536: 基于文本内容的伪随机特征
    for (let i = 100; i < dimension; i++) {
      let hash = 0
      const segment = text.slice((i - 100) % text.length, ((i - 100) % text.length) + 10)
      for (let j = 0; j < segment.length; j++) {
        hash = ((hash << 5) - hash + segment.charCodeAt(j) + i) & 0xffffffff
      }
      embedding[i] = Math.tanh(hash / 2147483647) // 归一化到 [-1, 1]
    }
    
    // 归一化向量
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0))
    return embedding.map(val => val / (magnitude || 1))
  }
} 