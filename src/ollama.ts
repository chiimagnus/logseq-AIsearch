import { extractKeywords } from './keywordExtraction';
import { semanticSearch, type SearchResult } from './utils';

export async function ollamaGenerate(prompt: string): Promise<string> {
  try {
    const host = logseq.settings?.host || 'localhost:11434';
    const model = logseq.settings?.model || 'qwen2.5';

    const response = await fetch(`http://${host}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        prompt: prompt,
        stream: false,
      })
    }).catch(error => {
      logseq.UI.showMsg("请确保 Ollama 服务正在运行，并检查主机地址和模型名称是否正确", 'warning');
      return null;
    });

    if (!response || !response.ok) {
      logseq.UI.showMsg("请求失败，请检查 Ollama 服务状态", 'warning');
      return "请求失败，请稍后重试";
    }

    const data = await response.json();
    return data.response || '';
    
  } catch (error) {
    console.error("Ollama API Error:", error);
    logseq.UI.showMsg("调用 Ollama API 失败，请检查服务状态", 'error');
    return "请求失败，请稍后重试";
  }
}

export async function evaluateRelevance(query: string, content: string): Promise<number> {
  const prompt = `作为一个善于理解个人笔记的助手，请深入分析这条笔记与用户问题的关联度。

问题：${query}
笔记内容：${content}

评分维度（总分10分）：
1. 内容关联（0-4分）
- 是否触及问题核心，即使只是简短的一句话
- 是否包含相关的个人感悟或思考
- 是否记录了相关的生活经历或观察

2. 上下文价值（0-3分）
- 与周围笔记的联系程度
- 是否是更大主题的一部分
- 是否需要结合其他笔记理解

3. 个人意义（0-3分）
- 对理解用户想法的帮助
- 记录时间的前后关联
- 个人经验的参考价值

请理解：即使是简短的一句话，只要与问题相关，也可能具有很高的价值。
仅返回0-10的分数，无需解释。`;

  const response = await ollamaGenerate(prompt);
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

// 添加 getSummaryPrompt 函数定义
function getSummaryPrompt(query: string, content: string): string {
  return `
请针对用户问题"${query}"，基于以下内容进行重点总结：
1. 需要总结与问题直接相关的信息
2. 并且进行适当延伸，不要遗漏重要信息
3. 按信息的相关程度排序
4. 确保回答切中问题要点
5. 如果内容与问题关联不大，请明确指出
相关内容：${content}
`;
}

export async function aiSearch(query: string): Promise<{summary: string, results: SearchResult[]}> {
  try {
    // 1. 提取关键词
    const keywords = await extractKeywords(query);
    if (keywords.length === 0) {
      return {
        summary: "未能提取到有效关键词",
        results: []
      };
    }

    // await logseq.UI.showMsg(`正在搜索：${keywords.join('，')}`, 'info');

    // 2. 第一轮：基于关键词的粗筛
    const initialResults = await semanticSearch(keywords);
    if (initialResults.length === 0) {
      return {
        summary: "未找到相关内容",
        results: []
      };
    }

    // 3. 第二轮：批量AI评分筛选
    // await logseq.UI.showMsg("正在进行语义相关性分析...", 'info');
    const refinedResults = await batchEvaluateRelevance(query, initialResults);

    // 4. 生成总结
    const formattedResults = refinedResults
      .map((result: SearchResult) => result.block.content)
      .join('\n');

    await logseq.UI.showMsg("正在总结...", 'info');
    const summary = await ollamaGenerate(getSummaryPrompt(query, formattedResults));

    return {
      summary: `\n${summary}\n`,
      results: refinedResults
    };
  } catch (error) {
    console.error("AI搜索失败:", error);
    return {
      summary: "搜索过程中出现错误,请稍后重试",
      results: []
    };
  }
}
