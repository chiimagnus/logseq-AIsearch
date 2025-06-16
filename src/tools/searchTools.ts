// 搜索工具模块

import { SearchResult } from '../types/search';
import { calculateRelevanceScore } from './scoreCalculator';

/**
 * 语义搜索 - 块级搜索
 */
export async function semanticSearch(keywords: string[]): Promise<SearchResult[]> {
  try {
    console.log("🚀 [DEBUG] 开始语义搜索, 关键词:", keywords);
    
    const results: SearchResult[] = [];
    // 获取用户设置的最大结果数，如果没有设置则使用默认值 50
    const maxResults: number = typeof logseq.settings?.maxResults === 'number' 
      ? logseq.settings.maxResults 
      : 50;
    
    // 获取用户设置
    const includeParent = logseq.settings?.includeParent ?? true;
    const includeSiblings = logseq.settings?.includeSiblings ?? true;
    const includeChildren = logseq.settings?.includeChildren ?? true;
    
    console.log("⚙️ [DEBUG] 搜索配置:", {
      maxResults,
      includeParent,
      includeSiblings, 
      includeChildren
    });

    for (const keyword of keywords) {
      console.log(`🔍 [DEBUG] 搜索关键词: "${keyword}"`);
      
      const query = `
        [:find (pull ?b [* {:block/page [:block/name :block/journal-day]}])
         :where
         [?b :block/content ?c]
         [(clojure.string/includes? ?c "${keyword}")]]
      `;

      const searchResults = await logseq.DB.datascriptQuery(query);
      console.log(`📈 [DEBUG] 关键词 "${keyword}" 找到 ${searchResults?.length || 0} 个匹配块`);
      
      if (searchResults) {
        for (const result of searchResults) {
          const block = result[0];
          
          // 构建完整内容fullContent，按顺序：页面信息 -> 父块 -> 原块 -> 子块 -> 兄弟块
          let fullContent = '';
          const pageName = block.page?.name || '';
          
          // 1. 添加页面信息和提示语
          fullContent += `这是pagename，如果是时间词，那么就表示这个这个page包含的block内容都是此时间创建的，pagename:${pageName}\n`;

          // 2. 获取父块内容
          let parentContent = '';
          if (block.parent && includeParent) {
            try {
              const parentQuery = `
                [:find (pull ?b [*])
                 :where [?b :block/uuid "${block.parent}"]]
              `;
              const parentBlock = await logseq.DB.datascriptQuery(parentQuery);
              if (parentBlock && parentBlock.length > 0) {
                parentContent = parentBlock[0][0].content;
              }
            } catch (error) {
              console.error("父块查询失败:", error);
            }
          }

          // 3. 获取子块内容
          let childrenContent = '';
          if (includeChildren) {
            try {
              const childrenQuery = `
                [:find (pull ?b [*])
                 :where [?b :block/parent ?parent]
                 [?parent :block/uuid "${block.uuid}"]]
              `;
              const children = await logseq.DB.datascriptQuery(childrenQuery);
              if (children && children.length > 0) {
                childrenContent = children
                  .map((child: any) => child[0].content)
                  .join("\n");
              }
            } catch (error) {
              console.error("子块查询失败:", error);
            }
          }

          // 4. 获取兄弟块内容（只要兄弟块本身，不包含其子块）
          let siblingsContent = '';
          if (block.parent && includeSiblings) {
            try {
              const siblingsQuery = `
                [:find (pull ?b [*])
                 :where 
                 [?b :block/parent ?parent]
                 [?parent :block/uuid "${block.parent}"]
                 [(not= ?b :block/uuid "${block.uuid}")]]
              `;
              const siblings = await logseq.DB.datascriptQuery(siblingsQuery);
              if (siblings && siblings.length > 0) {
                siblingsContent = siblings
                  .map((sibling: any) => sibling[0].content)
                  .join("\n");
              }
            } catch (error) {
              console.error("兄弟块查询失败:", error);
            }
          }

          // 5. 按顺序组装内容：父块 -> 原块 -> 子块 -> 兄弟块
          const contentParts = [
            parentContent,
            block.content,
            childrenContent,
            siblingsContent
          ].filter(part => part.trim()); // 过滤空内容

          fullContent += contentParts.join("\n");

          // 6. 添加调试信息
          console.log("🔍 [DEBUG] 找到匹配块:", {
            blockUuid: block.uuid,
            pageName: pageName,
            originalContent: block.content?.substring(0, 100) + (block.content?.length > 100 ? "..." : ""),
            parentContent: parentContent ? parentContent.substring(0, 50) + (parentContent.length > 50 ? "..." : "") : "无",
            childrenCount: childrenContent ? childrenContent.split('\n').filter(c => c.trim()).length : 0,
            siblingsCount: siblingsContent ? siblingsContent.split('\n').filter(c => c.trim()).length : 0
          });
          
          console.log("📄 [DEBUG] 构建的fullContent:");
          console.log("=" + "=".repeat(80));
          console.log(fullContent);
          console.log("=" + "=".repeat(80));

          // 7. 计算相关性分数
          const importantKeywords = keywords.slice(0, 3);
          const score = calculateRelevanceScore({ ...block, content: fullContent }, keywords, importantKeywords);
          
          console.log("⭐ [DEBUG] 相关性分数:", score, score > 2 ? "(通过)" : "(过滤)");
          console.log("-".repeat(100));
          
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
    const finalResults = Array.from(new Map(
      results
        .sort((a, b) => b.score - a.score)
        .slice(0, maxResults) // 使用用户设置的 maxResults
        .map(item => [item.block.uuid, item])
    ).values());
    
    console.log("✅ [DEBUG] 语义搜索完成:");
    console.log(`📊 总共找到 ${results.length} 个原始匹配，经过评分筛选后保留 ${finalResults.length} 个结果`);
    console.log("🏆 [DEBUG] 最终结果排序:");
    finalResults.forEach((result, index) => {
      console.log(`${index + 1}. [分数:${result.score.toFixed(2)}] ${result.block.content.substring(0, 50)}...`);
    });
    console.log("=" + "=".repeat(100));
    
    return finalResults;
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