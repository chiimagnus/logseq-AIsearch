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

export async function semanticSearch(keywords: string[]): Promise<SearchResult[]> {
  try {
    const results: SearchResult[] = [];
    // 获取用户设置的最大结果数，如果没有设置则使用默认值 50
    const maxResults: number = typeof logseq.settings?.maxResults === 'number' 
      ? logseq.settings.maxResults 
      : 50;
    
    // 获取用户设置
    const includeParent = logseq.settings?.includeParent ?? true;
    const includeSiblings = logseq.settings?.includeSiblings ?? true;
    const includeChildren = logseq.settings?.includeChildren ?? true;

    for (const keyword of keywords) {
      const query = `
        [:find (pull ?b [* {:block/page [:block/name :block/journal-day]}])
         :where
         [?b :block/content ?c]
         [(clojure.string/includes? ?c "${keyword}")]]
      `;

      const searchResults = await logseq.DB.datascriptQuery(query);
      
      if (searchResults) {
        for (const result of searchResults) {
          const block = result[0];
          
          // 初始化时，获取页面信息并添加到内容前面
          let fullContent = block.content;
          const pageName = block.page?.name || '未知页面';
          
          // 在内容前添加页面信息
          fullContent = `*${pageName}*\n${fullContent}`;

          // 根据用户设置获取父块内容
          if (block.parent && includeParent) {
            try {
              const parentQuery = `
                [:find (pull ?b [*])
                 :where [?b :block/uuid "${block.parent}"]]
              `;
              const parentBlock = await logseq.DB.datascriptQuery(parentQuery);
              if (parentBlock && parentBlock.length > 0) {
                fullContent = parentBlock[0][0].content + "\n" + fullContent;
              }

              // 根据用户设置获取兄弟块内容
              if (includeSiblings) {
                const siblingsQuery = `
                  [:find (pull ?b [*])
                   :where 
                   [?b :block/parent ?parent]
                   [?parent :block/uuid "${block.parent}"]
                   [(not= ?b :block/uuid "${block.uuid}")]]
                `;
                const siblings = await logseq.DB.datascriptQuery(siblingsQuery);
                if (siblings && siblings.length > 0) {
                  const siblingsContent = siblings
                    .map((sibling: any) => sibling[0].content)
                    .join("\n");
                  fullContent = fullContent + "\n--- 相关内容 ---\n" + siblingsContent;
                }
              }
            } catch (error) {
              console.error("父块或兄弟块查询失败:", error);
            }
          }

          // 根据用户设置获取子块内容
          if (includeChildren) {
            try {
              const childrenQuery = `
                [:find (pull ?b [*])
                 :where [?b :block/parent ?parent]
                 [?parent :block/uuid "${block.uuid}"]]
              `;
              const children = await logseq.DB.datascriptQuery(childrenQuery);
              if (children && children.length > 0) {
                const childrenContent = children
                  .map((child: any) => child[0].content)
                  .join("\n");
                fullContent += "\n" + childrenContent;
              }
            } catch (error) {
              console.error("子块查询失败:", error);
            }
          }

          // 4. 计算相关性分数
          const importantKeywords = keywords.slice(0, 3); // 假设你已经在某处提取了重要关键词
          const score = calculateRelevanceScore({ ...block, content: fullContent }, keywords, importantKeywords);
          if (score > 2) {
            results.push({
              block: { ...block, content: fullContent },
              score
            });
          }
        }
      }
    }

    // 按相关度排序并去重
    return Array.from(new Map(
      results
        .sort((a, b) => b.score - a.score)
        .slice(0, maxResults) // 使用用户设置的 maxResults
        .map(item => [item.block.uuid, item])
    ).values());
  } catch (error) {
    console.error("语义搜索失败:", error);
    return [];
  }
}

/**
 * 页面搜索功能 - 优化版本，重点获取页面的完整内容
 * 专门搜索页面名称中包含关键词的页面，并获取页面的完整内容
 */
