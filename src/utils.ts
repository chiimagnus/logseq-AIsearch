export interface SearchResult {
  block: {
    content: string;
    uuid: string;
    parent?: string;
    page?: {
      name: string;
      "journal-day"?: number;
    };
  };
  score: number;
}

export function calculateRelevanceScore(block: any, keywords: string[]): number {
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
      const exactMatchWeight = content.includes(` ${keywordLower} `) ? 1.5 : 1;
      // 密度权重，作用：如果一个关键词在内容中多次出现，密度权重会提高该内容的得分。
      const densityWeight = matches.length > 1 ? 1.2 : 1;
      
      score += 3 * positionWeight * exactMatchWeight * densityWeight;

      // 检查与其他关键词的共现，作用：如果多个关键词在内容中共现，共现权重会提高该内容的得分。
      const hasCoOccurrence = keywordPairs
        .filter(pair => pair.includes(keyword))
        .some(([k1, k2]) => 
          content.includes(k1.toLowerCase()) && content.includes(k2.toLowerCase())
        );
      
      if (hasCoOccurrence) {
        score *= 1.7;
      }
    }
  });

  // 2. 内容长度权重（使用sigmoid函数平滑过渡），作用：内容长度权重用于调整内容长度对得分的影响。较短的内容通常得分更高。
  const idealLength = 300;
  const lengthWeight = 1 / (1 + Math.exp((content.length - idealLength) / 300));
  score *= lengthWeight;

  // 3. 时间衰减因子（使用对数衰减，降低衰减速度）
  if (block.page?.["journal-day"]) {
    const daysAgo = (Date.now() - block.page["journal-day"]) / (1000 * 60 * 60 * 24);
    // 使用对数衰减，一年后权重降为0.9
    score *= Math.max(0.1, 1 - Math.log(daysAgo + 1) / Math.log(365 + 1) * 0.9);
  }

  // 4. 上下文相关性（检查周围内容是否也包含关键词）
  const contextRelevance = keywords.some(keyword => {
    const surroundingContent = content.slice(Math.max(0, content.indexOf(keyword.toLowerCase()) - 50), 
                                          content.indexOf(keyword.toLowerCase()) + keyword.length + 50);
    return keywords.filter(k => k !== keyword)
                  .some(otherKeyword => surroundingContent.includes(otherKeyword.toLowerCase()));
  });
  
  if (contextRelevance) {
    score *= 1.5;
  }

  // 5. 格式权重（标题、列表等特殊格式给予额外权重）
  if (content.startsWith('#') || content.startsWith('- ') || content.startsWith('* ')) {
    score *= 1.3;
  }

  return Math.max(0, Math.min(10, score)); // 限制分数范围在0-10之间
}

export async function semanticSearch(keywords: string[]): Promise<SearchResult[]> {
  try {
    const results: SearchResult[] = [];

    for (const keyword of keywords) {
      const query = `
        [:find (pull ?b [*])
         :where
         [?b :block/content ?c]
         [(clojure.string/includes? ?c "${keyword}")]]
      `;

      const searchResults = await logseq.DB.datascriptQuery(query);
      
      if (searchResults) {
        searchResults.forEach((result: any) => {
          const block = result[0];
          const score = calculateRelevanceScore(block, keywords);
          if (score > 2.0) {
            results.push({
              block,
              score
            });
          }
        });
      }
    }

    // 考虑父块信息
    results.forEach(async result => {
      if (result.block.parent) {
        try {
          const parentQuery = `
            [:find (pull ?b [*])
             :where [?b :block/uuid "${result.block.parent}"]]
          `;
          const parentBlock = await logseq.DB.datascriptQuery(parentQuery);
          if (parentBlock && parentBlock.length > 0) {
            result.block.content = parentBlock[0][0].content + " " + result.block.content;
          }
        } catch (error) {
          console.error("父块查询失败:", error);
        }
      }
    });

    // 按相关度排序并去重
    return Array.from(new Map(
      results
        .sort((a, b) => b.score - a.score)
        .map(item => [item.block.uuid, item])
    ).values());    // .slice(0, 10); // 限制返回数量
  } catch (error) {
    console.error("语义搜索失败:", error);
    return [];
  }
}

