// 相关性分数计算服务模块
// 这个文件的主要功能是评估搜索内容与查询的相关性，并计算相关性分数
// 包含两个主要函数：
// 1. evaluateRelevance - 评估单个内容块与查询的相关性分数
// 2. batchEvaluateRelevance - 批量处理多个搜索结果，计算相关性分数并过滤低分结果

import { SearchResult } from '../types/search';
import { generateResponse } from './apiService';
import { getRelevanceEvaluationPrompt } from '../prompts/relevanceEvaluation';

// 评估单个内容块与查询的相关性
async function evaluateRelevance(query: string, content: string): Promise<number> {
  const prompt = getRelevanceEvaluationPrompt(query, content);
  
  const response = await generateResponse(prompt);
  const score = parseFloat(response) || 0;
  
  return score;
}

// 批量评估搜索结果相关性
//  批量处理说明：
//  1. 批处理方式：系统会将搜索结果分成多个批次（默认每批10条）
//  2. 处理机制：每个批次中的内容会并行处理（同时发起多个AI请求）
//  3. 处理单位：每条内容都是单独发送给AI评估的（不是合并处理）
//  4. 并发控制：通过Promise.all实现并行处理，但受限于API的速率限制
//  例如：有30条结果，批大小=10 → 会分3批处理
//  每批中的10条会同时发起10个独立的AI请求
//  每个请求只包含1条内容和查询的相关性评估

export async function batchEvaluateRelevance(query: string, results: SearchResult[]): Promise<SearchResult[]> {
  const batchSize: number = typeof logseq.settings?.batchSize === 'number' 
    ? logseq.settings.batchSize 
    : 10; // 默认批处理大小为10
  
  const refinedResults: SearchResult[] = [];
  const totalBatches = Math.ceil(results.length / batchSize);
  const minScore: number = typeof logseq.settings?.minScore === 'number' 
    ? logseq.settings.minScore 
    : 5.0; // 默认最低分数为5.0

  for (let i = 0; i < results.length; i += batchSize) {
    const batch = results.slice(i, i + batchSize);
    const currentBatch = i / batchSize + 1;
    
    // 显示处理进度
    await logseq.UI.showMsg(`正在分析第 ${currentBatch}/${totalBatches} 批内容... | Analyzing batch ${currentBatch}/${totalBatches}...`, 'info');
    
    const batchStartTime = Date.now();
    
    // 并行处理当前批次
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

  // 按分数降序返回结果
  return refinedResults.sort((a, b) => b.score - a.score);
} 