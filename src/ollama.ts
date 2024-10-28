import { extractKeywords } from './keywordExtraction';
import { semanticSearch, type SearchResult } from './utils';

export async function ollamaGenerate(prompt: string): Promise<string> {
  try {
    const response = await fetch("http://localhost:11434/api/generate", {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      mode: 'no-cors',  // 添加这个配置
      body: JSON.stringify({
        model: "qwen2.5",
        prompt: prompt,
        stream: false,
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama API 请求失败: ${response.statusText}`);
    }

    const data = await response.json();
    return data.response || "";
  } catch (error) {
    console.error("调用 Ollama API 失败:", error);
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
      .map((result: SearchResult) => {
        const block = result.block;
        const pageName = block.page?.name || "未命名页面";
        return `- ${block.content}\n  来源: ${pageName}`;
      })
      .join('\n\n');

    // 4. 生成总结
    const summaryPrompt = `
请根据以下内容,总结关于"${query}"的要点:

${formattedResults}

要求:
1. 保持客观准确
2. 条理清晰
3. 突出重点
4. 语言流畅
`;

    const summary = await ollamaGenerate(summaryPrompt);
    return `搜索结果总结:\n${summary}\n\n原始笔记:\n${formattedResults}`;
  } catch (error) {
    console.error("AI搜索失败:", error);
    return "搜索过程中出现错误,请稍后重试";
  }
}
