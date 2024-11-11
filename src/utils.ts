export interface SearchResult {
  block: {
    content: string;
    uuid: string;
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

  // 1. 关键词匹配度（考虑位置权重）
  keywords.forEach(keyword => {
    const keywordLower = keyword.toLowerCase();
    const matches = [...content.matchAll(new RegExp(keywordLower, 'gi'))];
    
    matches.forEach(match => {
      if (match.index !== undefined) {
        // 标题权重：如果关键词出现在内容开始部分，给予更高权重
        const positionWeight = Math.exp(-match.index / 100);
        // 完整匹配权重：优先完整词匹配而不是部分匹配
        const exactMatchWeight = content.includes(` ${keywordLower} `) ? 1.5 : 1;
        // 关键词密度权重：考虑相邻关键词的距离
        const densityWeight = matches.length > 1 ? 1.2 : 1;
        
        score += 2 * positionWeight * exactMatchWeight * densityWeight;
      }
    });
  });

  // 2. 内容长度权重（使用sigmoid函数平滑过渡）
  const idealLength = 500; // 理想内容长度
  const lengthWeight = 1 / (1 + Math.exp((content.length - idealLength) / 500));
  score *= lengthWeight;

  // 3. 时间衰减因子（使用对数衰减，降低衰减速度）
  if (block.page?.["journal-day"]) {
    const daysAgo = (Date.now() - block.page["journal-day"]) / (1000 * 60 * 60 * 24);
    // 使用对数衰减，一年后权重降为0.5
    score *= Math.max(0.1, 1 - Math.log(daysAgo + 1) / Math.log(365 + 1));
  }

  // 4. 上下文相关性（检查周围内容是否也包含关键词）
  const contextRelevance = keywords.some(keyword => {
    const surroundingContent = content.slice(Math.max(0, content.indexOf(keyword.toLowerCase()) - 50), 
                                          content.indexOf(keyword.toLowerCase()) + keyword.length + 50);
    return keywords.filter(k => k !== keyword)
                  .some(otherKeyword => surroundingContent.includes(otherKeyword.toLowerCase()));
  });
  
  if (contextRelevance) {
    score *= 1.3;
  }

  // 5. 格式权重（标题、列表等特殊格式给予额外权重）
  if (content.startsWith('#') || content.startsWith('- ') || content.startsWith('* ')) {
    score *= 1.2;
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

    // 按相关度排序并去重
    return Array.from(new Map(
      results
        .sort((a, b) => b.score - a.score)
        .map(item => [item.block.uuid, item])
    ).values())
    // .slice(0, 10); // 限制返回数量
  } catch (error) {
    console.error("语义搜索失败:", error);
    return [];
  }
}

