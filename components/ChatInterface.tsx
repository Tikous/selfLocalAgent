'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Loader2, Upload, File, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react'

interface Source {
  title: string
  notebookName: string
  sectionName: string
  confidence: number
  content: string
  filePath?: string
  fileType?: string
}

interface Message {
  id: string
  content: string
  role: 'user' | 'assistant'
  timestamp: Date
  sources?: Source[]
  confidence?: number
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isReindexing, setIsReindexing] = useState(false)
  const [systemStatus, setSystemStatus] = useState<any>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    // 获取系统状态
    fetchSystemStatus()
  }, [])

  const fetchSystemStatus = async () => {
    try {
      const response = await fetch('/api/chat')
      if (response.ok) {
        const data = await response.json()
        setSystemStatus(data)
      }
    } catch (error) {
      console.error('获取系统状态失败:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      content: input,
      role: 'user',
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          message: input,
          context: {
            sessionId: 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
          }
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to send message')
      }

      const data = await response.json()

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: data.message,
        role: 'assistant',
        timestamp: new Date(),
        sources: data.sources,
        confidence: data.confidence,
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      console.error('Error sending message:', error)
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: error instanceof Error ? error.message : '抱歉，发生了错误。请稍后重试。',
        role: 'assistant',
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsUploading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Upload failed')
      }

      const data = await response.json()
      
      // 添加系统消息
      const systemMessage: Message = {
        id: Date.now().toString(),
        content: `✅ ${data.message}`,
        role: 'assistant',
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, systemMessage])

      // 更新系统状态
      await fetchSystemStatus()

    } catch (error) {
      console.error('File upload error:', error)
      const errorMessage: Message = {
        id: Date.now().toString(),
        content: `❌ 文件上传失败: ${error instanceof Error ? error.message : '未知错误'}`,
        role: 'assistant',
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleReindex = async () => {
    setIsReindexing(true)

    try {
      const response = await fetch('/api/reindex', {
        method: 'POST',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Reindex failed')
      }

      const data = await response.json()
      
      // 添加系统消息
      const systemMessage: Message = {
        id: Date.now().toString(),
        content: `✅ ${data.message}`,
        role: 'assistant',
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, systemMessage])

      // 更新系统状态
      await fetchSystemStatus()

    } catch (error) {
      console.error('Reindex error:', error)
      const errorMessage: Message = {
        id: Date.now().toString(),
        content: `❌ 重新索引失败: ${error instanceof Error ? error.message : '未知错误'}`,
        role: 'assistant',
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsReindexing(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-xl overflow-hidden">
      {/* 系统状态栏 */}
      {systemStatus && (
        <div className="bg-gray-50 px-4 py-2 border-b">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-1">
                {systemStatus.health?.chroma ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-500" />
                )}
                <span>ChromaDB</span>
              </div>
              <div className="flex items-center space-x-1">
                {systemStatus.health?.openai ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-500" />
                )}
                <span>OpenAI</span>
              </div>
              <div className="text-gray-600">
                文档: {systemStatus.stats?.totalChunks || 0} 块
              </div>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={handleReindex}
                disabled={isReindexing}
                className="flex items-center space-x-1 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${isReindexing ? 'animate-spin' : ''}`} />
                <span>重新索引</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 聊天消息区域 */}
      <div className="h-96 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <Bot className="w-12 h-12 mx-auto mb-4 text-blue-500" />
              <p>您好！我是您的OneNote智能助手。</p>
              <p>请问有什么可以帮您的吗？</p>
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`flex max-w-xs lg:max-w-md xl:max-w-lg ${
                  message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                }`}
              >
                <div
                  className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    message.role === 'user'
                      ? 'bg-blue-500 text-white ml-2'
                      : 'bg-gray-200 text-gray-600 mr-2'
                  }`}
                >
                  {message.role === 'user' ? (
                    <User className="w-4 h-4" />
                  ) : (
                    <Bot className="w-4 h-4" />
                  )}
                </div>
                <div
                  className={`px-4 py-2 rounded-lg ${
                    message.role === 'user'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  
                  {/* 置信度显示 */}
                  {message.confidence !== undefined && message.role === 'assistant' && (
                    <div className="mt-2 text-xs text-gray-600">
                      置信度: {(message.confidence * 100).toFixed(1)}%
                    </div>
                  )}
                  
                  {/* 来源信息 */}
                  {message.sources && message.sources.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-300">
                      <p className="text-xs text-gray-600 mb-1">参考来源:</p>
                      {message.sources.map((source, index) => (
                        <div key={index} className="text-xs mb-1">
                          <div className="flex items-center space-x-1">
                            <File className="w-3 h-3" />
                            <span className="font-medium text-blue-600">{source.title}</span>
                            <span className="text-gray-500">
                              ({(source.confidence * 100).toFixed(1)}%)
                            </span>
                          </div>
                          <p className="text-gray-600 ml-4">{source.content}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex justify-start">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                <Bot className="w-4 h-4 text-gray-600" />
              </div>
              <div className="bg-gray-100 px-4 py-2 rounded-lg">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 输入区域 */}
      <div className="border-t bg-gray-50 p-4">
        <form onSubmit={handleSubmit} className="flex space-x-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="请输入您的问题..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isLoading}
          />
          
          {/* 文件上传按钮 */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".docx,.pdf,.txt,.html,.md"
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="px-3 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUploading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
          </button>
          
          {/* 发送按钮 */}
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  )
}