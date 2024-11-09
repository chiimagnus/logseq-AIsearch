// 新增 keywordExtraction.ts
import { ollamaGenerate } from './ollama';

export async function extractKeywords(input: string): Promise<string[]> {
  try {
    const prompt = `
请仔细分析用户问题的核心意图，提取最能体现问题关注点的关键词用于检索。要求：
1. 对复合词进行合理拆分
2. 一定要进行关键词联想！比如：“如何提高工作效率”，可以联想出“时间管理”、“工作方法”等关键词
3. 以JSON数组格式返回(只返回数组,不要其他内容)
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
