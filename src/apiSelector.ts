import { ollamaGenerate } from './ollama';
import { zhipuGenerate } from './zhipu';
import { extractKeywords } from './keywordExtraction';
import { semanticSearch, type SearchResult, detectLanguage } from './utils';

export async function generate(prompt: string): Promise<string> {
  const apiType = logseq.settings?.apiType;
  if (apiType === "智谱清言") {
    return await zhipuGenerate(prompt);
  } else if (apiType === "Ollama") {
    return await ollamaGenerate(prompt);
  }
  throw new Error("不支持的 API 类型 | Unsupported API type");
}

export async function evaluateRelevance(query: string, content: string): Promise<number> {
  const lang = detectLanguage(query);
  
  const prompt = lang === 'en' ? `
    As an assistant specializing in understanding personal notes, analyze the relevance between this note and the user's question. Pay special attention to the time dimension.

Question: ${query}
Note content: ${content}

Scoring dimensions (Total 10 points):
1. Content Relevance (0-4 points)
- Does it touch the core question, even if briefly
- Contains personal insights or thoughts
- Time relevance of note creation/update

2. Time Dimension (0-3 points)
- Specific time points mentioned
- Time sequence and development
- Note creation time relevance

3. Personal Significance (0-3 points)
- Helps understand user's thoughts
- Timeline continuity and changes
- Experience accumulation span

Please understand:
1. Timestamp at start indicates creation/update time
2. Content may include various time expressions
3. Even brief content can be valuable if time-relevant

Return only a score from 0-10, no explanation.` : `
    作为一个善于理解个人笔记的助手，请深入分析这条笔记与用户问题的关联度。请特别注意时间维度的分析。

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

  const response = await generate(prompt);
  return parseFloat(response) || 0;
}

async function batchEvaluateRelevance(query: string, results: SearchResult[]): Promise<SearchResult[]> {
  const batchSize: number = typeof logseq.settings?.batchSize === 'number' 
    ? logseq.settings.batchSize 
    : 10; // 默认值为10

  console.log(`Configured batch size: ${logseq.settings?.batchSize}`);
  console.log(`Using batch size: ${batchSize}`);
  console.log(`Processing ${results.length} results with batch size of ${batchSize}`);
  
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
  const lang = detectLanguage(query);
  
  return lang === 'en' ? `
    As your friendly life secretary, I'll help analyze the notes related to your question "${query}": ${content}

Let's look at your growth journey! How have your thoughts, views, and daily life changed from past to present? Your thoughts and changes at different times are fascinating!

These records show significant growth. What events left deep impressions? Let me share!

Important points to note:
1. Directly related notes (no need for original content)
   - Notice *timeline* connections
   - Extract key brief ideas
   - Focus on personal insights
2. Context supplementation
   - Combine related notes context
   - Add necessary background
3. Personal insight integration
   - Connect scattered thoughts
   - Summarize experiences and lessons
   - Extract valuable insights

Please respond naturally, as if sharing insights with a friend.` : `
    作为我的可爱调皮的生活小秘书朋友哦！你将帮我分析与问题"${query}"相关的笔记内容：${content}。

让我们一起看看我的成长轨迹吧！从过去到现在，我的思考、观点和日常生活是如何变化的呢？你会注意到我在不同时间的思考和变化，真是让人感慨呢！

这些记录让我觉得我在某些方面有了很大的成长。有没有什么特别的事情让我印象深刻呢？快告诉我吧！

你需要注意以下重要信息：
1. 直接相关的笔记，但不需要原来笔记内容
   - 注意*时间线*上的关联
   - 注意提取简短但重要的想法
   - 关注个人感悟和思考
2. 上下文补充
   - 结合相关笔记的上下文
   - 补充必要的背景信息
3. 个人见解整合
   - 将零散的想法串联
   - 总结个人经验和教训
   - 提炼有价值的思考

请用简洁自然的语言回答，就像在和朋友分享见解一样。`;
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
      await logseq.UI.showMsg("正在总结... | Summarizing...", 'info');
      const formattedResults = refinedResults
        .map((result: SearchResult) => result.block.content)
        .join('\n');
      summary = await generate(getSummaryPrompt(query, formattedResults));
    }

    return {
      summary: summary ? `\n${summary}\n` : "",
      results: refinedResults
    };
  } catch (error) {
    console.error("AI搜索失败 | AI search failed:", error);
    return {
      summary: "",
      results: []
    };
  }
} 