export async function ollamaGenerate(prompt: string): Promise<string> {
    try {
      console.log("发送给 Ollama 的内容:", {
        model: "qwen2.5",
        prompt: prompt,
        stream: false,
      });
  
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
  
      // 检查响应状态码
      console.log("Ollama API 返回的状态:", response.status);
  
      if (!response.ok) {
        throw new Error(`Ollama API 请求失败: ${response.statusText}`);
      }
  
      // 获取响应的原始二进制流
      const buffer = await response.arrayBuffer();
      const decoder = new TextDecoder('utf-8');
      const rawData = decoder.decode(buffer);
  
      // 打印响应的原始文本数据
      console.log("Ollama API 返回的原始数据:", rawData);
  
      // 如果响应内容为空，抛出错误
      if (!rawData) {
        throw new Error("Ollama API 返回了空数据");
      }
  
      // 尝试解析 JSON 数据
      const data = JSON.parse(rawData);
      console.log("解析后的数据:", data);
  
      // 检查是否有生成的文本
      if (!data.response) {
        throw new Error("Ollama API 未生成文本");
      }
  
      return data.response;  // 返回生成的文本
    } catch (error) {
      console.error("调用 Ollama API 失败: ", error);
      return "生成文本失败";
    }
  }