// 向量数据存储服务

import { VectorData, VectorDatabase, CompactVectorData, VectorStoreStats, VectorDataIntegrity, VectorStoreManifest } from '../../types/vector';
import { StorageManager } from '../core/storageManager';
import { getVectorDimension } from './embeddingService';

// 存储相关常量
const VECTOR_STORAGE_KEY_PREFIX = 'vector-data-';
const VECTOR_MANIFEST_KEY = 'vector-manifest';
let storageManager: StorageManager;

// 🚀 内存缓存机制
let vectorDataCache: VectorDatabase | null = null;
let manifestCache: VectorStoreManifest | null = null;
let cacheVersion = 0;

// 初始化存储管理器
export function initializeStorage(): void {
  storageManager = new StorageManager();
  console.log("✅ 存储系统初始化完成，使用: Assets API (分片存储)");
}

// 🚀 优化：缓存清单文件，避免重复解压
async function loadManifest(): Promise<VectorStoreManifest> {
  if (!storageManager) throw new Error("存储管理器未初始化");
  
  // 优先使用缓存
  if (manifestCache) {
    console.log("📋 使用缓存的清单文件");
    return manifestCache;
  }

  // 🚀 改为加载JSON文件，避免解压操作
  try {
    const manifest = await storageManager.loadJsonData(VECTOR_MANIFEST_KEY);
    const result = manifest || { nextShardId: 0, shards: [], totalCount: 0 };
    
    // 缓存清单文件
    manifestCache = result;
    console.log("📋 清单文件已从JSON加载并缓存");
    
    return result;
  } catch (error) {
    console.warn("⚠️ 无法加载清单JSON文件，使用空清单");
    const emptyManifest = { nextShardId: 0, shards: [], totalCount: 0 };
    manifestCache = emptyManifest;
    return emptyManifest;
  }
}

// 内部函数：保存清单文件
async function saveManifest(manifest: VectorStoreManifest): Promise<void> {
  if (!storageManager) throw new Error("存储管理器未初始化");
  
  // 更新缓存
  manifestCache = manifest;
  
  // 🚀 改为保存JSON文件，避免压缩操作
  await storageManager.saveJsonData(VECTOR_MANIFEST_KEY, manifest);
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

// 🚀 清除所有缓存
function clearAllCache(): void {
  vectorDataCache = null;
  manifestCache = null;
  cacheVersion++;
  console.log("🗑️ 所有缓存已清除");
}

// 🚀 新增：保存一个新的数据分片并更新清单
export async function addVectorShard(vectorData: VectorDatabase): Promise<void> {
  if (!storageManager) throw new Error("存储管理器未初始化");
  if (vectorData.length === 0) return;

  try {
    const manifest = await loadManifest();
    const shardKey = `${VECTOR_STORAGE_KEY_PREFIX}${manifest.nextShardId}`;
    
    const compactData = optimizeVectorData(vectorData);
    await storageManager.saveData(shardKey, compactData);
    console.log(`💾 保存了 ${vectorData.length} 条向量数据到新的分片: ${shardKey}`);

    manifest.nextShardId++;
    manifest.shards.push(shardKey);
    manifest.totalCount += vectorData.length;
    await saveManifest(manifest);
    console.log(`✅ 更新清单，总数据量: ${manifest.totalCount}`);

    // 🚀 新增数据后清除向量数据缓存（但保留清单缓存）
    vectorDataCache = null;
    console.log("🗑️ 向量数据缓存已清除");

  } catch (error) {
    console.error("保存向量分片失败:", error);
    throw error;
  }
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
    const manifest = await loadManifest();
    if (manifest.shards.length === 0) {
      console.log("向量数据清单为空，无需加载");
      vectorDataCache = [];
      return [];
    }

    console.log(`🔄 从存储加载 ${manifest.shards.length} 个数据分片...`);

    const allShardsPromises = manifest.shards.map(shardKey =>
      storageManager.loadData(shardKey)
    );
    const allShardsResults = await Promise.all(allShardsPromises);
    
    const validCompactData = allShardsResults.filter(d => d && Array.isArray(d)).flat();
    const vectorData = restoreVectorData(validCompactData);
    
    console.log(`✅ 成功加载并合并所有分片，总共 ${vectorData.length} 条向量数据`);
    
    if (manifest.totalCount !== vectorData.length) {
      console.warn(`⚠️ 清单记录数 (${manifest.totalCount}) 与实际加载数 (${vectorData.length}) 不符，将以实际数量为准进行修复。`);
      manifest.totalCount = vectorData.length;
      await saveManifest(manifest);
    }
    
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
    const manifest = await loadManifest();
    const count = manifest.totalCount;
    const dim = getVectorDimension();
    const backend = 'Assets API (Sharded)';
    
    return {
      count,
      dim,
      backend,
      storageStats: {
        totalShards: manifest.shards.length,
        cached: !!vectorDataCache,
        manifestCached: !!manifestCache,
        cacheVersion: cacheVersion
      }
    };
  } catch (error) {
    console.error("获取向量存储统计信息失败:", error);
    return { count: 0, dim: getVectorDimension(), backend: 'error' };
  }
}

