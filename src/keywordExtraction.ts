import { generate } from './apiSelector';
import { detectLanguage } from './utils';

export async function extractKeywords(input: string): Promise<string[]> {
  try {
    const lang = detectLanguage(input);
    
    const prompt = lang === 'en' ? `
      Analyze the user input "${input}" and extract key information. Requirements:
      1. Core elements:
        - Subject/Technical terms/Core concepts
        - Actions/Methods/Theoretical frameworks
        - Emotional attitudes/Value orientations
      2. Key information:
        - Date, time, location, people
        - Professional domain terms
        - Personal viewpoints
      3. Extended information:
        - Related concepts/Influencing factors
        - Development trends/Future outlook
        - Experience summary
      4. Others:
        - Refine keywords, avoid vagueness
        - Sort by importance (3 most important first)
        - Number of keywords: 5-10
        - Return format: ONLY return a JSON array of strings, nothing else. For example: ["keyword1", "keyword2", "keyword3"]

      Example 1: "How do I feel about the storyline of The Witcher 3"
      Output 1: ["Witcher 3", "storyline", "feelings", "gaming", "experience", "characters", "development"]

      Example 2: "Just finished reading 'Principles', think systematic thinking is crucial in work"
      Output 2: ["systematic thinking", "Principles", "work", "methodology", "efficiency", "improvement", "mindset"]

      Example 3: "Reflecting on five years of entrepreneurship taught me to let go and enjoy the process"
      Output 3: ["entrepreneurship", "lessons learned", "letting go", "reflection", "mindset change", "growth", "process"]

      IMPORTANT: Your response must be ONLY a JSON array, no other text or explanation.
      ` : `
      分析用户输入"${input}"，智能提取关键信息。要求：
      1. 识别核心要素:
        - 主题词/专业术语/核心概念
        - 行为动作/方法论/理论框架
        - 情感态度/价值取向/深层思考
      2. 提取关键信息:
        - 日期时间/地点/人物等具体要素
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
        - 返回格式：仅返回JSON数组，例如：["关键词1", "关键词2", "关键词3"]

      示例输入1:"我对巫师3的剧情有什么感受"
      示例输出1:["巫师3","剧情","感受","游戏","体验","角色","发展"]

      示例输入2:"今天读完《原则》这本书，觉得在工作中建立系统化思维很重要"
      示例输出2:["系统化","思维","《原则》","工作","方法","读书","效率","提升","认知","升级"]

      示例输入3:"回顾这五年的创业经历，失败教会我放下执念，享受过程"
      示例输出3:["创业经历","失败感悟","执念","回顾","心态转变","成长","过程价值"]

      重要：你的回复必须只包含JSON数组，不要包含其他文本或解释。
      `;
    
    const response = await generate(prompt);
    let aiKeywords: string[] = [];
    
    try {
      // 尝试清理响应文本，只保留JSON数组部分
      const cleanedResponse = response.replace(/```json\s*|\s*```/g, '').trim();
      aiKeywords = JSON.parse(cleanedResponse);
    } catch (e) {
      console.error("AI关键词解析失败｜AI Keyword Parsing Failed:", e);
      return [];
    }
    
    const importantKeywords = aiKeywords.slice(0, 3); // 选择前三个关键词作为重要关键词
    console.log("Extracted keywords:", aiKeywords);
    console.log("Important keywords:", importantKeywords);
    return aiKeywords;
  } catch (error) {
    console.error("关键词提取失败｜Keyword Extraction Failed:", error);
    return [];
  }
}
