// 相关性评分算法工具

export function calculateRelevanceScore(block: any, keywords: string[], importantKeywords: string[]): number {
  const content = block.content.toLowerCase();
  let score = 0;

  // 1. 关键词匹配和共现分析
  const keywordPairs = keywords.flatMap((k1, i) => 
    keywords.slice(i + 1).map(k2 => [k1, k2])
  );

  keywords.forEach(keyword => {
    const keywordLower = keyword.toLowerCase();
    const matches = [...content.matchAll(new RegExp(keywordLower, 'gi'))];
    
    if (matches.length > 0) {
      // 位置权重，作用：位置权重通过关键词在内容中的位置来影响得分。关键词出现在内容开头通常被认为更重要。
      const positionWeight = Math.exp(-matches[0].index! / 100);
      // 完整匹配权重，作用：如果一个关键词在内容中完整出现，完整匹配权重会提高该内容的得分。
      const exactMatchWeight = content.includes(` ${keywordLower} `) ? 2.0 : 1;
      // 密度权重，作用：如果一个关键词在内容中多次出现，密度权重会提高该内容的得分。
      const densityWeight = matches.length > 1 ? 1.1 : 1;
      
      let keywordScore = 3 * positionWeight * exactMatchWeight * densityWeight;

      // 增加重要关键词的权重
      if (importantKeywords.includes(keyword)) {
        keywordScore *= 1.5; // 提高重要关键词的权重
      }

      score += keywordScore;

      // 检查与其他关键词的共现，作用：如果多个关键词在内容中共现，共现权重会提高该内容的得分。
      const hasCoOccurrence = keywordPairs
        .filter(pair => pair.includes(keyword))
        .some(([k1, k2]) => 
          content.includes(k1.toLowerCase()) && content.includes(k2.toLowerCase())
        );
      
      if (hasCoOccurrence) {
        score *= 2.0; // 提高共现权重
      }
    }
  });

  // 2. 内容长度权重（使用sigmoid函数平滑过渡），作用：内容长度权重用于调整内容长度对得分的影响。较短的内容通常得分更高。
  const idealLength = 300;
  const lengthWeight = 1 / (1 + Math.exp((content.length - idealLength) / 300)); // 调整平滑参数
  score *= lengthWeight;

  // 3. 上下文相关性（检查周围内容是否也包含关键词）
  const contextRelevance = keywords.some(keyword => {
    const surroundingContent = content.slice(Math.max(0, content.indexOf(keyword.toLowerCase()) - 50), 
                                          content.indexOf(keyword.toLowerCase()) + keyword.length + 50);
    return keywords.filter(k => k !== keyword)
                  .some(otherKeyword => surroundingContent.includes(otherKeyword.toLowerCase()));
  });
  
  if (contextRelevance) {
    score *= 1.7; // 提高上下文相关性权重
  }

  // 4. 格式权重（标题、列表等特殊格式给予额外权重）
  if (content.startsWith('#') || content.startsWith('- ') || content.startsWith('* ') || content.startsWith('[[')) {
    score *= 1.4; // 适当提高格式权重
  }

  // 5. 层级权重（父块、当前块、子块的权重不同）
  const blockType = content.includes('--- 相关内容 ---') ? 'sibling' : 
                   content === block.content ? 'current' : 
                   'child';

  const hierarchyWeight = {
    current: 1.5,  // 当前块权重最高
    sibling: 1.2,  // 兄弟块次之
    child: 1.0     // 子块权重最低
  };

  score *= hierarchyWeight[blockType];

  return Math.max(0, Math.min(10, score)); // 限制分数范围在0-10之间
} 