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

    // 🔧 修复：分离已有数据和新数据的管理
    let totalDataCount = existingVectorData.length; // 只记录总数，不保存在内存中
    let indexedCount = 0;
    const startTime = Date.now();
    const batchSize = 15; // 🚀 优化：增加批处理大小
    const saveBatchSize = 500; // 🔧 修复：增加保存阈值，减少保存频率
    
    // 🔧 修复：使用小缓冲区，定期增量保存
    let batchBuffer: VectorData[] = [];
    
    console.log(`🔄 开始处理 ${blocksToIndex.length} 个blocks，批处理大小: ${batchSize}`);
    console.log(`📊 已有数据: ${existingVectorData.length} 条，待索引: ${blocksToIndex.length} 条`);
    
    // 分批处理，添加延迟避免卡顿
    for (let i = 0; i < blocksToIndex.length; i += batchSize) {
      const batch = blocksToIndex.slice(i, i + batchSize);
      const progress = Math.round((indexedCount / blocksToIndex.length) * 100);
      
      // console.log(`📊 [批次 ${Math.floor(i / batchSize) + 1}/${Math.ceil(blocksToIndex.length / batchSize)}] 处理中... (${progress}%)`);

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
            blockContent: processedContent,
            vector: compressedVector,
            lastUpdated: startTime
          };
        } catch (error) {
          console.warn(`⚠️ [失败] Block ${block.uuid.slice(0, 8)}... embedding生成失败:`, error instanceof Error ? error.message : error);
          return null;
        }
      });

      // 等待当前批次完成
      const batchResults = await Promise.all(batchPromises);

      // 过滤掉失败的结果并添加到缓冲区
      const validResults = batchResults.filter((result): result is VectorData => result !== null);
      batchBuffer.push(...validResults);

      indexedCount += batch.length;
      const currentProgress = Math.round((indexedCount / blocksToIndex.length) * 100);

      // 🚀 优化：更频繁的进度更新但减少UI消息
      if (indexedCount % 50 === 0 || indexedCount === blocksToIndex.length) {
        console.log(`📊 [进度] ${currentProgress}% (${indexedCount}/${blocksToIndex.length}) - 缓冲区: ${batchBuffer.length} 条`);
      }

      // 🔧 修复：当缓冲区达到保存阈值时，真正的增量保存
      if (batchBuffer.length >= saveBatchSize || indexedCount === blocksToIndex.length) {
        console.log(`💾 [增量保存] 准备保存 ${batchBuffer.length} 条新数据...`);
        
        // 🔧 修复：真正的增量保存 - 加载现有数据，添加新数据，保存，然后释放内存
        try {
          await saveIncrementalData(batchBuffer, currentProgress);
          
          // 🔧 修复：更新总数但不保存在内存中
          totalDataCount += batchBuffer.length;
          console.log(`✅ [增量保存] 已保存 ${batchBuffer.length} 条新数据，总数据量: ${totalDataCount} 条`);
          
          // 🔧 修复：清空缓冲区释放内存
          batchBuffer = [];
        } catch (saveError) {
          console.error(`❌ [保存失败] ${saveError}`);
          logseq.UI.showMsg(`保存失败: ${saveError}`, "error");
          throw saveError;
        }
      }

      // 🚀 优化：UI进度更新
      if (indexedCount % 200 === 0 || indexedCount === blocksToIndex.length) {
        logseq.UI.showMsg(
          `🔄 ${actionText}索引进度: ${currentProgress}%`,
          "info",
          { timeout: 2000 }
        );
      }

      // 🔧 修复：减少延迟，提高处理速度
      if (i + batchSize < blocksToIndex.length) {
        await new Promise(resolve => setTimeout(resolve, 50)); // 减少到50ms
      }
    }

    console.log(`\n🎉 ===== ${actionText}索引完成 =====`);
    console.log(`📊 最终统计: 总共 ${totalDataCount} 条向量数据`);
    console.log(`===============================\n`);

    logseq.UI.showMsg(
      `🎉 ${actionText}索引完成！\n` +
      `📊 处理: ${indexedCount}个blocks\n` +
      `💾 总数据: ${totalDataCount}条`,
      "success",
      { timeout: 8000 }
    );

  } catch (error) {
    console.error("Failed to index all pages:", error);
    logseq.UI.showMsg("索引建立失败，请检查控制台日志。", "error");
  }
}

// 🚀 新增：真正的增量保存函数
async function saveIncrementalData(newData: VectorData[], progress: number): Promise<void> {
  return new Promise((resolve, reject) => {
    // 使用 setTimeout 将操作推迟到下一个事件循环
    setTimeout(async () => {
      try {
        console.log(`💾 [增量保存] 开始加载现有数据...`);
        
        // 🔧 修复：临时加载现有数据
        const existingData = await loadVectorData();
        console.log(`📊 [增量保存] 现有数据: ${existingData.length} 条，新数据: ${newData.length} 条`);
        
        // 🔧 修复：合并数据
        const mergedData = [...existingData, ...newData];
        console.log(`💾 [增量保存] 开始保存合并数据 ${mergedData.length} 条 (${progress}%)`);
        
        // 🔧 修复：保存合并后的数据
        await saveVectorData(mergedData);
        
        console.log(`✅ [增量保存] 保存完成`);
        resolve();
      } catch (error) {
        console.error(`❌ [增量保存失败] ${error}`);
        reject(error);
      }
    }, 10); // 10ms 延迟，让UI有时间更新
  });
} 