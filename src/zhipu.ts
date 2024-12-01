import { extractKeywords } from './keywordExtraction';
import { semanticSearch, type SearchResult } from './utils';

export async function zhipuGenerate(prompt: string): Promise<string> {
  try {
    const apiKey = logseq.settings?.zhipuApiKey;
    const baseUrl = logseq.settings?.zhipuBaseUrl || 'https://open.bigmodel.cn/api/paas/v4/';
    const model = logseq.settings?.zhipuModel || 'glm-4-flash';

    const response = await fetch(`${baseUrl}/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        prompt: prompt
      })
    }).catch(error => {
      logseq.UI.showMsg("请确保智谱清言服务正在运行，并检查API密钥和模型名称是否正确", 'warning');
      return null;
    });

    if (!response || !response.ok) {
      logseq.UI.showMsg("请求失败，请检查智谱清言服务状态", 'warning');
      return "请求失败，请稍后重试";
    }

    const data = await response.json();
    return data.response || '';
    
  } catch (error) {
    console.error("智谱清言 API Error:", error);
    logseq.UI.showMsg("调用智谱清言 API 失败，请检查服务状态", 'error');
    return "请求失败，请稍后重试";
  }
} 