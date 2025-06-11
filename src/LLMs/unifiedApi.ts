/**
 * 统一API模块 - 支持所有OpenAI格式的大模型服务
 * Unified API Module - Support all OpenAI-format LLM services
 */

export async function unifiedApiGenerate(prompt: string): Promise<string> {
  const apiKey = logseq.settings?.apiKey;
  const apiUrl = logseq.settings?.apiUrl;
  const model = logseq.settings?.modelName;
  const timeout = 30000; // 转换为毫秒
  const apiType = logseq.settings?.apiType || "自定义API";

  if (!apiKey) {
    throw new Error(`${apiType} API Key 未设置 | ${apiType} API Key not set`);
  }

  if (!apiUrl) {
    throw new Error(`${apiType} API URL 未设置 | ${apiType} API URL not set`);
  }

  try {
    const requestBody = {
      model: model,
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.1,
      max_tokens: 4000,
      stream: false
    };

    console.log(`🛠️ [${apiType}] 请求参数: ${apiUrl}, 模型: ${model}`);

    // 创建AbortController来处理超时
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(apiUrl as string, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      // 尝试获取详细的错误信息
      let errorDetail = '';
      try {
        const errorData = await response.json();
        errorDetail = JSON.stringify(errorData);
        console.error(`${apiType} API 错误详情:`, errorData);
      } catch (e) {
        const errorText = await response.text();
        errorDetail = errorText;
        console.error(`${apiType} API 错误文本:`, errorText);
      }
      
      throw new Error(`${apiType} API 请求失败 | ${apiType} API request failed: ${response.status} ${response.statusText}. 详情: ${errorDetail}`);
    }

    const data = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error(`${apiType} API 响应格式错误 | Invalid ${apiType} API response format`);
    }

    return data.choices[0].message.content;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.error(`${apiType} API 请求超时 | ${apiType} API request timeout`);
      logseq.UI.showMsg(`${apiType} API 请求超时 (${timeout/1000}秒) | ${apiType} API request timeout (${timeout/1000}s)`, 'warning');
      throw new Error(`${apiType} API 请求超时 | ${apiType} API request timeout`);
    }
    
    console.error(`${apiType} API 调用失败 | ${apiType} API call failed:`, error);
    logseq.UI.showMsg(`调用 ${apiType} API 失败，请检查配置和网络 | Failed to call ${apiType} API, please check configuration and network`, 'error');
    throw error;
  }
} 