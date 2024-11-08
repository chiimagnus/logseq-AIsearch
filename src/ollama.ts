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

export async function aiSearch(query: string): Promise<string> {
  try {
    // 1. 提取关键词
    const keywords = await extractKeywords(query);
    if (keywords.length === 0) {
      return "未能提取到有效关键词";
    }

    // 显示正在搜索的关键词，设置timeout为3秒
    logseq.UI.showMsg(`正在搜索：${keywords.join('，')}`, 'info', { timeout: 5000 });

    // 2. 执行语义搜索
    const searchResults = await semanticSearch(keywords);
    if (searchResults.length === 0) {
      return "未找到相关内容";
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
    const customPrompt = logseq.settings?.customPrompt || "请根据以下内容,总结要点: 要求:保持客观准确;条理清晰;突出重点;语言流利";
    const summaryPrompt = `${customPrompt} "${query}":${formattedResults}`;
    const summary = await ollamaGenerate(summaryPrompt);

    return `\n${summary}\n`;
    // return `搜索结果总结:\n${summary}\n\n原始笔记:\n${formattedResults}`;这个别删除！


  } catch (error) {
    console.error("AI搜索失败:", error);
    return "搜索过程中出现错误,请稍后重试";
  }
}
