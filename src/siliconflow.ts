export async function siliconflowGenerate(prompt: string): Promise<string> {
  const apiKey = logseq.settings?.siliconflowApiKey;
  const baseUrl = logseq.settings?.siliconflowBaseUrl || "https://api.siliconflow.cn/v1";
  const model = logseq.settings?.siliconflowModel || "deepseek-ai/DeepSeek-R1-0528-Qwen3-8B";

  if (!apiKey) {
    throw new Error("硅基流动 API Key 未设置 | SiliconFlow API Key not set");
  }

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 10000,
        stream: false
      })
    });

    if (!response.ok) {
      throw new Error(`硅基流动 API 请求失败 | SiliconFlow API request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error("硅基流动 API 响应格式错误 | Invalid SiliconFlow API response format");
    }

    return data.choices[0].message.content;
  } catch (error) {
    console.error("硅基流动 API 调用失败 | SiliconFlow API call failed:", error);
    throw error;
  }
} 