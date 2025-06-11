/**
 * API 服务模块 - 纯 API 调用服务
 * API Service Module - Pure API Call Service
 */

import { ollamaGenerate } from '../LLMs/ollama';
import { zhipuGenerate } from '../LLMs/zhipu';
import { siliconflowGenerate } from '../LLMs/siliconflow';

/**
 * 统一的AI模型调用接口
 * Unified AI Model Call Interface
 */
export async function generateResponse(prompt: string): Promise<string> {
  const apiType = logseq.settings?.apiType;
    
  let response: string;
  const startTime = Date.now();
  
  if (apiType === "智谱清言") {
    response = await zhipuGenerate(prompt);
  } else if (apiType === "Ollama") {
    response = await ollamaGenerate(prompt);
  } else if (apiType === "硅基流动") {
    response = await siliconflowGenerate(prompt);
  } else {
    throw new Error("不支持的 API 类型 | Unsupported API type");
  }
  
  const endTime = Date.now();
  const duration = endTime - startTime;
  
  console.log(`📡 [API调用] ${apiType} 响应时间: ${duration}ms`);
  
  return response;
} 