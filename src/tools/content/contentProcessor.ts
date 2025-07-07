// 内容处理工具（索引前处理：过滤、去重）

import { BlockEntity } from '@logseq/libs/dist/LSPlugin';
import { BlockWithPage } from '../../types/vector';

// 内容预处理函数
export function preprocessContent(content: string): string {
  // 移除多余的空白字符
  content = content.replace(/\s+/g, ' ').trim();

  // 移除logseq特殊语法，保留核心内容
  content = content.replace(/\[\[([^\]]+)\]\]/g, '$1'); // 移除双括号链接
  content = content.replace(/#\w+/g, ''); // 移除标签
  content = content.replace(/\*\*([^*]+)\*\*/g, '$1'); // 移除粗体标记
  content = content.replace(/\*([^*]+)\*/g, '$1'); // 移除斜体标记

  return content.trim();
}

// 检查内容是否值得索引
export function isContentWorthIndexing(content: string): boolean {
  const processed = preprocessContent(content);

  // 过滤条件
  if (processed.length < 10) return false; // 太短
  if (processed.length > 2000) return false; // 太长，可能是代码块
  if (/^[\d\s\-\.\,]+$/.test(processed)) return false; // 只包含数字和符号
  if (/^https?:\/\//.test(processed)) return false; // 只是URL

  return true;
}

// 获取所有页面中的 Block
export async function getAllBlocksWithPage(): Promise<BlockWithPage[]> {
  try {
    const allPages = await logseq.Editor.getAllPages();
    if (!allPages) {
      return [];
    }

    let allBlocks: BlockWithPage[] = [];
    const seenContent = new Set<string>(); // 用于去重

    for (const page of allPages) {
      const pageBlocks = await logseq.Editor.getPageBlocksTree(page.name);
      if (pageBlocks) {
        const flattenedBlocks = flattenBlocks(pageBlocks).map(block => ({
          uuid: block.uuid,
          content: block.content,
          pageName: page.name
        }));
        allBlocks = allBlocks.concat(flattenedBlocks);
      }
    }

    // 智能过滤和去重
    const filteredBlocks = allBlocks.filter(block => {
      if (!block.content || block.content.trim() === '') return false;

      // 检查内容是否值得索引
      if (!isContentWorthIndexing(block.content)) return false;

      // 去重：基于预处理后的内容
      const processedContent = preprocessContent(block.content);
      if (seenContent.has(processedContent)) return false;

      seenContent.add(processedContent);
      return true;
    });

    console.log(`📊 内容过滤统计: 原始${allBlocks.length}个blocks → 过滤后${filteredBlocks.length}个blocks`);
    return filteredBlocks;

  } catch (error) {
    console.error("Error getting all blocks:", error);
    return [];
  }
}

// 递归展平 Block 树结构
function flattenBlocks(blocks: BlockEntity[]): BlockEntity[] {
  let flattened: BlockEntity[] = [];
  for (const block of blocks) {
    flattened.push(block);
    if (block.children && block.children.length > 0) {
      flattened = flattened.concat(flattenBlocks(block.children as BlockEntity[]));
    }
  }
  return flattened;
} 