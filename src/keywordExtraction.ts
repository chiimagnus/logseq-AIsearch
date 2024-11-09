// 新增 keywordExtraction.ts
import { ollamaGenerate } from './ollama';

export async function extractKeywords(input: string): Promise<string[]> {
  try {
    const prompt = `
请在清楚了解用户输入的问题意图之后，提取问题中的关键词用于检索。要求：
1. 将复杂短语拆分为独立的词元
2. 只保留有实际搜索意义的词
3. 去掉语气词、虚词等
4. 以JSON数组格式返回(只返回数组,不要其他内容)
输入: "${input}"
`;
    
    const response = await ollamaGenerate(prompt);
    let aiKeywords: string[] = [];
    
    try {
      aiKeywords = JSON.parse(response);
    } catch (e) {
      console.error("AI关键词解析失败:", e);
      return [];
    }
    
    console.log("提取的关键词:", aiKeywords);
    return aiKeywords;
  } catch (error) {
    console.error("关键词提取失败:", error);
    return [];
  }
}
