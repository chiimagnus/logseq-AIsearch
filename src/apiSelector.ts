import { ollamaGenerate } from './ollama';
import { zhipuGenerate } from './zhipu';
import { extractKeywords } from './keywordExtraction';
import { semanticSearch, type SearchResult, detectLanguage } from './utils';

export async function generate(prompt: string): Promise<string> {
  const apiType = logseq.settings?.apiType;
  
  console.log("🤖 [AI调用开始] 发送Prompt给AI模型 | Starting AI call with prompt:");
  console.log("📝 Prompt内容:", prompt);
  console.log("🔧 使用的API类型:", apiType);
  
  let response: string;
  const startTime = Date.now();
  
  if (apiType === "智谱清言") {
    response = await zhipuGenerate(prompt);
  } else if (apiType === "Ollama") {
    response = await ollamaGenerate(prompt);
  } else {
    throw new Error("不支持的 API 类型 | Unsupported API type");
  }
  
  const endTime = Date.now();
  const duration = endTime - startTime;
  
  console.log("✅ [AI响应完成] AI模型完整回复内容 | AI Response completed:");
  console.log("📄 AI完整响应:", response);
  console.log("⏱️ 响应耗时:", `${duration}ms`);
  console.log("📊 响应长度:", `${response.length} 字符`);
  console.log("─".repeat(50));
  
  return response;
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

  console.log("🔍 [相关性评分] 开始评估笔记相关性 | Starting relevance evaluation");
  console.log("❓ 用户问题:", query);
  console.log("📄 笔记内容:", content.substring(0, 200) + (content.length > 200 ? "..." : ""));
  
  const response = await generate(prompt);
  const score = parseFloat(response) || 0;
  
  console.log("⭐ [评分结果] 相关性分数:", score);
  
  return score;
}

async function batchEvaluateRelevance(query: string, results: SearchResult[]): Promise<SearchResult[]> {
  const batchSize: number = typeof logseq.settings?.batchSize === 'number' 
    ? logseq.settings.batchSize 
    : 10; // 默认值为10

  console.log("⚙️ [批量评分配置] Batch evaluation configuration:");
  console.log(`📋 配置的批量大小: ${logseq.settings?.batchSize}`);
  console.log(`📋 实际使用批量大小: ${batchSize}`);
  console.log(`📊 待处理结果数量: ${results.length}`);
  
  const refinedResults: SearchResult[] = [];
  const totalBatches = Math.ceil(results.length / batchSize);
  const minScore: number = typeof logseq.settings?.minScore === 'number' 
    ? logseq.settings.minScore 
    : 5.0;

  for (let i = 0; i < results.length; i += batchSize) {
    const batch = results.slice(i, i + batchSize);
    const currentBatch = i / batchSize + 1;
    
    console.log(`🔄 [批量处理] 正在处理第 ${currentBatch}/${totalBatches} 批，包含 ${batch.length} 个项目`);
    
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
    
    console.log(`✅ 第 ${currentBatch} 批处理完成，耗时 ${batchDuration}ms，筛选出 ${validResults.length} 个有效结果`);
  }

  return refinedResults.sort((a, b) => b.score - a.score);
}

function getSummaryPrompt(query: string, content: string): string {
  const lang = detectLanguage(query);
  
  return lang === 'en' ? `
    As your friendly life secretary, I'll help analyze the notes related to your question "${query}". Here's the content to analyze: ${content}

First, evaluate if there's enough meaningful content to summarize:
1. Check if the notes contain substantial information:
   - Are there multiple distinct ideas or experiences?
   - Is there enough context to understand the topic?
   - Are there meaningful insights or reflections?
2. If the content is insufficient (e.g., too brief, lacks context, or contains no meaningful insights), respond with:
   "The available notes are too limited for a comprehensive summary. Consider adding more detailed notes about this topic."

If there's enough content, then analyze as follows:
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
    作为你的贴心小助手，我来帮你分析与问题"${query}"相关的笔记内容。以下是需要分析的内容：${content}

首先，让我们评估一下内容是否足够进行总结：
1. 检查笔记是否包含足够的有意义信息：
   - 是否包含多个不同的想法或经历？
   - 是否有足够的上下文来理解主题？
   - 是否包含有价值的见解或思考？
2. 如果内容不足（例如：过于简短、缺乏上下文、或没有实质性的见解），请回复：
   "当前相关笔记内容较少，无法进行全面的总结。建议添加更多关于该主题的详细笔记。"

如果内容充足，则按以下方式分析：
1. 直接相关的笔记内容分析
   - 注意*时间线*上的关联
   - 提取关键的简短想法
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
    console.log("🚀 [AI搜索开始] 启动智能搜索流程 | Starting AI search process");
    console.log("🔎 搜索查询:", query);
    
    // 1. 提取关键词
    console.log("📍 [步骤1/4] 正在提取关键词...");
    const keywords = await extractKeywords(query);
    if (keywords.length === 0) {
      console.log("❌ 未提取到任何关键词，搜索结束");
      return {
        summary: "",
        results: []
      };
    }

    // 2. 第一轮：基于关键词的粗筛
    console.log("📍 [步骤2/4] 正在进行初步搜索...");
    const initialResults = await semanticSearch(keywords);
    console.log("📊 初步搜索结果数量:", initialResults.length);
    
    if (initialResults.length === 0) {
      console.log("❌ 初步搜索无结果，搜索结束");
      return {
        summary: "",
        results: []
      };
    }

    // 3. 第二轮：批量AI评分筛选
    console.log("📍 [步骤3/4] 正在进行AI智能筛选...");
    const refinedResults = await batchEvaluateRelevance(query, initialResults);
    console.log("📊 AI筛选后结果数量:", refinedResults.length);
    
    // 4. 根据设置决定是否生成AI总结
    const enableAISummary = logseq.settings?.enableAISummary ?? true;
    let summary = "";
    
    if (enableAISummary && refinedResults.length > 0) {
      console.log("📍 [步骤4/4] 正在生成AI总结...");
      await logseq.UI.showMsg("正在总结... | Summarizing...", 'info');
      const formattedResults = refinedResults
        .map((result: SearchResult) => result.block.content)
        .join('\n');
      console.log("📄 用于总结的内容长度:", formattedResults.length, "字符");
      summary = await generate(getSummaryPrompt(query, formattedResults));
      console.log("✅ AI总结生成完成");
    } else if (!enableAISummary) {
      console.log("ℹ️ AI总结功能已禁用，跳过总结步骤");
    } else {
      console.log("ℹ️ 无搜索结果，跳过总结步骤");
    }

    console.log("🎉 [AI搜索完成] 搜索流程结束 | AI search process completed");
    console.log("📋 最终结果:", {
      summary: summary ? "已生成总结" : "无总结",
      resultCount: refinedResults.length,
      summaryLength: summary.length
    });
    
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