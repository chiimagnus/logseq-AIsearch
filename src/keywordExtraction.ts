// 新增 keywordExtraction.ts
import { ollamaGenerate } from './ollama';

export async function extractKeywords(input: string): Promise<string[]> {
  try {
    const prompt = `
分析用户问题"${input}"，提取关键搜索词。要求：
1. 提取核心主题词、关键行为词、场景词等
2. 考虑同义词和相关概念扩展
3. 确保关键词与问题核心高度相关
4. 只返回JSON数组格式，不要其他任何内容
5. 按重要性排序，返回5～8个关键词
6. 尽量细化关键词，避免过于笼统

示例输入："我跟一个女孩表白过，结果怎么样"
示例输出：["表白","恋爱","结果","感情","约会"]

示例输入："如何提高编程效率"
示例输出：["编程效率","开发工具","代码质量","最佳实践"]

示例输入："我对巫师3的剧情有什么感受"
示例输出：["巫师3","剧情","感受","游戏体验","角色发展"]
`;
    
    const response = await ollamaGenerate(prompt);
    let aiKeywords: string[] = [];
    
    try {
      // 尝试清理响应文本，只保留JSON数组部分
      const cleanedResponse = response.replace(/```json\s*|\s*```/g, '').trim();
      aiKeywords = JSON.parse(cleanedResponse);
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
