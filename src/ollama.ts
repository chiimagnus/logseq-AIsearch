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
