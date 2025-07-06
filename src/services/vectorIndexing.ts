// 向量索引服务

import { VectorData, VectorDatabase, BlockWithPage } from '../types/vector';
import { generateEmbedding } from './embeddingService';
import { saveVectorData, loadVectorData, hasVectorData } from './vectorStorage';
import { getAllBlocksWithPage, preprocessContent } from '../tools/contentProcessor';

// 向量精度压缩（减少小数位数）
function compressVector(vector: number[]): number[] {
  return vector.map(v => Math.round(v * 10000) / 10000); // 保留4位小数
}

// 索引所有页面（重新索引）
export async function indexAllPages(): Promise<void> {
  return await indexPages(false);
}

// 继续索引（增量索引）
export async function continueIndexing(): Promise<void> {
  return await indexPages(true);
}

// 核心索引函数
async function indexPages(isContinue: boolean = false): Promise<void> {
  try {
    const actionText = isContinue ? "继续建立" : "重新建立";
    logseq.UI.showMsg(`开始${actionText}向量索引...`, "success");
    console.log(`\n🚀 ===== ${actionText}向量索引 =====`);

    const allBlocks = await getAllBlocksWithPage();
    if (!allBlocks || allBlocks.length === 0) {
      logseq.UI.showMsg("没有需要索引的内容。", "warning");
      console.log("❌ 未找到需要索引的blocks");
      return;
    }

    // 加载现有向量数据
    let existingVectorData: VectorDatabase = [];
    let blocksToIndex: BlockWithPage[] = [];

    if (isContinue) {
      existingVectorData = await loadVectorData();

      // 检查是否存在数据文件但加载失败的情况
      const hasDataFile = await hasVectorData();

      if (hasDataFile && existingVectorData.length === 0) {
        console.warn("⚠️ 检测到向量数据文件存在但加载失败，可能数据已损坏");

        logseq.UI.showMsg(
          "⚠️ 检测到向量数据文件存在但无法加载，可能是索引过程被中断导致数据损坏。\n" +
          "将自动清除损坏的数据并重新开始索引...",
          "warning",
          { timeout: 5000 }
        );

        // 等待用户看到消息
        await new Promise(resolve => setTimeout(resolve, 2000));

        console.log("🔄 自动清除损坏数据并重新索引");
        await saveVectorData([]);
        existingVectorData = [];
        blocksToIndex = allBlocks;
        console.log(`📊 重新索引统计: 总共${allBlocks.length}个blocks`);
      } else {
        const existingUUIDs = new Set(existingVectorData.map(item => item.blockUUID));

        // 只索引新的blocks
        blocksToIndex = allBlocks.filter(block => !existingUUIDs.has(block.uuid));

        console.log(`📊 继续索引统计:`);
        console.log(`   • 总blocks: ${allBlocks.length}`);
        console.log(`   • 已索引: ${existingVectorData.length}`);
        console.log(`   • 待索引: ${blocksToIndex.length}`);

        if (blocksToIndex.length === 0) {
          logseq.UI.showMsg("所有内容都已索引完成！", "success");
          console.log("✅ 所有blocks都已索引，无需继续");
          return;
        }
      }
    } else {
      // 重新索引所有blocks
      blocksToIndex = allBlocks;
      console.log(`📊 重新索引统计: 总共${allBlocks.length}个blocks`);

      // 清除旧数据
      await saveVectorData([]);
      console.log("🗑️ 已清除旧的向量数据");
    }

    let vectorData: VectorDatabase = [...existingVectorData];
    let indexedCount = 0;
    const startTime = Date.now();
    const batchSize = 10; // 批处理大小
    const saveBatchSize = 500; // 减少保存频率，提高性能
    
    // 分批处理，添加延迟避免卡顿
    for (let i = 0; i < blocksToIndex.length; i += batchSize) {
      const batch = blocksToIndex.slice(i, i + batchSize);

      // 并行处理当前批次
      const batchPromises = batch.map(async (block) => {
        try {
          // 使用预处理后的内容生成embedding
          const processedContent = preprocessContent(block.content);
          const vector = await generateEmbedding(processedContent);
          const compressedVector = compressVector(vector);

          return {
            blockUUID: block.uuid,
            pageName: block.pageName,
            blockContent: processedContent, // 存储预处理后的内容
            vector: compressedVector, // 存储压缩后的向量
            lastUpdated: startTime
          };
        } catch (error) {
          console.warn(`⚠️ [失败] Block ${block.uuid.slice(0, 8)}... embedding生成失败:`, error instanceof Error ? error.message : error);
          return null; // 标记为失败
        }
      });
      
      // 等待当前批次完成
      const batchResults = await Promise.all(batchPromises);

      // 过滤掉失败的结果并添加到vectorData
      const validResults = batchResults.filter((result): result is VectorData => result !== null);
      vectorData.push(...validResults);

      indexedCount += batch.length;

      // 添加延迟避免UI卡顿，让主线程有时间处理其他任务
      if (i + batchSize < blocksToIndex.length) {
        await new Promise(resolve => setTimeout(resolve, 100)); // 100ms延迟
      }
      
      // 每处理saveBatchSize个blocks就保存一次（增量保存）
      if (indexedCount % saveBatchSize === 0 || indexedCount === blocksToIndex.length) {
        await saveVectorData(vectorData);
        // console.log(`💾 [保存] 已保存 ${vectorData.length} 条向量数据`);
      }

      // 显示详细进度
      const progress = Math.round((indexedCount / blocksToIndex.length) * 100);

      if (indexedCount % 1000 === 0 || indexedCount === blocksToIndex.length) {
        console.log(`\n📊 [进度] ${progress}% (${indexedCount}/${blocksToIndex.length})`);

        logseq.UI.showMsg(
          `🔄 ${actionText}索引进度: ${progress}%`,
          "info",
          { timeout: 3000 }
        );
      }
    }

    console.log(`\n🎉 ===== ${actionText}索引完成 =====`);
    console.log(`===============================\n`);

    logseq.UI.showMsg(
      `🎉 ${actionText}索引完成！\n` +
      `📊 处理: ${indexedCount}个blocks`,
      "success",
      { timeout: 8000 }
    );

  } catch (error) {
    console.error("Failed to index all pages:", error);
    logseq.UI.showMsg("索引建立失败，请检查控制台日志。", "error");
  }
} 