export async function pageSearch(keywords: string[]): Promise<SearchResult[]> {
  try {
    const results: SearchResult[] = [];
    const maxResults: number = typeof logseq.settings?.maxResults === 'number' 
      ? logseq.settings.maxResults 
      : 50;

    
    
    for (const keyword of keywords) {
      // 搜索页面名称包含关键词的页面
      const pageQuery = `
        [:find (pull ?p [:block/uuid :block/name :block/journal-day])
         :where
         [?p :block/name ?n]
         [(clojure.string/includes? ?n "${keyword}")]]
      `;

      const pageResults = await logseq.DB.datascriptQuery(pageQuery);
      
      if (pageResults) {
        for (const result of pageResults) {
          const page = result[0];
          
          // 获取页面的所有块内容（不只是第一个块）
          const allBlocksQuery = `
            [:find (pull ?b [:block/uuid :block/content :block/properties])
             :where
             [?b :block/page ?p]
             [?p :block/name "${page.name}"]
             [?b :block/parent ?p]]
          `;
          
          const allBlocksResults = await logseq.DB.datascriptQuery(allBlocksQuery);
          
          let pageBlock;
          let fullContent = `*${page.name}*\n`; // 页面名称
          
          if (allBlocksResults && allBlocksResults.length > 0) {
            // 获取页面的所有内容块
            const pageContentBlocks = allBlocksResults
              .map((blockResult: any) => blockResult[0])
              .filter((block: any) => block.content && block.content.trim())
              .slice(0, 10); // 限制前10个块，避免内容过多
            
            if (pageContentBlocks.length > 0) {
              // 使用第一个块作为代表性块
              pageBlock = pageContentBlocks[0];
              
              // 构建完整的页面内容
              const pageContent = pageContentBlocks
                .map((block: any) => block.content)
                .join('\n');
              
              fullContent += pageContent;
              
    
            } else {
              // 页面有块但没有实际内容
              pageBlock = {
                uuid: `page-${page.uuid}-empty`,
                content: `页面: ${page.name}`,
                page: {
                  name: page.name,
                  "journal-day": page["journal-day"] || null
                }
              };
              fullContent += `[页面存在但无实质内容 | Page exists but no substantial content]`;
            }
          } else {
            // 完全空页面
            pageBlock = {
              uuid: `page-${page.uuid}-void`,
              content: `页面: ${page.name}`,
              page: {
                name: page.name,
                "journal-day": page["journal-day"] || null
              }
            };
            fullContent += `[空页面 | Empty page]`;
          }

          // 设置页面信息
          pageBlock.page = {
            name: page.name,
            "journal-day": page["journal-day"] || null
          };

          // 计算相关性分数，页面名称匹配给予更高权重
          const importantKeywords = keywords.slice(0, 3);
          let score = calculateRelevanceScore({ ...pageBlock, content: fullContent }, keywords, importantKeywords);
          
          // 如果页面名称直接包含关键词，给予额外加分
          if (keywords.some(kw => page.name.toLowerCase().includes(kw.toLowerCase()))) {
            score *= 1.8; // 页面名称匹配加权（提高到1.8）
          }
          
          // 如果是日期格式的页面名称，给予额外加分
          if (/\d{4}[-年]\d{1,2}[-月]\d{1,2}日?/.test(page.name) || 
              /\d{1,2}[-月]\d{1,2}日?/.test(page.name) ||
              /\d{4}[/.]\d{1,2}[/.]\d{1,2}/.test(page.name)) {
            score *= 1.5; // 日期页面额外加权
            
          }
          
          if (score > 2) {
            results.push({
              block: { ...pageBlock, content: fullContent },
              score
            });
          }
        }
      }
    }

    const finalResults = Array.from(new Map(
      results
        .sort((a, b) => b.score - a.score)
        .slice(0, maxResults)
        .map(item => [item.block.uuid, item])
    ).values());

    return finalResults;
    
  } catch (error) {
    console.error("页面搜索失败:", error);
    return [];
  }
}

/**
 * 时间优先的综合搜索 - 重构版本
 * 1. 如果有时间词：先用时间词搜索pages和blocks，再用AI关键词在范围内筛选评分
 * 2. 如果没有时间词：直接用AI关键词搜索blocks
 */
