// API 服务模块 - 纯 API 调用服务

import { ollamaGenerate } from '../LLMs/ollama';
import { unifiedApiGenerate } from '../LLMs/unifiedApi';

export async function generateResponse(prompt: string): Promise<string> {
  const apiType = logseq.settings?.apiType as string;
    
  let response: string;
  
  if (apiType === "Ollama") {
    response = await ollamaGenerate(prompt);
  } else if (apiType === "Custom LLM API") {
    response = await unifiedApiGenerate(prompt);
  } else {
    throw new Error("不支持的 API 类型 | Unsupported API type");
  }
  
  return response;
} 