// 搜索工具模块

import { SearchResult } from '../types/search';
import { search as vectorSearch } from '../services/vectorService';

/**
 * 时间感知搜索 - 现在完全由向量搜索驱动
 * @param timeKeywords - 时间关键词（当前未使用，但保留接口）
 * @param aiKeywords - AI提取的关键词
 * @returns 搜索结果
 */
export async function timeAwareSearch(timeKeywords: string[], aiKeywords: string[]): Promise<SearchResult[]> {
  console.log("🚀 [搜索策略] 已切换至向量搜索模式");

  if (aiKeywords.length === 0) {
    console.log("🤷‍♂️ [向量搜索] 关键词为空，跳过搜索");
    return [];
  }

  // 将关键词数组合并为单个查询字符串
  const query = aiKeywords.join(' ');
  console.log(`🔍 [向量搜索] 使用查询: "${query}"`);

  try {
    const maxResults: number = typeof logseq.settings?.maxResults === 'number' 
      ? logseq.settings.maxResults 
      : 50;

    // 调用向量搜索服务
    const vectorResults = await vectorSearch(query, maxResults);

    if (!vectorResults || vectorResults.length === 0) {
      console.log("😞 [向量搜索] 未找到任何结果");
      return [];
    }
    
    console.log(`✅ [向量搜索] 找到 ${vectorResults.length} 个结果`);

    // 将向量搜索结果转换为 SearchResult[] 格式
    const searchResults: SearchResult[] = vectorResults.map(result => ({
      block: {
        uuid: result.blockUUID,
        content: result.blockContent,
        page: {
          name: result.pageName,
        }
      },
      score: result.score,
    }));

    return searchResults;

  } catch (error) {
    console.error("💥 [向量搜索] 执行期间发生错误:", error);
    return [];
  }
} 