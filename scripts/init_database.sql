-- PostgreSQL + pgvector 数据库初始化脚本
-- 用于RAG Agent项目的向量存储

-- 创建pgvector扩展（如果不存在）
-- 注意：需要数据库超级用户权限或事先在数据库中安装pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- 创建文档向量存储表
CREATE TABLE IF NOT EXISTS onenote_documents (
    id VARCHAR(255) PRIMARY KEY,
    content TEXT NOT NULL,
    embedding vector(1536), -- 本地嵌入函数输出维度为1536
    metadata JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 创建向量相似性搜索索引
-- 使用IVFFlat索引进行近似最近邻搜索
CREATE INDEX IF NOT EXISTS onenote_documents_embedding_idx 
ON onenote_documents USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- 创建元数据搜索索引
-- 支持对JSON元数据的快速查询
CREATE INDEX IF NOT EXISTS onenote_documents_metadata_idx 
ON onenote_documents USING gin (metadata);

-- 创建时间索引用于数据管理
CREATE INDEX IF NOT EXISTS onenote_documents_created_at_idx 
ON onenote_documents (created_at);

CREATE INDEX IF NOT EXISTS onenote_documents_updated_at_idx 
ON onenote_documents (updated_at);

-- 创建更新时间触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 创建更新时间触发器
DROP TRIGGER IF EXISTS update_onenote_documents_updated_at ON onenote_documents;
CREATE TRIGGER update_onenote_documents_updated_at 
BEFORE UPDATE ON onenote_documents 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 创建一些有用的视图和函数

-- 统计视图：显示数据库中的文档数量和最后更新时间
CREATE OR REPLACE VIEW document_stats AS
SELECT 
    COUNT(*) as total_documents,
    COUNT(CASE WHEN embedding IS NOT NULL THEN 1 END) as documents_with_embeddings,
    MAX(updated_at) as last_updated,
    MIN(created_at) as first_created,
    AVG(LENGTH(content)) as avg_content_length
FROM onenote_documents;

-- 按文件类型统计的视图
CREATE OR REPLACE VIEW documents_by_type AS
SELECT 
    metadata->>'fileType' as file_type,
    COUNT(*) as count,
    AVG(LENGTH(content)) as avg_content_length
FROM onenote_documents
WHERE metadata->>'fileType' IS NOT NULL
GROUP BY metadata->>'fileType'
ORDER BY count DESC;

-- 按笔记本统计的视图
CREATE OR REPLACE VIEW documents_by_notebook AS
SELECT 
    metadata->>'notebookName' as notebook_name,
    COUNT(*) as count,
    MAX(updated_at) as last_updated
FROM onenote_documents
WHERE metadata->>'notebookName' IS NOT NULL
GROUP BY metadata->>'notebookName'
ORDER BY count DESC;

-- 相似度搜索函数（示例）
CREATE OR REPLACE FUNCTION search_similar_documents(
    query_embedding vector(1536),
    similarity_threshold float DEFAULT 0.7,
    result_limit int DEFAULT 10
)
RETURNS TABLE(
    id varchar(255),
    content text,
    similarity float,
    metadata jsonb
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        d.id,
        d.content,
        1 - (d.embedding <=> query_embedding) as similarity,
        d.metadata
    FROM onenote_documents d
    WHERE d.embedding IS NOT NULL
        AND 1 - (d.embedding <=> query_embedding) >= similarity_threshold
    ORDER BY d.embedding <=> query_embedding
    LIMIT result_limit;
END;
$$ LANGUAGE plpgsql;

-- 清理旧文档的函数
CREATE OR REPLACE FUNCTION cleanup_old_documents(days_old int DEFAULT 30)
RETURNS int AS $$
DECLARE
    deleted_count int;
BEGIN
    DELETE FROM onenote_documents 
    WHERE updated_at < CURRENT_TIMESTAMP - (days_old || ' days')::interval;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 插入测试数据（可选）
-- INSERT INTO onenote_documents (id, content, metadata) VALUES
-- ('test_1', '这是一个测试文档', '{"title": "测试文档", "fileType": "txt", "notebookName": "测试笔记本"}'),
-- ('test_2', '这是另一个测试文档', '{"title": "测试文档2", "fileType": "md", "notebookName": "测试笔记本"}');

-- 授权（根据实际需要调整）
-- GRANT SELECT, INSERT, UPDATE, DELETE ON onenote_documents TO your_app_user;
-- GRANT USAGE ON SCHEMA public TO your_app_user;

-- 显示初始化完成信息
DO $$
BEGIN
    RAISE NOTICE '数据库初始化完成！';
    RAISE NOTICE '- 表 onenote_documents 已创建';
    RAISE NOTICE '- 向量索引已创建';
    RAISE NOTICE '- 统计视图已创建';
    RAISE NOTICE '- 辅助函数已创建';
END $$; 