// 搜索编排器 - AI Agent 核心决策层

import { SearchResponse } from '../types/search';
import { extractKeywordsWithTimeContext } from '../tools/keywordExtraction';
import { timeAwareSearch } from '../tools/searchTools';
import { generateTimeContextSummary, generateTimeBasedKeywords, type TimeToolsResult } from '../tools/timeTools';
import { batchEvaluateRelevance } from './relevance';
import { generateResponse } from './apiService';
import { getSummaryPrompt } from '../prompts/summaryGeneration';

// AI 搜索的核心编排逻辑 - Agent 决策层
export async function aiSearch(query: string): Promise<SearchResponse> {
  try {
    console.log("🧠 [Agent决策层] 开始分析用户输入:", query);
    
    // === 决策阶段1: 意图识别与关键词提取 ===
    console.log("🧠 [决策1] 进行意图识别与关键词提取...");
    const keywordResult = await extractKeywordsWithTimeContext(query);
    const aiKeywords = keywordResult.keywords;
    const timeContext = keywordResult.timeContext;
    
    // === 决策阶段2: 时间上下文分析 ===
    const enableTimeTools = logseq.settings?.enableTimeTools ?? true;
    let timeKeywords: string[] = [];
    
    if (enableTimeTools && timeContext?.hasTimeContext) {
      console.log("🧠 [决策2] 检测到时间上下文，启用时间工具...");
      const timeContextMsg = generateTimeContextSummary(timeContext);
      console.log("⏰ " + timeContextMsg);
      await logseq.UI.showMsg(timeContextMsg, 'info');
      
      timeKeywords = generateTimeBasedKeywords(timeContext);
      console.log("⏰ 时间关键词:", timeKeywords);
    } else {
      console.log("🧠 [决策2] 未检测到时间上下文，跳过时间工具");
    }
    
    // === 决策阶段3: 关键词验证 ===
    if (timeKeywords.length === 0 && aiKeywords.length === 0) {
      console.log("❌ [决策3] 未提取到任何有效关键词，终止搜索");
      return {
        summary: "",
        results: []
      };
    }
    
    console.log("✅ [决策3] 关键词提取成功");
    console.log("🔍 AI关键词:", aiKeywords);
    console.log("⏰ 时间关键词:", timeKeywords);

    // === 决策阶段4: 搜索策略选择与执行 ===
    console.log("🧠 [决策4] 选择搜索策略并执行时间感知搜索...");
    const searchResults = await timeAwareSearch(timeKeywords, aiKeywords);
    
    if (searchResults.length === 0) {
      console.log("❌ [决策4] 搜索无结果，终止流程");
      return {
        summary: "",
        results: []
      };
    }
    
    console.log("✅ [决策4] 搜索完成，获得", searchResults.length, "个初步结果");

    // === 决策阶段5: AI 相关性评估 ===
    console.log("🧠 [决策5] 启动AI相关性评估...");
    const refinedResults = await batchEvaluateRelevance(query, searchResults);
    console.log("✅ [决策5] AI筛选完成，保留", refinedResults.length, "个高质量结果");
    
    // === 决策阶段6: AI 总结生成 ===
    const enableAISummary = logseq.settings?.enableAISummary ?? true;
    let summary = "";
    
    if (enableAISummary && refinedResults.length > 0) {
      console.log("🧠 [决策6] 启动AI总结生成...");
      await logseq.UI.showMsg("正在总结... | Summarizing...", 'info');
      
      const formattedResults = refinedResults
        .map((result) => result.block.content)
        .join('\n');
      
      // 构建包含时间上下文的总结prompt
      const timeContextInfo = (enableTimeTools && timeContext?.hasTimeContext) 
        ? generateTimeContextSummary(timeContext)
        : undefined;
      const summaryPrompt = getSummaryPrompt(query, formattedResults, timeContextInfo);
      
      summary = await generateResponse(summaryPrompt);
      console.log("✅ [决策6] AI总结生成完成");
    } else {
      console.log("⏭️ [决策6] AI总结已禁用或无结果，跳过总结生成");
    }
    
    // === 最终决策: 返回整合结果 ===
    const finalResponse: SearchResponse = {
      summary: summary ? `\n${summary}\n` : "",
      results: refinedResults
    };
    
    console.log("🎉 [Agent决策层] 搜索编排完成！");
    console.log("📊 最终结果统计:");
    console.log("  - 相关笔记:", finalResponse.results.length, "篇");
    console.log("  - AI总结:", finalResponse.summary ? "已生成" : "未生成");
    
    return finalResponse;

  } catch (error) {
    console.error("💥 [Agent决策层] 搜索编排失败:", error);
    return {
      summary: "",
      results: []
    };
  }
} 