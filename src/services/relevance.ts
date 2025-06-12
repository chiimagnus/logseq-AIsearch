// 相关性分数计算服务模块

import { SearchResult } from '../types/search';
import { generateResponse } from './apiService';
import { getRelevanceEvaluationPrompt } from '../prompts/relevanceEvaluation';


// 单个内容的相关性评估
async function evaluateRelevance(query: string, content: string): Promise<number> {
  const prompt = getRelevanceEvaluationPrompt(query, content);
  
  const response = await generateResponse(prompt);
  const score = parseFloat(response) || 0;
  
  return score;
}

// 批处理与相关性评估
export async function batchEvaluateRelevance(query: string, results: SearchResult[]): Promise<SearchResult[]> {
  const batchSize: number = typeof logseq.settings?.batchSize === 'number' 
    ? logseq.settings.batchSize 
    : 10; // 默认值为10
  
  const refinedResults: SearchResult[] = [];
  const totalBatches = Math.ceil(results.length / batchSize);
  const minScore: number = typeof logseq.settings?.minScore === 'number' 
    ? logseq.settings.minScore 
    : 5.0;

  for (let i = 0; i < results.length; i += batchSize) {
    const batch = results.slice(i, i + batchSize);
    const currentBatch = i / batchSize + 1;
    
    // 更新进度提示
    await logseq.UI.showMsg(`正在分析第 ${currentBatch}/${totalBatches} 批内容... | Analyzing batch ${currentBatch}/${totalBatches}...`, 'info');
    
    const batchStartTime = Date.now();
    
    // 并行处理每个批次
    const batchPromises = batch.map(async (result) => {
      const relevanceScore = await evaluateRelevance(query, result.block.content);
      if (relevanceScore > minScore) {
        return {
          ...result,
          score: relevanceScore
        };
      }
      return null;
    });

    const batchResults = await Promise.all(batchPromises);
    const validResults = batchResults.filter((r): r is SearchResult => r !== null);
    refinedResults.push(...validResults);
    
    const batchEndTime = Date.now();
    const batchDuration = batchEndTime - batchStartTime;
    
    console.log(`⚡ [批处理] 第${currentBatch}批处理完成，耗时: ${batchDuration}ms，有效结果: ${validResults.length}个`);
  }

  return refinedResults.sort((a, b) => b.score - a.score);
} 