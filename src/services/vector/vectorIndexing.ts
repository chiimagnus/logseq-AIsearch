// 向量索引服务

import { VectorData, VectorDatabase, BlockWithPage } from '../../types/vector';
import { generateEmbedding } from './embeddingService';
import { saveVectorData, loadVectorData, hasVectorData } from './vectorStorage';
import { getAllBlocksWithPage, preprocessContent } from '../../tools/content/contentProcessor';

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
    const saveBatchSize = 300; // 更频繁保存，减少数据丢失风险

    // 内存管理：定期清理和强制垃圾回收
    const memoryCleanupInterval = 2000; // 每2000个blocks清理一次内存
    
    // 分批处理，添加延迟避免卡顿
    for (let i = 0; i < blocksToIndex.length; i += batchSize) {
      try {
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

        // 显示详细进度
        const progress = Math.round((indexedCount / blocksToIndex.length) * 100);

        // 更频繁的进度显示，特别是在接近完成时
        if (indexedCount % 100 === 0 || indexedCount === blocksToIndex.length || progress >= 90) {
          const timeElapsed = Date.now() - startTime;
          const avgTimePerBlock = timeElapsed / indexedCount;
          const remainingBlocks = blocksToIndex.length - indexedCount;
          const estimatedTimeRemaining = Math.round((avgTimePerBlock * remainingBlocks) / 1000);

          console.log(`📊 [进度] ${progress}% (${indexedCount}/${blocksToIndex.length}) - 预计剩余: ${estimatedTimeRemaining}秒`);

          // 在90%以上时提供更详细的信息
          if (progress >= 90) {
            console.log(`🔍 [详细] 当前向量数据量: ${vectorData.length}, 批次: ${Math.floor(i / batchSize) + 1}/${Math.ceil(blocksToIndex.length / batchSize)}`);
          }
        }

        if (indexedCount % 1000 === 0 || indexedCount === blocksToIndex.length) {
          logseq.UI.showMsg(
            `🔄 ${actionText}索引进度: ${progress}%`,
            "info",
            { timeout: 3000 }
          );
        }

        // 每处理saveBatchSize个blocks就保存一次（增量保存）
        if (indexedCount % saveBatchSize === 0 || indexedCount === blocksToIndex.length) {
          console.log(`💾 [保存] 开始保存 ${vectorData.length} 条向量数据...`);

          try {
            await saveVectorData(vectorData);
            console.log(`✅ [保存] 成功保存 ${vectorData.length} 条向量数据`);
          } catch (saveError) {
            console.error(`❌ [保存失败] 保存向量数据时出错:`, saveError);

            // 保存失败时的处理策略
            if (saveError instanceof Error && saveError.message.includes('quota')) {
              logseq.UI.showMsg("❌ 存储空间不足，请清理Assets文件夹", "error", { timeout: 8000 });
              throw new Error("存储空间不足");
            } else {
              logseq.UI.showMsg("⚠️ 数据保存失败，但索引继续进行", "warning", { timeout: 5000 });
              // 继续处理，不中断索引过程
            }
          }
        }

        // 内存清理：定期触发垃圾回收
        if (indexedCount % memoryCleanupInterval === 0 && indexedCount > 0) {
          console.log(`🧹 [内存清理] 已处理 ${indexedCount} 个blocks，触发内存清理`);

          // 强制垃圾回收（如果可用）- 兼容浏览器和Node.js环境
          try {
            if (typeof window !== 'undefined' && (window as any).gc) {
              // 浏览器环境
              (window as any).gc();
            } else if (typeof global !== 'undefined' && global.gc) {
              // Node.js环境
              global.gc();
            }
          } catch (gcError) {
            // 垃圾回收不可用，忽略错误
            console.log(`ℹ️ [内存清理] 垃圾回收不可用，跳过`);
          }

          // 添加短暂延迟让垃圾回收完成
          await new Promise(resolve => setTimeout(resolve, 200));
        }

        // 添加延迟避免UI卡顿，让主线程有时间处理其他任务
        if (i + batchSize < blocksToIndex.length) {
          await new Promise(resolve => setTimeout(resolve, 100)); // 100ms延迟
        }

      } catch (batchError) {
        console.error(`❌ [批次失败] 处理批次 ${i}-${i + batchSize} 时出错:`, batchError);

        // 批次失败时跳过当前批次，继续处理下一批次
        indexedCount += batchSize;

        logseq.UI.showMsg(
          `⚠️ 跳过失败的批次，继续索引...`,
          "warning",
          { timeout: 3000 }
        );

        continue;
      }
    }

    // 最终保存确认
    console.log(`💾 [最终保存] 确保所有数据已保存...`);
    try {
      await saveVectorData(vectorData);
      console.log(`✅ [最终保存] 成功保存最终数据: ${vectorData.length} 条向量`);
    } catch (finalSaveError) {
      console.error(`❌ [最终保存失败]`, finalSaveError);
      logseq.UI.showMsg("⚠️ 索引完成但最终保存失败，请手动重新保存", "warning", { timeout: 8000 });
    }

    const totalTime = Math.round((Date.now() - startTime) / 1000);

    console.log(`\n🎉 ===== ${actionText}索引完成 =====`);
    console.log(`📊 统计信息:`);
    console.log(`   • 处理blocks: ${indexedCount}/${blocksToIndex.length}`);
    console.log(`   • 成功向量: ${vectorData.length}`);
    console.log(`   • 总耗时: ${totalTime}秒`);
    console.log(`   • 平均速度: ${(indexedCount / totalTime).toFixed(2)} blocks/秒`);
    console.log(`===============================\n`);

    logseq.UI.showMsg(
      `🎉 ${actionText}索引完成！\n` +
      `📊 处理: ${indexedCount}个blocks\n` +
      `⏱️ 耗时: ${totalTime}秒`,
      "success",
      { timeout: 8000 }
    );

  } catch (error) {
    console.error("Failed to index all pages:", error);
    logseq.UI.showMsg("索引建立失败，请检查控制台日志。", "error");
  }
} 