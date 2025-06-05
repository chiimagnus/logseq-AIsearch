export function getSummaryPrompt(query: string, content: string, lang: 'zh' | 'en', timeContextInfo?: string): string {
  const basePrompt = lang === 'en' ? `
    As your friendly life secretary, I'll help analyze the notes related to your question "${query}". Here's the content to analyze: ${content}

First, evaluate if there's enough meaningful content to summarize:
1. Check if the notes contain substantial information:
   - Are there multiple distinct ideas or experiences?
   - Is there enough context to understand the topic?
   - Are there meaningful insights or reflections?
2. If the content is insufficient (e.g., too brief, lacks context, or contains no meaningful insights), respond with:
   "The available notes are too limited for a comprehensive summary. Consider adding more detailed notes about this topic."

If there's enough content, then analyze as follows:
1. Directly related notes (no need for original content)
   - Notice *timeline* connections
   - Extract key brief ideas
   - Focus on personal insights
2. Context supplementation
   - Combine related notes context
   - Add necessary background
3. Personal insight integration
   - Connect scattered thoughts
   - Summarize experiences and lessons
   - Extract valuable insights

Please respond naturally, as if sharing insights with a friend.` : `
    作为你的贴心小助手，我来帮你分析与问题"${query}"相关的笔记内容。以下是需要分析的内容：${content}

首先，让我们评估一下内容是否足够进行总结：
1. 检查笔记是否包含足够的有意义信息：
   - 是否包含多个不同的想法或经历？
   - 是否有足够的上下文来理解主题？
   - 是否包含有价值的见解或思考？
2. 如果内容不足（例如：过于简短、缺乏上下文、或没有实质性的见解），请回复：
   "当前相关笔记内容较少，无法进行全面的总结。建议添加更多关于该主题的详细笔记。"

如果内容充足，则按以下方式分析：
1. 直接相关的笔记内容分析
   - 注意*时间线*上的关联
   - 提取关键的简短想法
   - 关注个人感悟和思考
2. 上下文补充
   - 结合相关笔记的上下文
   - 补充必要的背景信息
3. 个人见解整合
   - 将零散的想法串联
   - 总结个人经验和教训
   - 提炼有价值的思考

请用简洁自然的语言回答，就像在和朋友分享见解一样。`;

  // 如果有时间上下文信息，添加到 prompt 中
  if (timeContextInfo) {
    const timeContextSuffix = lang === 'en'
      ? `\n\n${timeContextInfo}\nPlease pay special attention to time-related information and development patterns in your summary.`
      : `\n\n${timeContextInfo}\n请在总结中特别关注时间相关的信息和发展脉络。`;
    
    return basePrompt + timeContextSuffix;
  }

  return basePrompt;
} 