// 向量索引服务

import { VectorData, VectorDatabase, BlockWithPage } from '../../types/vector';
import { generateEmbedding } from './embeddingService';
import { loadVectorData, saveVectorData, clearVectorData } from './vectorStorage';
import { getAllBlocksWithPage, preprocessContent } from '../../tools/contentProcessor';

// 向量精度压缩（减少小数位数）
function compressVector(vector: number[]): number[] {
  return vector.map(v => Math.round(v * 10000) / 10000); // 保留4位小数
}

// 索引所有页面（重新索引）
export async function indexAllPages(): Promise<void> {
  await indexPages(false);
}

// 继续索引（增量索引）
export async function continueIndexing(): Promise<void> {
  await indexPages(true, false);
}

// 静默增量索引（用于自动增量索引）
export async function silentIncrementalIndexing(): Promise<void> {
  await indexPages(true, true);
}

// 核心索引函数
async function indexPages(isContinue: boolean = false, silent: boolean = false): Promise<void> {
  try {
    const actionText = isContinue ? "继续建立" : "重新建立";
    if (!silent) {
      logseq.UI.showMsg(`开始${actionText}向量索引...`, "success");
    }
    console.log(`\n🚀 ===== ${actionText}向量索引${silent ? ' (静默模式)' : ''} =====`);

    const allBlocks = await getAllBlocksWithPage();
    if (!allBlocks || allBlocks.length === 0) {
      logseq.UI.showMsg("没有需要索引的内容。", "warning");
      console.log("❌ 未找到需要索引的blocks");
      return;
    }

    let existingVectorData: VectorDatabase = [];
    let blocksToIndex: BlockWithPage[] = [];

    if (isContinue) {
      existingVectorData = await loadVectorData();
      
      const existingUUIDs = new Set(existingVectorData.map(item => item.blockUUID));
      blocksToIndex = allBlocks.filter(block => !existingUUIDs.has(block.uuid));

      console.log(`📊 继续索引统计:`);
      console.log(`   • 总blocks: ${allBlocks.length}`);
      console.log(`   • 已索引: ${existingVectorData.length}`);
      console.log(`   • 待索引: ${blocksToIndex.length}`);

      if (blocksToIndex.length === 0) {
        if (!silent) {
          logseq.UI.showMsg("所有内容都已索引完成！", "success");
        }
        console.log("✅ 所有blocks都已索引，无需继续");
        return;
      }
    } else {
      console.log(`📊 重新索引统计: 总共${allBlocks.length}个blocks`);
      await clearVectorData(); // 重新索引前彻底清除旧数据
      blocksToIndex = allBlocks;
    }

    let indexedCount = 0;
    const startTime = Date.now();
    const batchSize = 15;
    const saveInterval = 500; // 每500个保存一次
    let newVectorData: VectorData[] = [];
    
    console.log(`🔄 开始处理 ${blocksToIndex.length} 个blocks...`);
    
    for (let i = 0; i < blocksToIndex.length; i += batchSize) {
      const batch = blocksToIndex.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (block) => {
        try {
          const processedContent = preprocessContent(block.content);
          if (!processedContent) return null;
          const vector = await generateEmbedding(processedContent);
          const compressedVector = compressVector(vector);

          return {
            blockUUID: block.uuid,
            pageName: block.pageName,
            blockContent: processedContent,
            vector: compressedVector,
            lastUpdated: startTime
          };
        } catch (error) {
          console.warn(`⚠️ [失败] Block ${block.uuid.slice(0, 8)}... embedding生成失败:`, error instanceof Error ? error.message : error);
          return null;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      const validResults = batchResults.filter((result): result is VectorData => result !== null);
      newVectorData.push(...validResults);
      indexedCount += batch.length;
      
      const currentProgress = Math.round((indexedCount / blocksToIndex.length) * 100);

      if (indexedCount % 50 === 0 || indexedCount === blocksToIndex.length) {
        console.log(`📊 [进度] ${currentProgress}% (${indexedCount}/${blocksToIndex.length}) - 新数据: ${newVectorData.length} 条`);
      }

      // 定期保存进度，避免数据丢失
      if (newVectorData.length >= saveInterval || indexedCount === blocksToIndex.length) {
        console.log(`💾 [保存进度] 准备保存 ${existingVectorData.length + newVectorData.length} 条向量数据...`);
        try {
          const allVectorData = [...existingVectorData, ...newVectorData];
          await saveVectorData(allVectorData);
          console.log(`✅ [进度已保存] 总数据量: ${allVectorData.length} 条`);
          
          // 更新现有数据并清空新数据缓冲区
          existingVectorData = allVectorData;
          newVectorData = [];
        } catch (saveError) {
          console.error(`❌ [保存失败] ${saveError}`);
          logseq.UI.showMsg(`索引保存失败: ${saveError}`, "error");
          throw saveError; // 停止索引
        }
      }

      if (!silent && (indexedCount % 200 === 0 || indexedCount === blocksToIndex.length)) {
        logseq.UI.showMsg(`🔄 ${actionText}索引进度: ${currentProgress}%`, "info", { timeout: 2000 });
      }

      if (i + batchSize < blocksToIndex.length) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }

    const totalDataCount = existingVectorData.length;

    console.log(`\n🎉 ===== ${actionText}索引完成 =====`);
    console.log(`📊 最终统计: 总共 ${totalDataCount} 条向量数据`);
    console.log(`===============================\n`);

    if (!silent) {
      logseq.UI.showMsg(
        `🎉 ${actionText}索引完成！\n` +
        `📊 处理: ${indexedCount}个blocks\n` +
        `💾 总数据: ${totalDataCount}条`,
        "success",
        { timeout: 8000 }
      );
    }

  } catch (error) {
    console.error("索引失败:", error);
    logseq.UI.showMsg("索引建立失败，请检查控制台日志。", "error");
  }
} 