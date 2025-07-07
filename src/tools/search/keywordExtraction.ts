// 时间解析/扩展工具

import { generateResponse } from '../../services/ai/apiService';
import { parseTimeQuery, generateTimeBasedKeywords, type TimeToolsResult } from '../time/timeTools';
import { getKeywordExtractionPrompt } from '../../prompts/keywordExtraction';

export interface ExtractedKeywordsResult {
  keywords: string[];
  timeContext?: TimeToolsResult;
}

export async function extractKeywords(input: string): Promise<string[]> {
  const result = await extractKeywordsWithTimeContext(input);
  return result.keywords;
}

export async function extractKeywordsWithTimeContext(input: string): Promise<ExtractedKeywordsResult> {
  try {
    // 检查是否启用时间工具
    const enableTimeTools = logseq.settings?.enableTimeTools ?? true;
    const timeToolsDebug = logseq.settings?.timeToolsDebug ?? false;
    
    let timeContext: TimeToolsResult | undefined;
    
    if (enableTimeTools) {
      // 解析时间上下文
      timeContext = await parseTimeQuery(input);
      
      if (timeToolsDebug || timeContext.hasTimeContext) {
        console.log("📅 时间范围:", timeContext.timeRanges);
        console.log("🔍 时间关键词:", timeContext.keywords);
        console.log("⏰ 是否包含时间上下文:", timeContext.hasTimeContext);
      }
    } else {
      console.log("ℹ️ [时间工具] 时间工具已禁用，跳过时间解析");
      timeContext = {
        timeRanges: [],
        keywords: [],
        originalQuery: input,
        hasTimeContext: false
      };
    }
    
    // 构建时间上下文信息
    const timeContextInfo = timeContext.hasTimeContext 
      ? timeContext.timeRanges.map(r => r.description).join('、')
      : undefined;
    
    // 使用提取的 prompt 函数
    const finalPrompt = getKeywordExtractionPrompt(input, timeContextInfo);
    
    console.log("🏷️ [关键词提取] 开始提取关键词 | Starting keyword extraction");
    
    const response = await generateResponse(finalPrompt);
    let aiKeywords: string[] = [];
    let cleanedResponse = '';
    
    try {
      // 清理响应文本，移除代码块标记和thinking标签
      // 首先移除常见的代码块标记
      cleanedResponse = response.replace(/```json\s*|\s*```/g, '').trim();
      
      // 移除各种thinking标签（支持多种格式）
      // 这些正则表达式处理不同AI模型可能产生的推理内容格式
      cleanedResponse = cleanedResponse
        .replace(/<think>[\s\S]*?<\/think>/gi, '')  // 移除 <think>...</think>
        .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')  // 移除 <thinking>...</thinking>
        .replace(/\*\*思考过程\*\*[\s\S]*?(?=\[)/gi, '')  // 移除 **思考过程** 开头的内容
        .replace(/思考：[\s\S]*?(?=\[)/gi, '')  // 移除 思考： 开头的内容
        .replace(/^[\s\S]*?(?=\[)/g, '')  // 移除JSON数组前的所有内容
        .replace(/\][\s\S]*$/g, ']')  // 移除JSON数组后的所有内容
        .trim();
      
      // 如果清理后的内容不是以 [ 开头，尝试找到JSON数组
      // 这是一个额外的安全措施，确保我们能找到有效的JSON数组
      if (!cleanedResponse.startsWith('[')) {
        const jsonMatch = cleanedResponse.match(/\[[\s\S]*?\]/);
        if (jsonMatch) {
          cleanedResponse = jsonMatch[0];
        }
      }
      
      aiKeywords = JSON.parse(cleanedResponse);
    } catch (e) {
      console.error("AI关键词解析失败｜AI Keyword Parsing Failed:", e);
      console.error("原始响应｜Original Response:", response);
      console.error("清理后响应｜Cleaned Response:", cleanedResponse);
      return {
        keywords: [],
        timeContext
      };
    }
    
    // 合并AI提取的关键词和时间相关关键词
    const timeBasedKeywords = enableTimeTools ? generateTimeBasedKeywords(timeContext) : [];
    const allKeywords = [...new Set([...aiKeywords, ...timeBasedKeywords])]; // 去重
    
    const importantKeywords = allKeywords.slice(0, 3); // 选择前三个关键词作为重要关键词
    
    console.log("🔍 AI关键词:", aiKeywords);
    console.log("🕒 时间关键词:", timeBasedKeywords);
    console.log("🔗 合并后关键词:", allKeywords);
    console.log("⭐ 重要关键词 (前3个):", importantKeywords);
    console.log("📊 关键词数量:", allKeywords.length);
    
    return {
      keywords: allKeywords,
      timeContext
    };
  } catch (error) {
    console.error("关键词提取失败｜Keyword Extraction Failed:", error);
    return {
      keywords: [],
      timeContext: undefined
    };
  }
}
