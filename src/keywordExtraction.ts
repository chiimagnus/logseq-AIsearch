import { generate } from './apiSelector';

export async function extractKeywords(input: string): Promise<string[]> {
  try {
    const prompt = `
分析用户输入"${input}"，智能提取关键信息。要求：
1. 识别核心要素:
   - 主题词/专业术语/核心概念
   - 行为动作/方法论/理论框架
   - 情感态度/价值取向/深层思考
2. 提取关键信息:
   - 时间/地点/人物等具体要素
   - 专业领域的限定词和框架
   - 个人观点和思考维度
3. 补充延伸信息:
   - 相关概念/影响因素
   - 发展趋势/未来展望
   - 经验总结/价值判断
4. 其他:
   - 细化关键词，避免笼统，关键词能拆分尽量拆分
   - 按重要性排序，把最重要的三个关键词放在最前面
   - 关键词数量:5-10个关键词
   - 返回格式:仅JSON数组

示例输入1:"我对巫师3的剧情有什么感受"
示例输出1:["巫师3","剧情","感受","游戏","体验","角色","发展"]

示例输入2:"今天读完《原则》这本书，觉得在工作中建立系统化思维很重要"
示例输出2:["系统化","思维","《原则》","工作","方法","读书","效率","提升","认知","升级"]

示例输入3:"回顾这五年的创业经历，失败教会我放下执念，享受过程"
示例输出3:["创业经历","失败感悟","执念","回顾","心态转变","成长","过程价值"]
`;
    
    const response = await generate(prompt);
    let aiKeywords: string[] = [];
    
    try {
      // 尝试清理响应文本，只保留JSON数组部分
      const cleanedResponse = response.replace(/```json\s*|\s*```/g, '').trim();
      aiKeywords = JSON.parse(cleanedResponse);
    } catch (e) {
      console.error("AI关键词解析失败:", e);
      return [];
    }
    
    const importantKeywords = aiKeywords.slice(0, 3); // 选择前三个关键词作为重要关键词
    console.log("提取的关键词:", aiKeywords);
    console.log("重要关键词:", importantKeywords);
    return aiKeywords;
  } catch (error) {
    console.error("关键词提取失败:", error);
    return [];
  }
}
