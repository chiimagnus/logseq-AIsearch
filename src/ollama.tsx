export async function ollamaGenerate(prompt: string): Promise<string> {
    try {
      const response = await fetch("http://localhost:11434/api/generate", {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: "qwen2.5",
          prompt: prompt,
          stream: false,
        }),
      });
  
      if (!response.ok) {
        throw new Error(`Ollama API 请求失败: ${response.statusText}`);
      }
  
      const rawData = await response.text();  // 直接获取文本数据
  
      if (!rawData) {
        throw new Error("Ollama API 返回了空数据");
      }
  
      const data = JSON.parse(rawData);  // 解析 JSON 数据
  
      if (!data.response) {
        throw new Error("Ollama API 未生成文本");
      }
  
      return data.response;  // 返回生成的文本
    } catch (error) {
      console.error("调用 Ollama API 失败: ", error);
      return "生成文本失败";
    }
  }