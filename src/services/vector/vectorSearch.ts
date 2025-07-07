// 向量搜索服务

import { VectorSearchResult } from '../../types/vector';
import { generateEmbedding } from './embeddingService';
import { getCachedVectorData, loadVectorData } from './vectorStorage';
import { getAllBlocksWithPage } from '../../tools/contentProcessor';

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

// 🚀 优化：主要搜索函数 - 使用内存缓存 + 动态增量索引
export async function search(queryText: string, limit: number = 50): Promise<VectorSearchResult[] | null> {
  try {
    console.log(`🔍 开始搜索: "${queryText}"`);

    // 🚀 动态增量索引：检测并处理新增内容
    await performIncrementalIndexingIfNeeded();

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

// 🚀 动态增量索引：检测并处理新增内容
async function performIncrementalIndexingIfNeeded(): Promise<void> {
  try {
    // 获取当前所有blocks
    const allBlocks = await getAllBlocksWithPage();
    if (!allBlocks || allBlocks.length === 0) {
      return;
    }

    // 获取已索引的数据
    const existingVectorData = await loadVectorData();
    if (existingVectorData.length === 0) {
      // 如果没有任何索引数据，跳过增量索引
      console.log("📭 未检测到向量数据，跳过增量索引");
      return;
    }

    // 🚀 智能检测blocks变化（新增、修改、删除）
    const { analyzeBlockChanges } = await import('./vectorIndexing');
    const { newBlocks, modifiedBlocks, deletedBlocks } = await analyzeBlockChanges(allBlocks, existingVectorData);

    const totalChanges = newBlocks.length + modifiedBlocks.length + deletedBlocks.length;

    if (totalChanges === 0) {
      console.log("✅ 所有内容都已索引且无变化，无需增量更新");
      return;
    }

    console.log(`🔄 检测到变化: 新增${newBlocks.length}个, 修改${modifiedBlocks.length}个, 删除${deletedBlocks.length}个，开始静默增量索引...`);

    // 静默执行增量索引，不显示进度消息
    const { silentIncrementalIndexing } = await import('./vectorIndexing');
    await silentIncrementalIndexing();

    console.log(`✅ 增量索引完成，新增 ${newBlocks.length} 个向量`);

  } catch (error) {
    console.warn("⚠️ 增量索引检测失败:", error);
    // 增量索引失败不影响搜索功能
  }
}