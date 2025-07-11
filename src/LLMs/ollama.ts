export async function ollamaGenerate(prompt: string): Promise<string> {
  try {
    const ollamaHost = String(logseq.settings?.ollamaHost || "http://localhost:11434");
    const model = logseq.settings?.model;

    const response = await fetch(`${ollamaHost}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        prompt: prompt,
        stream: false,
        temperature: 0.1
      })
    }).catch(error => {
      logseq.UI.showMsg("请确保 Ollama 服务正在运行，并检查主机地址和模型名称是否正确 | Please ensure Ollama service is running and check if host address and model name are correct", 'warning');
      return null;
    });

    if (!response || !response.ok) {
      logseq.UI.showMsg("请求失败，请检查 Ollama 服务状态 | Request failed, please check Ollama service status", 'warning');
      return "请求失败，请稍后重试 | Request failed, please try again later";
    }

    const data = await response.json();
    return data.response || '';
    
  } catch (error) {
    console.error("Ollama API Error:", error);
    logseq.UI.showMsg("调用 Ollama API 失败，请检查服务状态 | Failed to call Ollama API, please check service status", 'error');
    return "请求失败，请稍后重试 | Request failed, please try again later";
  }
}
