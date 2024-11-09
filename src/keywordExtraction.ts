// 新增 keywordExtraction.ts
import { ollamaGenerate } from './ollama';
import compromise from 'compromise';

export async function extractKeywords(input: string): Promise<string[]> {
  try {
    // 1. 使用 compromise 进行基础关键词提取
    const doc = compromise(input);
    const nouns = doc.nouns().out('array');
    const verbs = doc.verbs().out('array');
    const baseKeywords = [...new Set([...nouns, ...verbs])];

    // 2. 使用 Ollama 扩展关键词
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
      // 如果解析失败,仍然可以使用基础关键词
    }

    // 3. 合并关键词并去重
    const allKeywords = [...new Set([...baseKeywords, ...aiKeywords])];
    
    console.log("提取的关键词:", allKeywords);
    return allKeywords;
  } catch (error) {
    console.error("关键词提取失败:", error);
    return [];
  }
}
