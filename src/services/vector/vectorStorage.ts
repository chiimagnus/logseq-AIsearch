// 向量数据存储服务

import { VectorData, VectorDatabase, CompactVectorData, VectorStoreStats, VectorDataIntegrity } from '../../types/vector';
import { StorageManager } from '../core/storageManager';
import { getVectorDimension } from './embeddingService';

// 存储相关常量
const VECTOR_STORAGE_KEY = 'vector-data';
let storageManager: StorageManager;

// 初始化存储管理器
export function initializeStorage(): void {
  storageManager = new StorageManager();
  // logseq.UI.showMsg("📦 存储后端: Assets API (压缩存储)", "info", { timeout: 3000 });
  console.log("✅ 存储系统初始化完成，使用: Assets API");
}

// 向量数据优化函数
function optimizeVectorData(data: VectorData[]): CompactVectorData[] {
  return data.map(item => ({
    u: item.blockUUID,
    p: item.pageName,
    c: item.blockContent, // 使用预处理后的内容
    v: compressVector(item.vector), // 压缩向量精度
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

// 向量精度压缩（减少小数位数）
function compressVector(vector: number[]): number[] {
  return vector.map(v => Math.round(v * 10000) / 10000); // 保留4位小数
}

// 保存向量数据
export async function saveVectorData(vectorData: VectorDatabase): Promise<void> {
  try {
    if (!storageManager) {
      throw new Error("存储管理器未初始化");
    }

    // 使用优化的数据结构存储
    const compactData = optimizeVectorData(vectorData);
    await storageManager.saveData(VECTOR_STORAGE_KEY, compactData);

    console.log(`保存了 ${vectorData.length} 条向量数据到 Assets API 存储 (优化格式)`);
  } catch (error) {
    console.error("保存向量数据失败:", error);
    throw error;
  }
}

// 加载向量数据
export async function loadVectorData(): Promise<VectorDatabase> {
  try {
    if (!storageManager) {
      console.log("存储管理器未初始化，返回空数组");
      return [];
    }

    const compactData = await storageManager.loadData(VECTOR_STORAGE_KEY);
    if (!compactData) {
      console.log("向量数据不存在，返回空数组");
      return [];
    }

    // 检查数据格式，兼容旧格式
    let vectorData: VectorDatabase;
    if (Array.isArray(compactData) && compactData.length > 0) {
      // 检查是否是新的压缩格式
      if ('u' in compactData[0]) {
        vectorData = restoreVectorData(compactData as CompactVectorData[]);
        console.log(`从 Assets API 存储加载了 ${vectorData.length} 条向量数据 (优化格式)`);
      } else {
        vectorData = compactData as VectorDatabase;
        console.log(`从 Assets API 存储加载了 ${vectorData.length} 条向量数据 (兼容格式)`);
      }
    } else {
      vectorData = [];
    }

    return vectorData;
  } catch (error) {
    console.error("加载向量数据失败:", error);
    return [];
  }
}

// 获取向量存储统计信息
export async function getVectorStoreStats(): Promise<VectorStoreStats> {
  if (!storageManager) {
    return { count: 0, dim: 0, backend: 'none' };
  }

  try {
    const vectorData = await loadVectorData();
    const count = vectorData.length;
    const dim = vectorData.length > 0 ? vectorData[0].vector.length : getVectorDimension();
    const backend = 'Assets API';
    const storageStats = await storageManager.getStorageStats(VECTOR_STORAGE_KEY);

    return {
      count,
      dim,
      backend,
      storageStats
    };
  } catch (error) {
    console.error("Failed to get vector store stats:", error);
    return { count: 0, dim: getVectorDimension(), backend: 'error' };
  }
}

// 清除向量数据
export async function clearVectorData(): Promise<void> {
  if (!storageManager) {
    throw new Error("存储管理器未初始化");
  }

  try {
    await storageManager.clearData(VECTOR_STORAGE_KEY);
    console.log("向量数据已清除");
  } catch (error) {
    console.error("清除向量数据失败:", error);
    throw error;
  }
}

// 检查向量数据完整性
export async function checkVectorDataIntegrity(): Promise<VectorDataIntegrity> {
  if (!storageManager) {
    return {
      isValid: false,
      hasFile: false,
      canLoad: false,
      dataCount: 0,
      fileSize: '0MB',
      issues: ['向量服务未初始化']
    };
  }

  const issues: string[] = [];
  let hasFile = false;
  let canLoad = false;
  let dataCount = 0;
  let fileSize = '0MB';

  try {
    // 检查文件是否存在
    hasFile = await storageManager.hasData(VECTOR_STORAGE_KEY);

    if (hasFile) {
      // 获取文件大小
      const storageStats = await storageManager.getStorageStats(VECTOR_STORAGE_KEY);
      fileSize = storageStats?.sizeMB ? `${storageStats.sizeMB}MB` : '未知';

      // 尝试加载数据
      const vectorData = await loadVectorData();
      if (vectorData && Array.isArray(vectorData)) {
        canLoad = true;
        dataCount = vectorData.length;

        // 检查数据结构完整性
        if (vectorData.length > 0) {
          const sample = vectorData[0];
          if (!sample.blockUUID || !sample.vector || !Array.isArray(sample.vector)) {
            issues.push('向量数据结构不完整');
          }

          // 检查向量维度一致性
          const expectedDim = getVectorDimension();
          const inconsistentDims = vectorData.filter(item =>
            !item.vector || item.vector.length !== expectedDim
          );

          if (inconsistentDims.length > 0) {
            issues.push(`发现${inconsistentDims.length}条向量维度不一致的数据`);
          }
        }
      } else {
        issues.push('无法加载向量数据，可能文件已损坏');
      }
    } else {
      issues.push('向量数据文件不存在');
    }

    const isValid = hasFile && canLoad && issues.length === 0;

    return {
      isValid,
      hasFile,
      canLoad,
      dataCount,
      fileSize,
      issues
    };

  } catch (error) {
    issues.push(`检查过程出错: ${error}`);
    return {
      isValid: false,
      hasFile,
      canLoad: false,
      dataCount: 0,
      fileSize,
      issues
    };
  }
}

// 检查存储管理器是否已初始化
export function isStorageInitialized(): boolean {
  return !!storageManager;
}

// 检查数据文件是否存在
export async function hasVectorData(): Promise<boolean> {
  if (!storageManager) {
    return false;
  }
  return await storageManager.hasData(VECTOR_STORAGE_KEY);
} 