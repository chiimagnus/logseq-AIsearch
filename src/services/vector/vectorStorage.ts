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

// 🚀 保存向量数据（智能模式：检测是否需要全量保存）
export async function saveVectorData(vectorData: VectorDatabase): Promise<void> {
  if (!storageManager) throw new Error("存储管理器未初始化");
  if (vectorData.length === 0) return;

  try {
    // 检查是否可以使用增量保存
    const canUseIncrementalSave = await shouldUseIncrementalSave(vectorData);

    if (canUseIncrementalSave) {
      console.log(`💾 使用增量保存模式，更新缓存数据`);
      // 直接更新缓存，避免重复保存
      vectorDataCache = vectorData;
      console.log("📦 数据已更新到内存缓存（增量模式）");
    } else {
      console.log(`💾 开始全量保存 ${vectorData.length} 条向量数据`);

      const compactData = optimizeVectorData(vectorData);
      await storageManager.saveData(VECTOR_STORAGE_KEY, compactData);

      console.log(`✅ 向量数据保存完成: ${vectorData.length} 条记录`);

      // 🚀 保存后更新缓存
      vectorDataCache = vectorData;
      console.log("📦 数据已更新到内存缓存");
    }

  } catch (error) {
    console.error("保存向量数据失败:", error);
    throw error;
  }
}

// 🚀 新增：增量保存向量数据（智能保存策略）
export async function incrementalSaveVectorData(
  newData: VectorData[],
  existingData: VectorDatabase
): Promise<void> {
  if (!storageManager) throw new Error("存储管理器未初始化");
  if (newData.length === 0) return;

  try {
    console.log(`💾 智能增量保存：新增 ${newData.length} 条数据，已存在 ${existingData.length} 条数据`);

    // 合并数据
    const allVectorData = [...existingData, ...newData];

    // 🚀 智能保存策略：只在必要时进行磁盘保存
    const shouldSaveToDisk = shouldPerformDiskSave(newData.length, allVectorData.length);

    if (shouldSaveToDisk) {
      console.log(`💾 执行磁盘保存：${shouldSaveToDisk.reason}`);
      const compactData = optimizeVectorData(allVectorData);
      await storageManager.saveData(VECTOR_STORAGE_KEY, compactData);
      console.log(`✅ 磁盘保存完成: 总数据 ${allVectorData.length} 条`);
    } else {
      console.log(`📦 仅更新缓存：新增数据较少，延迟磁盘保存以提升性能`);
    }

    // 🚀 始终更新缓存
    vectorDataCache = allVectorData;
    console.log("📦 数据已更新到内存缓存");

  } catch (error) {
    console.error("增量保存向量数据失败:", error);
    throw error;
  }
}

// 🚀 强制保存缓存数据到磁盘（用于确保数据持久化）
export async function flushCacheToDisk(): Promise<void> {
  if (!storageManager) throw new Error("存储管理器未初始化");
  if (!vectorDataCache || vectorDataCache.length === 0) return;

  try {
    console.log(`💾 强制保存缓存数据到磁盘: ${vectorDataCache.length} 条记录`);
    const compactData = optimizeVectorData(vectorDataCache);
    await storageManager.saveData(VECTOR_STORAGE_KEY, compactData);
    console.log(`✅ 缓存数据已保存到磁盘`);
  } catch (error) {
    console.error("强制保存缓存数据失败:", error);
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

// 🚀 检查是否应该使用增量保存模式
async function shouldUseIncrementalSave(vectorData: VectorDatabase): Promise<boolean> {
  // 如果没有缓存数据，说明是首次保存或缓存已清空，需要全量保存
  if (!vectorDataCache) {
    return false;
  }

  // 如果数据量相同且缓存存在，可能只是内存中的数据更新，可以使用增量模式
  if (vectorData.length === vectorDataCache.length) {
    return true;
  }

  // 如果新数据量比缓存数据量大，但差异不大（小于100条），可以使用增量模式
  const difference = Math.abs(vectorData.length - vectorDataCache.length);
  if (difference < 100) {
    return true;
  }

  // 其他情况使用全量保存
  return false;
}

// 🚀 判断是否需要执行磁盘保存
function shouldPerformDiskSave(newDataCount: number, totalDataCount: number): { shouldSave: boolean; reason: string } | false {
  // 新增数据超过50条时，进行磁盘保存
  if (newDataCount >= 50) {
    return { shouldSave: true, reason: `新增数据达到${newDataCount}条，超过阈值50条` };
  }

  // 新增数据比例超过5%时，进行磁盘保存
  const newDataRatio = newDataCount / totalDataCount;
  if (newDataRatio > 0.05) {
    return { shouldSave: true, reason: `新增数据比例${(newDataRatio * 100).toFixed(1)}%，超过5%阈值` };
  }

  // 总数据量较小时（小于1000条），进行磁盘保存
  if (totalDataCount < 1000) {
    return { shouldSave: true, reason: `总数据量${totalDataCount}条，小于1000条阈值` };
  }

  // 其他情况延迟保存
  return false;
}
