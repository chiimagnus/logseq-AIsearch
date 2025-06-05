export function getRelevanceEvaluationPrompt(query: string, content: string, lang: 'zh' | 'en'): string {
  return lang === 'en' ? `
    As an assistant specializing in understanding personal notes, analyze the relevance between this note and the user's question. Pay special attention to the time dimension.

Question: ${query}
Note content: ${content}

Scoring dimensions (Total 10 points):
1. Content Relevance (0-4 points)
- Does it touch the core question, even if briefly
- Contains personal insights or thoughts
- Time relevance of note creation/update

2. Time Dimension (0-3 points)
- Specific time points mentioned
- Time sequence and development
- Note creation time relevance

3. Personal Significance (0-3 points)
- Helps understand user's thoughts
- Timeline continuity and changes
- Experience accumulation span

Please understand:
1. Timestamp at start indicates creation/update time
2. Content may include various time expressions
3. Even brief content can be valuable if time-relevant

Return only a score from 0-10, no explanation.` : `
    作为一个善于理解个人笔记的助手，请深入分析这条笔记与用户问题的关联度。请特别注意时间维度的分析。

问题：${query}
笔记内容：${content}

评分维度（总分10分）：
1. 内容关联（0-4分）
- 是否触及问题核心，即使只是简短的一句话
- 是否包含相关的个人感悟或思考
- 笔记创建/更新时间与问题的时间相关性

2. 时间维度（0-3分）
- 笔记内容中提到的具体时间点
- 笔记记录的时间顺序和发展脉络
- 笔记创建时间的前后关联性

3. 个人意义（0-3分）
- 对理解用户想法的帮助
- 在时间线上的连续性和变化
- 经验积累的时间跨度

请理解：
1. 笔记开头的时间戳表示笔记的创建和更新时间
2. 内容中可能包含各种时间表达：具体日期、相对时间（如"上周"、"去年"）
3. 即使是简短的一句话，只要时间维度相关，也可能具有很高的价值

仅返回0-10的分数，无需解释。`;
} 