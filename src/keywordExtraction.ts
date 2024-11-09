// 新增 keywordExtraction.ts
import { ollamaGenerate } from './ollama';

export async function extractKeywords(input: string): Promise<string[]> {
  try {
    const prompt = `
请你明确我问问题的意图之后，再给出相关的关键词用于后续的检索。以JSON数组格式返回(只返回数组,不要其他内容):
"${input}"
示例输出: ["关键词1", "关键词2", "相关词1"]
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
