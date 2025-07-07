// 向量索引服务

import { VectorData, VectorDatabase, BlockWithPage } from '../../types/vector';
import { generateEmbedding } from './embeddingService';
import { loadVectorData, saveVectorData, clearVectorData, incrementalSaveVectorData, deleteVectorDataFromShards, updateVectorDataInShards } from './vectorStorage';
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

      // 🚀 智能增量索引：检测新增、修改、删除的blocks
      const { newBlocks, modifiedBlocks, deletedBlocks, validVectorData } = await analyzeBlockChanges(allBlocks, existingVectorData);

      // 🚀 精确处理删除和修改操作
      if (deletedBlocks.length > 0) {
        console.log(`🗑️ 从分片中精确删除 ${deletedBlocks.length} 个blocks的向量数据`);
        const deletedUUIDs = deletedBlocks.map(block => block.blockUUID);
        await deleteVectorDataFromShards(deletedUUIDs);
      }

      if (modifiedBlocks.length > 0) {
        console.log(`🔄 从分片中删除 ${modifiedBlocks.length} 个已修改blocks的旧向量数据`);
        const modifiedUUIDs = modifiedBlocks.map(block => block.uuid);
        await deleteVectorDataFromShards(modifiedUUIDs);
      }

      // 更新现有向量数据（已经通过分片操作更新）
      existingVectorData = validVectorData.filter(item => {
        const deletedUUIDs = new Set(deletedBlocks.map(b => b.blockUUID));
        const modifiedUUIDs = new Set(modifiedBlocks.map(b => b.uuid));
        return !deletedUUIDs.has(item.blockUUID) && !modifiedUUIDs.has(item.blockUUID);
      });

      // 需要索引的blocks = 新增的 + 修改的
      blocksToIndex = [...newBlocks, ...modifiedBlocks];

      console.log(`📊 精确增量索引统计:`);
      console.log(`   • 总blocks: ${allBlocks.length}`);
      console.log(`   • 有效已索引: ${existingVectorData.length}`);
      console.log(`   • 新增blocks: ${newBlocks.length}`);
      console.log(`   • 修改blocks: ${modifiedBlocks.length}`);
      console.log(`   • 删除blocks: ${deletedBlocks.length}`);
      console.log(`   • 待索引: ${blocksToIndex.length}`);

      if (deletedBlocks.length > 0 && !silent) {
        console.log(`✅ 已从分片中精确删除 ${deletedBlocks.length} 个blocks的向量数据`);
      }

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
        try {
          if (isContinue) {
            // 🚀 增量索引：使用分片追加保存，只保存新数据
            console.log(`💾 [分片追加] 保存 ${newVectorData.length} 条新数据，无需重写 ${existingVectorData.length} 条已存在数据`);
            await incrementalSaveVectorData(newVectorData, existingVectorData);
          } else {
            // 全量重建索引：全量保存
            console.log(`💾 [全量保存] 准备保存 ${existingVectorData.length + newVectorData.length} 条向量数据...`);
            const allVectorData = [...existingVectorData, ...newVectorData];
            await saveVectorData(allVectorData);
          }

          console.log(`✅ [进度已保存] 总数据量: ${existingVectorData.length + newVectorData.length} 条`);

          // 更新现有数据并清空新数据缓冲区
          existingVectorData = [...existingVectorData, ...newVectorData];
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

    // 🚀 增量索引已经实时保存到磁盘，无需额外操作
    if (isContinue) {
      console.log(`✅ 增量索引数据已实时保存到磁盘`);
    }

    console.log(`\n🎉 ===== ${actionText}索引完成 =====`);
    console.log(`📊 最终统计: 总共 ${totalDataCount} 条向量数据`);
    console.log(`===============================\n`);

    if (!silent) {
      const message = isContinue ?
        `🎉 智能增量索引完成！\n📊 处理: ${indexedCount}个blocks\n💾 总数据: ${totalDataCount}条` :
        `🎉 ${actionText}索引完成！\n📊 处理: ${indexedCount}个blocks\n💾 总数据: ${totalDataCount}条`;

      logseq.UI.showMsg(message, "success", { timeout: 8000 });
    }

  } catch (error) {
    console.error("索引失败:", error);
    logseq.UI.showMsg("索引建立失败，请检查控制台日志。", "error");
  }
}

// 🚀 智能分析blocks变化：检测新增、修改、删除的blocks
export async function analyzeBlockChanges(
  currentBlocks: BlockWithPage[],
  existingVectorData: VectorDatabase
): Promise<{
  newBlocks: BlockWithPage[];
  modifiedBlocks: BlockWithPage[];
  deletedBlocks: VectorData[];
  validVectorData: VectorDatabase;
}> {
  // 创建当前blocks的映射表
  const currentBlocksMap = new Map<string, BlockWithPage>();
  currentBlocks.forEach(block => {
    currentBlocksMap.set(block.uuid, block);
  });

  // 创建已索引数据的映射表
  const existingDataMap = new Map<string, VectorData>();
  existingVectorData.forEach(data => {
    existingDataMap.set(data.blockUUID, data);
  });

  const newBlocks: BlockWithPage[] = [];
  const modifiedBlocks: BlockWithPage[] = [];
  const deletedBlocks: VectorData[] = [];
  const validVectorData: VectorDatabase = [];

  // 检测新增和修改的blocks
  for (const block of currentBlocks) {
    const existingData = existingDataMap.get(block.uuid);

    if (!existingData) {
      // 新增的block
      newBlocks.push(block);
    } else {
      // 检查内容是否发生变化
      const currentProcessedContent = preprocessContent(block.content);
      const existingProcessedContent = existingData.blockContent;

      if (currentProcessedContent !== existingProcessedContent) {
        // 内容已修改的block
        modifiedBlocks.push(block);
        console.log(`🔄 检测到内容修改: ${block.uuid.slice(0, 8)}...`);
      } else {
        // 内容未变化，保留现有数据
        validVectorData.push(existingData);
      }
    }
  }

  // 检测删除的blocks
  for (const data of existingVectorData) {
    if (!currentBlocksMap.has(data.blockUUID)) {
      deletedBlocks.push(data);
      console.log(`🗑️ 检测到已删除block: ${data.blockUUID.slice(0, 8)}...`);
    }
  }

  return {
    newBlocks,
    modifiedBlocks,
    deletedBlocks,
    validVectorData
  };
}