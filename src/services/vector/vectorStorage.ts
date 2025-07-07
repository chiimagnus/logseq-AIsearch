// 向量数据存储服务

import { VectorData, VectorDatabase, CompactVectorData, VectorStoreStats, VectorDataIntegrity } from '../../types/vector';
import { StorageManager } from '../core/storageManager';
import { getVectorDimension } from './embeddingService';

// 存储相关常量
const VECTOR_STORAGE_KEY = 'vector-data';
let storageManager: StorageManager;

// 🚀 内存缓存机制
let vectorDataCache: VectorDatabase | null = null;
let cacheVersion = 0;

// 初始化存储管理器
export function initializeStorage(): void {
  storageManager = new StorageManager();
  console.log("✅ 存储系统初始化完成，使用: localStorage (分片存储)");
}

// 🚀 清除所有缓存
function clearAllCache(): void {
  vectorDataCache = null;
  cacheVersion++;
  console.log("🗑️ 所有缓存已清除");
}

// 🚀 全量保存向量数据（用于重建索引）
export async function saveVectorData(vectorData: VectorDatabase): Promise<void> {
  if (!storageManager) throw new Error("存储管理器未初始化");
  if (vectorData.length === 0) return;

  try {
    console.log(`💾 开始全量保存 ${vectorData.length} 条向量数据`);

    const compactData = optimizeVectorData(vectorData);
    await storageManager.saveData(VECTOR_STORAGE_KEY, compactData);

    console.log(`✅ 向量数据保存完成: ${vectorData.length} 条记录`);

    // 🚀 保存后更新缓存
    vectorDataCache = vectorData;
    console.log("📦 数据已更新到内存缓存");

  } catch (error) {
    console.error("保存向量数据失败:", error);
    throw error;
  }
}

// 🚀 真正的增量保存：只追加新数据到最新分片
export async function incrementalSaveVectorData(
  newData: VectorData[],
  existingData: VectorDatabase
): Promise<void> {
  if (!storageManager) throw new Error("存储管理器未初始化");
  if (newData.length === 0) return;

  try {
    console.log(`💾 真正增量保存：追加 ${newData.length} 条新数据（已有 ${existingData.length} 条数据）`);

    // 🚀 使用分片追加策略：只保存新数据
    const compactNewData = optimizeVectorData(newData);
    await storageManager.appendData(VECTOR_STORAGE_KEY, compactNewData);

    // 🚀 更新缓存
    const allVectorData = [...existingData, ...newData];
    vectorDataCache = allVectorData;
    console.log("📦 数据已更新到内存缓存");

  } catch (error) {
    console.error("增量保存向量数据失败:", error);
    throw error;
  }
}



// 向量数据优化函数
function optimizeVectorData(data: VectorData[]): CompactVectorData[] {
  return data.map(item => ({
    u: item.blockUUID,
    p: item.pageName,
    c: item.blockContent,
    v: item.vector.map(v => Math.round(v * 10000) / 10000),
    t: item.lastUpdated
  }));
}

function restoreVectorData(compactData: CompactVectorData[]): VectorData[] {
  return compactData.map(item => ({
    blockUUID: item.u,
    pageName: item.p,
    blockContent: item.c,
    vector: item.v,
    lastUpdated: item.t
  }));
}

// 🚀 优化：使用缓存的数据加载
export async function loadVectorData(forceReload: boolean = false): Promise<VectorDatabase> {
  if (!storageManager) {
    console.log("存储管理器未初始化，返回空数组");
    return [];
  }

  // 🚀 如果缓存存在且不强制重新加载，直接返回缓存
  if (vectorDataCache && !forceReload) {
    console.log(`✅ 从内存缓存加载 ${vectorDataCache.length} 条向量数据`);
    return vectorDataCache;
  }

  try {
    console.log(`🔄 从 localStorage 加载向量数据...`);

    const compactData = await storageManager.loadData(VECTOR_STORAGE_KEY);
    
    if (!compactData || !Array.isArray(compactData)) {
      console.log("未找到向量数据或数据格式错误");
      vectorDataCache = [];
      return [];
    }
    
    const vectorData = restoreVectorData(compactData);
    
    console.log(`✅ 成功加载向量数据，总共 ${vectorData.length} 条记录`);
    
    // 🚀 缓存数据
    vectorDataCache = vectorData;
    console.log(`📦 数据已缓存到内存，版本: ${cacheVersion}`);
    
    return vectorData;

  } catch (error) {
    console.error("加载向量数据失败:", error);
    return [];
  }
}

// 🚀 新增：快速获取缓存的数据（用于搜索）
export function getCachedVectorData(): VectorDatabase | null {
  return vectorDataCache;
}