// 🔄 重构：清除所有向量数据和清单
export async function clearVectorData(): Promise<void> {
  if (!storageManager) throw new Error("存储管理器未初始化");

  try {
    console.log("🗑️ 开始清除向量数据...");
    
    // 🚀 优先使用缓存的清单，避免解压
    let manifest = manifestCache;
    if (!manifest) {
      try {
        manifest = await loadManifest();
        console.log(`📋 加载清单文件，包含 ${manifest.shards.length} 个分片`);
      } catch (error) {
        console.warn("⚠️ 清单文件不存在或损坏，将跳过分片清除");
        manifest = { nextShardId: 0, shards: [], totalCount: 0 };
      }
    } else {
      console.log(`📋 使用缓存的清单文件，包含 ${manifest.shards.length} 个分片`);
    }
    
    // 清除所有分片
    if (manifest.shards.length > 0) {
      console.log(`🗑️ 正在清除 ${manifest.shards.length} 个数据分片...`);
      
      const deletionPromises = manifest.shards.map(async (shardKey) => {
        try {
          await storageManager.clearData(shardKey);
          console.log(`✅ 已清除分片: ${shardKey}`);
        } catch (error) {
          console.warn(`⚠️ 清除分片失败 ${shardKey}:`, error);
        }
      });
      
      await Promise.all(deletionPromises);
      console.log(`🗑️ 已处理 ${manifest.shards.length} 个数据分片`);
    } else {
      console.log("📭 没有找到数据分片，跳过分片清除");
    }

    // 🚀 清除JSON清单文件
    try {
      await storageManager.clearJsonData(VECTOR_MANIFEST_KEY);
      console.log("🗑️ 已清除向量数据JSON清单");
    } catch (error) {
      console.warn("⚠️ 清除JSON清单文件失败:", error);
    }

    // 🚀 清除所有缓存
    clearAllCache();
    
    console.log("✅ 向量数据清除完成");

  } catch (error) {
    console.error("❌ 清除向量数据失败:", error);
    throw error;
  }
}

// 🔄 重构：检查向量数据完整性
export async function checkVectorDataIntegrity(): Promise<VectorDataIntegrity> {
  if (!storageManager) {
    return { isValid: false, hasFile: false, canLoad: false, dataCount: 0, fileSize: '0MB', issues: ['向量服务未初始化'] };
  }

  const issues: string[] = [];
  try {
    // 优先使用缓存检查
    if (manifestCache) {
      const dataCount = manifestCache.totalCount;
      console.log(`📋 使用缓存的清单进行完整性检查，记录数: ${dataCount}`);
      
      return {
        isValid: true,
        hasFile: manifestCache.shards.length > 0,
        canLoad: true,
        dataCount,
        fileSize: 'N/A',
        issues: []
      };
    }

    // 🚀 只在必要时才检查JSON存储
    const hasManifest = await storageManager.hasJsonData(VECTOR_MANIFEST_KEY);
    if (!hasManifest) {
      issues.push('向量数据JSON清单文件不存在');
      return { isValid: false, hasFile: false, canLoad: false, dataCount: 0, fileSize: 'N/A', issues };
    }

    const manifest = await loadManifest();
    const dataCount = manifest.totalCount;
    
    return {
      isValid: true,
      hasFile: true,
      canLoad: true,
      dataCount,
      fileSize: 'N/A',
      issues
    };

  } catch (error) {
    const err = error as Error;
    issues.push(`检查过程出错: ${err.message}`);
    return { isValid: false, hasFile: true, canLoad: false, dataCount: 0, fileSize: 'N/A', issues };
  }
}

// 检查存储管理器是否已初始化
export function isStorageInitialized(): boolean {
  return !!storageManager;
}

// 🚀 优化：快速检查是否有数据，避免解压
export async function hasVectorData(): Promise<boolean> {
  if (!storageManager) return false;
  
  // 首先检查缓存
  if (manifestCache && manifestCache.shards.length > 0) {
    console.log("✅ 从缓存确认有向量数据");
    return true;
  }
  
  // 🚀 改为检查JSON清单文件是否存在
  try {
    const hasManifest = await storageManager.hasJsonData(VECTOR_MANIFEST_KEY);
    if (hasManifest) {
      console.log("✅ 发现JSON清单文件");
      return true;
    } else {
      console.log("📭 未发现JSON清单文件");
      return false;
    }
  } catch (error) {
    console.warn("⚠️ 检查JSON清单文件失败:", error);
    return false;
  }
} 
