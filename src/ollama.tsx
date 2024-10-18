export async function ollamaGenerate(prompt: string): Promise<string> {
    try {
      const response = await fetch("http://localhost:11434/api/generate", {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: "qwen2.5",  // 使用默认的模型名称
          prompt: prompt,
          stream: false,
        }),
      });
  
      if (!response.ok) {
        throw new Error(`Ollama API 请求失败: ${response.statusText}`);
      }
  
      const data = await response.json();
      return data.response || "生成失败";  // 返回生成的文本
    } catch (error) {
      console.error("调用 Ollama API 失败: ", error);
      return "生成文本失败";
    }
  }