export async function timeAwareSearch(timeKeywords: string[], aiKeywords: string[]): Promise<SearchResult[]> {
  try {
    let finalResults: SearchResult[] = [];
    
    // 情况1：有时间关键词 - 分层搜索
    if (timeKeywords.length > 0) {
  
      
      // 第一层：用时间关键词搜索相关的pages和blocks
      console.log("🔍 [阶段1.1] 使用时间关键词搜索pages和blocks...");
      const [timeBlockResults, timePageResults] = await Promise.all([
        semanticSearch(timeKeywords),
        pageSearch(timeKeywords)
      ]);
      
      // 合并时间搜索的初步结果
      const timeFilteredResults = [...timeBlockResults, ...timePageResults];
      console.log("📊 时间关键词搜索到", timeFilteredResults.length, "个相关结果");
      
      if (timeFilteredResults.length === 0) {
        console.log("❌ 时间关键词搜索无结果");
        return [];
      }
      
      // 第二层：如果有AI关键词，在时间过滤的结果中进行AI关键词匹配和评分
      if (aiKeywords.length > 0) {
        console.log("🔍 [阶段1.2] 在时间范围内，使用AI关键词进行精确匹配和评分...");
        
        // 在时间过滤的结果中查找包含AI关键词的内容
        const aiMatchedResults: SearchResult[] = [];
        
        for (const result of timeFilteredResults) {
          const content = result.block.content.toLowerCase();
          
          // 检查是否包含任何AI关键词
          const hasAIKeyword = aiKeywords.some(keyword => 
            content.includes(keyword.toLowerCase())
          );
          
          if (hasAIKeyword) {
            // 重新计算相关性分数，结合时间和AI关键词
            const combinedKeywords = [...timeKeywords, ...aiKeywords];
            const importantKeywords = [...timeKeywords, ...aiKeywords.slice(0, 3)];
            
            const newScore = calculateRelevanceScore(
              result.block, 
              combinedKeywords, 
              importantKeywords
            );
            
            aiMatchedResults.push({
              ...result,
              score: newScore
            });
          }
        }
        
        console.log("📊 AI关键词匹配到", aiMatchedResults.length, "个精确结果");
        
        if (aiMatchedResults.length > 0) {
          finalResults = aiMatchedResults.sort((a, b) => b.score - a.score);
        } else {
          // 如果AI关键词没有匹配到结果，保留时间搜索的结果
          console.log("ℹ️ AI关键词无匹配结果，保留时间搜索结果");
          finalResults = timeFilteredResults;
        }
      } else {
        // 只有时间关键词，没有AI关键词
        console.log("ℹ️ 只有时间关键词，直接返回时间搜索结果");
        finalResults = timeFilteredResults;
      }
      
    } 
    // 情况2：没有时间关键词 - 直接AI关键词搜索
    else if (aiKeywords.length > 0) {
      console.log("📍 [阶段2] 无时间关键词，直接使用AI关键词搜索blocks...");
      const aiBlockResults = await semanticSearch(aiKeywords);
      finalResults = aiBlockResults;
      console.log("📊 AI关键词搜索结果:", finalResults.length, "个（仅blocks）");
    }
    
    // 最终去重和排序
    const maxResults: number = typeof logseq.settings?.maxResults === 'number' 
      ? logseq.settings.maxResults 
      : 50;
      
    const uniqueResults = Array.from(new Map(
      finalResults
        .sort((a, b) => b.score - a.score)
        .slice(0, maxResults)
        .map(item => [item.block.uuid, item])
    ).values());
    
    return uniqueResults;
    
  } catch (error) {
    console.error("时间感知搜索失败:", error);
    return [];
  }
}

export function detectLanguage(text: string): 'en' | 'zh' {
  // 计算英文字符的比例
  const englishChars = text.match(/[a-zA-Z]/g)?.length || 0;
  // 计算中文字符的比例
  const chineseChars = text.match(/[\u4e00-\u9fa5]/g)?.length || 0;
  
  return englishChars > chineseChars ? 'en' : 'zh';
}