// 🚀 新增：预加载数据到缓存
export async function preloadVectorData(): Promise<void> {
  await loadVectorData(true);
}

// 🔄 重构：获取向量存储统计信息
export async function getVectorStoreStats(): Promise<VectorStoreStats> {
  if (!storageManager) {
    return { count: 0, dim: 0, backend: 'none' };
  }

  try {
    const storageStats = await storageManager.getStorageStats(VECTOR_STORAGE_KEY);
    const cachedData = getCachedVectorData();
    const count = cachedData ? cachedData.length : 0;
    const dim = getVectorDimension();
    const backend = 'localStorage (分片存储)';
    
    return {
      count,
      dim,
      backend,
      storageStats
    };

  } catch (error) {
    console.error("获取存储统计失败:", error);
    return { count: 0, dim: 0, backend: 'error' };
  }
}

// 清除向量数据
export async function clearVectorData(): Promise<void> {
  if (!storageManager) {
    console.log("存储管理器未初始化，无法清除数据");
    return;
  }

  try {
    await storageManager.clearData(VECTOR_STORAGE_KEY);
    clearAllCache();
    console.log("✅ 向量数据已清除");
  } catch (error) {
    console.error("清除向量数据失败:", error);
    throw error;
  }
}

// 检查向量数据完整性
export async function checkVectorDataIntegrity(): Promise<VectorDataIntegrity> {
  if (!storageManager) {
    return {
      hasFile: false,
      canLoad: false,
      dataCount: 0,
      fileSize: '0KB',
      isValid: false,
      issues: ['存储管理器未初始化']
    };
  }

  try {
    return await storageManager.getDataIntegrity(VECTOR_STORAGE_KEY);
  } catch (error) {
    return {
      hasFile: false,
      canLoad: false,
      dataCount: 0,
      fileSize: '0KB',
      isValid: false,
      issues: [`完整性检查失败: ${error}`]
    };
  }
}

// 检查存储管理器是否已初始化
export function isStorageInitialized(): boolean {
  return !!storageManager;
}

// 检查是否有向量数据
export async function hasVectorData(): Promise<boolean> {
  if (!storageManager) return false;
  
  try {
    return await storageManager.hasData(VECTOR_STORAGE_KEY);
  } catch (error) {
    console.error("检查向量数据存在性失败:", error);
    return false;
  }
}

// 🚀 新增：从分片中删除指定的向量数据
export async function deleteVectorDataFromShards(blockUUIDs: string[]): Promise<number> {
  if (!storageManager) throw new Error("存储管理器未初始化");
  if (blockUUIDs.length === 0) return 0;

  try {
    console.log(`🗑️ 开始从分片中删除 ${blockUUIDs.length} 个blocks的向量数据`);

    const deletedCount = await storageManager.deleteRecordsFromShards(VECTOR_STORAGE_KEY, blockUUIDs, 'u');

    // 🚀 更新缓存：从缓存中移除已删除的数据
    if (vectorDataCache && deletedCount > 0) {
      const deletedUUIDs = new Set(blockUUIDs);
      vectorDataCache = vectorDataCache.filter(item => !deletedUUIDs.has(item.blockUUID));
      console.log(`📦 缓存已更新: 移除了 ${deletedCount} 条记录，剩余 ${vectorDataCache.length} 条`);
    }

    return deletedCount;
  } catch (error) {
    console.error("从分片删除向量数据失败:", error);
    throw error;
  }
}

// 🚀 新增：更新分片中的向量数据
export async function updateVectorDataInShards(updates: Array<{blockUUID: string, data: VectorData}>): Promise<number> {
  if (!storageManager) throw new Error("存储管理器未初始化");
  if (updates.length === 0) return 0;

  try {
    console.log(`🔄 开始更新分片中的 ${updates.length} 个blocks的向量数据`);

    // 转换为存储格式
    const compactUpdates = updates.map(update => ({
      id: update.blockUUID,
      data: optimizeVectorData([update.data])[0]
    }));

    const updatedCount = await storageManager.updateRecordsInShards(VECTOR_STORAGE_KEY, compactUpdates, 'u');

    // 🚀 更新缓存
    if (vectorDataCache && updatedCount > 0) {
      const updateMap = new Map(updates.map(u => [u.blockUUID, u.data]));

      for (let i = 0; i < vectorDataCache.length; i++) {
        const blockUUID = vectorDataCache[i].blockUUID;
        if (updateMap.has(blockUUID)) {
          vectorDataCache[i] = updateMap.get(blockUUID)!;
        }
      }
      console.log(`📦 缓存已更新: 更新了 ${updatedCount} 条记录`);
    }

    return updatedCount;
  } catch (error) {
    console.error("更新分片向量数据失败:", error);
    throw error;
  }
}


