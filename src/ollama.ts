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

    // 显示正在搜索的关键词，设置timeout为3秒
    logseq.UI.showMsg(`正在搜索：${keywords.join('，')}`, 'info', { timeout: 5000 });

    // 2. 执行语义搜索
    const searchResults = await semanticSearch(keywords);
    if (searchResults.length === 0) {
      return {
        summary: "未找到相关内容",
        results: []
      };
    }

    // 3. 格式化搜索结果
    const formattedResults = searchResults
      .map((result: SearchResult) => result.block.content)
      .join('\n');

    // 在“正在搜索”消息结束后显示“正在总结”消息，持续10秒
    setTimeout(() => {
      logseq.UI.showMsg("正在总结...", 'info', { timeout: 10000 });
    }, 6000);

    // 4. 生成总结
    const summaryPrompt = `
请针对用户问题"${query}"，基于以下内容进行重点总结：
1. 需要总结与问题直接相关的信息
2. 并且进行适当延伸，不要遗漏重要信息
3. 按信息的相关程度排序
4. 确保回答切中问题要点
5. 如果内容与问题关联不大，请明确指出

相关内容：${formattedResults}
`;
    const summary = await ollamaGenerate(summaryPrompt);

    return {
      summary: `\n${summary}\n`,
      results: searchResults
    };
  } catch (error) {
    console.error("AI搜索失败:", error);
    return {
      summary: "搜索过程中出现错误,请稍后重试",
      results: []
    };
  }
}
