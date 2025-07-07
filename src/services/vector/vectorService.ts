// 向量服务主协调器 - 负责初始化和协调各个向量服务模块

import { testEmbeddingService } from './embeddingService';
import { initializeStorage, isStorageInitialized, preloadVectorData, hasVectorData } from './vectorStorage';

// 核心状态管理
let isInitialized = false;

// 初始化向量存储系统
export async function initializeVectorStore() {
  if (isInitialized) {
    console.log("Vector store already initialized.");
    return;
  }
  console.log("🚀 Vector store initializing...");

  try {
    console.log("📦 Vector storage initializing...");

    // 初始化存储管理器
    try {
      initializeStorage();
    } catch (error) {
      console.error("存储系统初始化失败:", error);
      logseq.UI.showMsg("❌ 存储系统初始化失败", "error", { timeout: 5000 });
      return;
    }

    // 测试embedding服务连接
    try {
      await testEmbeddingService();
    } catch (error) {
      console.error("Embedding service test failed:", error);
      return;
    }

    // 🚀 预加载向量数据到缓存（如果存在）
    try {
      const hasData = await hasVectorData();
      if (hasData) {
        console.log("📂 检测到向量数据，开始预加载到缓存...");
        await preloadVectorData();
        console.log("✅ 向量数据预加载完成");
      } else {
        console.log("📭 未检测到向量数据，跳过预加载");
      }
    } catch (error) {
      console.warn("⚠️ 预加载向量数据失败:", error);
      // 预加载失败不影响初始化
    }

    isInitialized = true;
    console.log("✅ Vector store initialized successfully.");

  } catch (error) {
      console.error("❌ Vector store initialization failed:", error);
      logseq.UI.showMsg("向量存储初始化失败，请检查控制台日志", "error");
  }
}

// 获取初始化状态
export function getInitializationStatus() {
  return { isInitialized };
}

// 检查服务是否可用
export function isVectorServiceReady(): boolean {
  return isInitialized && isStorageInitialized();
}

// 重新导出其他模块的功能
export { indexAllPages, continueIndexing, silentIncrementalIndexing, analyzeBlockChanges } from './vectorIndexing';
export { search } from './vectorSearch';
export {
  getVectorStoreStats,
  clearVectorData,
  checkVectorDataIntegrity,
  incrementalSaveVectorData
} from './vectorStorage';

