import ChatInterface from '@/components/ChatInterface'

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            本地OneNote RAG Agent
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            基于您的本地OneNote文件构建的智能对话助手，支持Word、PDF、文本等格式
          </p>
          <div className="mt-4 text-sm text-gray-500">
            <p>支持格式: .docx, .pdf, .txt, .html, .md</p>
            <p>请将导出的OneNote文件放入 <code className="bg-gray-200 px-2 py-1 rounded">./data/onenote</code> 目录</p>
          </div>
        </div>
        
        <div className="max-w-4xl mx-auto">
          <ChatInterface />
        </div>
        
        <div className="max-w-4xl mx-auto mt-8 text-center">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold mb-4">快速开始</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="p-4 bg-blue-50 rounded-lg">
                <h4 className="font-medium mb-2">1. 准备文件</h4>
                <p>将OneNote导出为Word、PDF或其他支持格式</p>
              </div>
              <div className="p-4 bg-green-50 rounded-lg">
                <h4 className="font-medium mb-2">2. 上传文件</h4>
                <p>将文件放入data/onenote目录或使用上传功能</p>
              </div>
              <div className="p-4 bg-purple-50 rounded-lg">
                <h4 className="font-medium mb-2">3. 开始对话</h4>
                <p>索引完成后即可开始智能问答</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
} 