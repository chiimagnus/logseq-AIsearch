// 搜索工具模块

import { SearchResult } from '../types/search';
import { search as vectorSearch } from '../services/vectorService';

/**
 * 向量搜索驱动的搜索函数
 * @param query - 用户的原始查询字符串
 * @returns 搜索结果
 */
export async function timeAwareSearch(query: string): Promise<SearchResult[]> {
  console.log("🚀 [搜索策略] 已切换至向量搜索模式");

  if (!query || query.trim() === '') {
    console.log("🤷‍♂️ [向量搜索] 查询为空，跳过搜索");
    return [];
  }

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