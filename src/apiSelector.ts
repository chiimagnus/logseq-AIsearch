import { ollamaGenerate } from './ollama';
import { zhipuGenerate } from './zhipu';
import { extractKeywords } from './keywordExtraction';
import { semanticSearch, type SearchResult } from './utils';

export async function generate(prompt: string): Promise<string> {
  const apiType = logseq.settings?.apiType;
  if (apiType === "智谱清言") {
    return await zhipuGenerate(prompt);
  } else if (apiType === "Ollama") {
    return await ollamaGenerate(prompt);
  }
  throw new Error("Unsupported API type");
}

export async function evaluateRelevance(query: string, content: string): Promise<number> {
  const prompt = `作为一个善于理解个人笔记的助手，请深入分析这条笔记与用户问题的关联度。请特别注意时间维度的分析。

问题：${query}
笔记内容：${content}

评分维度（总分10分）：
1. 内容关联（0-4分）
- 是否触及问题核心，即使只是简短的一句话
- 是否包含相关的个人感悟或思考
- 笔记创建/更新时间与问题的时间相关性

2. 时间维度（0-3分）
- 笔记内容中提到的具体时间点
- 笔记记录的时间顺序和发展脉络
- 笔记创建时间的前后关联性

3. 个人意义（0-3分）
- 对理解用户想法的帮助
- 在时间线上的连续性和变化
- 经验积累的时间跨度

请理解：
1. 笔记开头的时间戳表示笔记的创建和更新时间
2. 内容中可能包含各种时间表达：具体日期、相对时间（如"上周"、"去年"）
3. 即使是简短的一句话，只要时间维度相关，也可能具有很高的价值

仅返回0-10的分数，无需解释。`;

  const apiType = logseq.settings?.apiType;
  const response = apiType === "Ollama" ? await ollamaGenerate(prompt) : await zhipuGenerate(prompt);
  return parseFloat(response) || 0;
}

async function batchEvaluateRelevance(query: string, results: SearchResult[], batchSize: number = 5): Promise<SearchResult[]> {
  const refinedResults: SearchResult[] = [];
  const totalBatches = Math.ceil(results.length / batchSize);
  const minScore: number = typeof logseq.settings?.minScore === 'number' 
    ? logseq.settings.minScore 
    : 5.0;

  for (let i = 0; i < results.length; i += batchSize) {
    const batch = results.slice(i, i + batchSize);
    const currentBatch = i / batchSize + 1;
    
    // 更新进度提示
    await logseq.UI.showMsg(`正在分析第 ${currentBatch}/${totalBatches} 批内容...`, 'info');
    
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
    refinedResults.push(...batchResults.filter((r): r is SearchResult => r !== null));
  }

  return refinedResults.sort((a, b) => b.score - a.score);
}

function getSummaryPrompt(query: string, content: string): string {
  return `作为你的笔记助手，我将帮你分析与问题"${query}"相关的笔记内容。

笔记内容：${content}

请按以下方式组织回答：
1. 时间维度分析
   - 注意笔记的创建和更新时间
   - 关注内容中提到的时间点
   - 理解事件发生的先后顺序

2. 核心内容提取
   - 找出最相关的笔记重点
   - 注意提取简短但重要的想法
   - 关注个人感悟和思考

3. 时间线整合
   - 将零散的想法按时间顺序串联
   - 展示思考或经验的演进过程
   - 突出关键的时间节点和转折

如果笔记内容与问题关联度不高，请直接说明。
请用简洁自然的语言回答，注意将时间维度自然地融入叙述中。`;
}

export async function aiSearch(query: string): Promise<{summary: string, results: SearchResult[]}> {
  try {
    // 1. 提取关键词
    const keywords = await extractKeywords(query);
    if (keywords.length === 0) {
      return {
        summary: "",
        results: []
      };
    }

    // 2. 第一轮：基于关键词的粗筛
    const initialResults = await semanticSearch(keywords);
    if (initialResults.length === 0) {
      return {
        summary: "",
        results: []
      };
    }

    // 3. 第二轮：批量AI评分筛选
    const refinedResults = await batchEvaluateRelevance(query, initialResults);
    
    // 4. 根据设置决定是否生成AI总结
    const enableAISummary = logseq.settings?.enableAISummary ?? true;
    let summary = "";
    
    if (enableAISummary) {
      await logseq.UI.showMsg("正在总结...", 'info');
      const formattedResults = refinedResults
        .map((result: SearchResult) => result.block.content)
        .join('\n');
  
      await logseq.UI.showMsg("正在总结...", 'info');
      const apiType = logseq.settings?.apiType;
      summary = apiType === "Ollama" 
        ? await ollamaGenerate(getSummaryPrompt(query, formattedResults))
        : await zhipuGenerate(getSummaryPrompt(query, formattedResults));
    }

    return {
      summary: summary ? `\n${summary}\n` : "",
      results: refinedResults
    };
  } catch (error) {
    console.error("AI搜索失败:", error);
    return {
      summary: "",
      results: []
    };
  }
} 