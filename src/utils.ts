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

  // 1. 关键词匹配度
  keywords.forEach(keyword => {
    const keywordCount = (content.match(new RegExp(keyword.toLowerCase(), 'gi')) || []).length;
    score += keywordCount * 2;
  });

  // 2. 内容长度权重 (避免过长内容)
  score *= (1 / Math.log(content.length + 1));

  // 3. 时间衰减因子
  if (block.page?.["journal-day"]) {
    const daysAgo = (Date.now() - block.page["journal-day"]) / (1000 * 60 * 60 * 24);
    score *= Math.exp(-daysAgo / 365); 
  }

  return score;
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
          results.push({
            block,
            score: calculateRelevanceScore(block, keywords)
          });
        });
      }
    }

    // 按相关度排序并去重
    return Array.from(new Map(
      results
        .sort((a, b) => b.score - a.score)
        .map(item => [item.block.uuid, item])
    ).values())
    .slice(0, 10); // 限制返回数量
  } catch (error) {
    console.error("语义搜索失败:", error);
    return [];
  }
}

