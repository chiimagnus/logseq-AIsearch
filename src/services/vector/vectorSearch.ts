// 向量搜索服务

import { VectorSearchResult } from '../../types/vector';
import { generateEmbedding } from './embeddingService';
import { getCachedVectorData, loadVectorData } from './vectorStorage';

// 余弦相似度计算
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error('向量维度不匹配');
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  if (normA === 0 || normB === 0) {
    return 0;
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// 🚀 优化：主要搜索函数 - 使用内存缓存
export async function search(queryText: string, limit: number = 50): Promise<VectorSearchResult[] | null> {
  try {
    console.log(`🔍 开始搜索: "${queryText}"`);
    
    // 生成查询向量
    const queryVector = await generateEmbedding(queryText);
    
    // 🚀 优先使用缓存数据
    let vectorData = getCachedVectorData();
    
    if (!vectorData) {
      console.log("📦 缓存为空，从存储加载数据...");
      vectorData = await loadVectorData();
      
      if (vectorData.length === 0) {
        logseq.UI.showMsg("向量数据为空，请先建立索引", "warning");
        return [];
      }
    } else {
      console.log(`✅ 使用缓存数据进行搜索 (${vectorData.length} 条记录)`);
    }
    
    // 计算相似度并排序
    const results = vectorData.map(item => ({
      blockUUID: item.blockUUID,
      pageName: item.pageName,
      blockContent: item.blockContent,
      score: cosineSimilarity(queryVector, item.vector)
    }))
    .filter(item => item.score > 0.3)  // 过滤掉相似度太低的结果
    .sort((a, b) => b.score - a.score)  // 按相似度降序排列
    .slice(0, limit);  // 取前 limit 个结果

    console.log(`🎯 搜索完成，找到 ${results.length} 个相关结果`);
    return results;

  } catch (error) {
    console.error("❌ 搜索失败:", error);
    logseq.UI.showMsg("搜索失败，请检查控制台日志。", "error");
    return null;
  }
} 