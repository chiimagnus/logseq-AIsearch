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
    });

    if (!response.ok) {
      const errorMessage = `Ollama API 请求失败: ${response.status} ${response.statusText}`;
      logseq.UI.showMsg(errorMessage, 'error');
      throw new Error(errorMessage);
    }

    const data = await response.json();
    if (!data.response) {
      throw new Error('Ollama API 返回数据格式错误');
    }

    return data.response;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logseq.UI.showMsg(`调用 Ollama API 失败: ${errorMessage}`, 'error');
    throw error;
  }
}

export async function aiSearch(query: string): Promise<string> {
  try {
    // 1. 提取关键词
    const keywords = await extractKeywords(query);
    if (keywords.length === 0) {
      return "未能提取到有效关键词";
    }

    // 2. 执行语义搜索
    const searchResults = await semanticSearch(keywords);
    if (searchResults.length === 0) {
      return "未找到相关内容";
    }

    // 3. 格式化搜索结果
    const formattedResults = searchResults
      .map((result: SearchResult) => result.block.content)
      .join('\n');

    // 4. 生成总结
    const summaryPrompt = `
请根据以下内容,总结关于"${query}"的要点:

${formattedResults}

要求:
1. 保持客观准确
2. 条理清晰
3. 突出重点
4. 语言流利
`;

    const summary = await ollamaGenerate(summaryPrompt);
    // return `搜索结果总结:\n${summary}\n\n原始笔记:\n${formattedResults}`;
    return `搜索结果总结:\n${summary}\n`;

  } catch (error) {
    console.error("AI搜索失败:", error);
    return "搜索过程中出现错误,请稍后重试";
  }
}
