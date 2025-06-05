import { ollamaGenerate } from './ollama';
import { zhipuGenerate } from './zhipu';
import { siliconflowGenerate } from './siliconflow';
import { extractKeywords, extractKeywordsWithTimeContext } from '../core/keywordExtraction';
import { semanticSearch, type SearchResult, detectLanguage, timeAwareSearch } from '../tools/utils';
import { filterResultsByTimeRange, generateTimeContextSummary, generateTimeBasedKeywords, type TimeToolsResult } from '../tools/timeTools';
import { getRelevanceEvaluationPrompt } from '../prompts/relevanceEvaluation';
import { getSummaryPrompt as getSummaryPromptTemplate } from '../prompts/summaryGeneration';

export async function generate(prompt: string): Promise<string> {
  const apiType = logseq.settings?.apiType;
    
  let response: string;
  const startTime = Date.now();
  
  if (apiType === "智谱清言") {
    response = await zhipuGenerate(prompt);
  } else if (apiType === "Ollama") {
    response = await ollamaGenerate(prompt);
  } else if (apiType === "硅基流动") {
    response = await siliconflowGenerate(prompt);
  } else {
    throw new Error("不支持的 API 类型 | Unsupported API type");
  }
  
  const endTime = Date.now();
  const duration = endTime - startTime;
  
  return response;
}

export async function evaluateRelevance(query: string, content: string): Promise<number> {
  const lang = detectLanguage(query);
  const prompt = getRelevanceEvaluationPrompt(query, content, lang);
  
  const response = await generate(prompt);
  const score = parseFloat(response) || 0;
  
  return score;
}

async function batchEvaluateRelevance(query: string, results: SearchResult[]): Promise<SearchResult[]> {
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
    
  }

  return refinedResults.sort((a, b) => b.score - a.score);
}

function getSummaryPrompt(query: string, content: string, timeContextInfo?: string): string {
  const lang = detectLanguage(query);
  return getSummaryPromptTemplate(query, content, lang, timeContextInfo);
}

export async function aiSearch(query: string): Promise<{summary: string, results: SearchResult[]}> {
  try {
    console.log("🔎 用户输入:", query);
    
    // 1. 提取关键词和时间上下文
    const keywordResult = await extractKeywordsWithTimeContext(query);
    const aiKeywords = keywordResult.keywords;
    const timeContext = keywordResult.timeContext;
    
    // 显示时间上下文信息
    const enableTimeTools = logseq.settings?.enableTimeTools ?? true;
    if (enableTimeTools && timeContext?.hasTimeContext) {
      const timeContextMsg = generateTimeContextSummary(timeContext);
      console.log("🕒 " + timeContextMsg);
      await logseq.UI.showMsg(timeContextMsg, 'info');
    }
    
    // 2. 生成时间关键词
    let timeKeywords: string[] = [];
    if (enableTimeTools && timeContext?.hasTimeContext) {
      timeKeywords = generateTimeBasedKeywords(timeContext);
    }
    
    if (timeKeywords.length === 0 && aiKeywords.length === 0) {
      console.log("❌ 未提取到任何关键词，搜索结束");
      return {
        summary: "",
        results: []
      };
    }

    // 3. 使用时间优先的搜索策略
    const searchResults = await timeAwareSearch(timeKeywords, aiKeywords);
    
    if (searchResults.length === 0) {
      console.log("❌ 时间优先搜索无结果，搜索结束");
      return {
        summary: "",
        results: []
      };
    }

    // 4. 批量AI评分筛选
    const refinedResults = await batchEvaluateRelevance(query, searchResults);
    console.log("📊 AI筛选后结果数量:", refinedResults.length);
    
    // 5. 根据设置决定是否生成AI总结
    const enableAISummary = logseq.settings?.enableAISummary ?? true;
    let summary = "";
    
    if (enableAISummary && refinedResults.length > 0) {
      await logseq.UI.showMsg("正在总结... | Summarizing...", 'info');
      const formattedResults = refinedResults
        .map((result: SearchResult) => result.block.content)
        .join('\n');
      
      // 构建包含时间上下文的总结prompt
      const timeContextInfo = (enableTimeTools && timeContext?.hasTimeContext) 
        ? generateTimeContextSummary(timeContext)
        : undefined;
      const summaryPrompt = getSummaryPrompt(query, formattedResults, timeContextInfo);
      
      summary = await generate(summaryPrompt);
      console.log("✅ AI总结生成完成");
    }
    
    return {
      summary: summary ? `\n${summary}\n` : "",
      results: refinedResults
    };

  } catch (error) {
    console.error("💥 [AI搜索失败] AI search failed:", error);
    return {
      summary: "",
      results: []
    };
  }
} 