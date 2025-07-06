// Embedding 生成服务

// 配置函数
export function getEmbeddingServiceType(): 'ollama' | 'cloud' {
  const selected = String(logseq.settings?.embeddingModel || "Ollama本地模型 / Ollama Local Model");
  return selected.includes("Ollama") ? 'ollama' : 'cloud';
}

export function getVectorDimension(): number {
  const serviceType = getEmbeddingServiceType();
  if (serviceType === 'ollama') {
    // nomic-embed-text 的维度是 768
    return 768;
  } else {
    // BAAI/bge-m3 的维度是 1024  
    return 1024;
  }
}

// Ollama embedding 生成
async function generateOllamaEmbedding(text: string): Promise<number[]> {
  const ollamaHost = String(logseq.settings?.ollamaHost || "http://localhost:11434");
  const modelName = String(logseq.settings?.ollamaEmbeddingModel || "nomic-embed-text");

  try {
    const response = await fetch(`${ollamaHost}/api/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelName,
        prompt: text
      }),
      // 增加超时时间，避免长时间等待
      signal: AbortSignal.timeout(30000) // 30秒超时
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.embedding;
  } catch (error) {
    console.error("Ollama embedding failed:", error);
    throw error;
  }
}

// 云端 embedding 生成
async function generateCloudEmbedding(text: string): Promise<number[]> {
  const apiUrl = String(logseq.settings?.cloudEmbeddingApiUrl || "https://api.siliconflow.cn/v1/embeddings");
  const apiKey = String(logseq.settings?.cloudEmbeddingApiKey || "");
  const modelName = String(logseq.settings?.cloudEmbeddingModel || "BAAI/bge-m3");

  if (!apiKey) {
    throw new Error("云端API密钥未设置 / Cloud API key not set");
  }

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelName,
        input: text
      })
    });

    if (!response.ok) {
      throw new Error(`Cloud API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
  } catch (error) {
    console.error("Cloud embedding failed:", error);
    throw error;
  }
}

// 智能重试机制
async function generateEmbeddingWithRetry(text: string, maxRetries: number = 3): Promise<number[]> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const serviceType = getEmbeddingServiceType();

      if (serviceType === 'ollama') {
        return await generateOllamaEmbedding(text);
      } else {
        return await generateCloudEmbedding(text);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.warn(`⚠️ [重试] Embedding生成失败 (${attempt}/${maxRetries}): ${errorMsg}`);

      if (attempt === maxRetries) {
        throw error; // 最后一次尝试失败，抛出错误
      }

      // 指数退避延迟
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
      console.log(`⏳ [延迟] 等待${delay}ms后重试...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw new Error("所有重试都失败了");
}

// 主要的 embedding 生成函数
export async function generateEmbedding(text: string): Promise<number[]> {
  return await generateEmbeddingWithRetry(text);
}

// 测试 embedding 服务连接
export async function testEmbeddingService(): Promise<void> {
  const serviceType = getEmbeddingServiceType();
  // logseq.UI.showMsg(`🔧 正在测试${serviceType === 'ollama' ? 'Ollama' : '云端'}embedding服务...`, "info");

  try {
    await generateEmbedding("测试连接");
    logseq.UI.showMsg(`✅ ${serviceType === 'ollama' ? 'Ollama' : '云端'}embedding服务连接成功`, "success", { timeout: 3000 });
  } catch (error) {
    console.error("Embedding service test failed:", error);
    logseq.UI.showMsg(`❌ embedding服务连接失败: ${error}`, "error", { timeout: 8000 });
    throw error;
  }
} 