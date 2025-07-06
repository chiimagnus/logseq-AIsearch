// 搜索编排器 - AI Agent 核心决策层

import { SearchResponse } from '../../types/search';
import { timeAwareSearch } from '../../tools/search/searchTools';
import { generateResponse } from '../ai/apiService';
import { getSummaryPrompt } from '../../prompts/summaryGeneration';

// AI 搜索的核心编排逻辑
export async function aiSearch(query: string): Promise<{
  results: SearchResponse['results'];
  generateSummary: () => Promise<string>;
}> {
  try {
    console.log("🧠 [Agent决策层] 开始分析用户输入:", query);
    
    // === 决策阶段1: 策略选择与执行 ===
    console.log("🧠 [决策1] 选择向量搜索策略...");
    const searchResults = await timeAwareSearch(query);
    
    if (searchResults.length === 0) {
      console.log("❌ [决策1] 搜索无结果，终止流程");
      return {
        results: [],
        generateSummary: async () => ""
      };
    }
    
    console.log("✅ [决策1] 搜索完成，获得", searchResults.length, "个初步结果");

    // 向量搜索结果已按相关性排序，直接使用
    const refinedResults = searchResults;
    
    // === 创建AI总结生成函数（异步执行） ===
    const generateSummary = async (): Promise<string> => {
      // 总结功能默认开启
      if (refinedResults.length === 0) {
        return "";
      }
      
      console.log("🧠 [决策2] 启动AI总结生成...");
      await logseq.UI.showMsg("正在总结... | Summarizing...", 'info');
      
      const formattedResults = refinedResults
        .map((result) => result.block.content)
        .join('\n');
      
      const summaryPrompt = getSummaryPrompt(query, formattedResults);
      
      const summary = await generateResponse(summaryPrompt);
      console.log("✅ [决策2] AI总结生成完成");
      
      return summary ? `\n${summary}\n` : "";
    };
    
    console.log("🎉 [Agent决策层] 搜索结果已准备完成，可开始插入引用!");
    console.log("📊 搜索结果统计: 相关笔记", refinedResults.length, "篇");
    
    return {
      results: refinedResults,
      generateSummary
    };

  } catch (error) {
    console.error("💥 [Agent决策层] 搜索编排失败:", error);
    return {
      results: [],
      generateSummary: async () => ""
    };
  }
} 