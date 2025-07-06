// 向量服务主协调器 - 负责初始化和协调各个向量服务模块

import { testEmbeddingService } from './embeddingService';
import { initializeStorage, isStorageInitialized } from './vectorStorage';

// 核心状态管理
let isInitialized = false;

// 初始化向量存储系统
export async function initializeVectorStore() {
  if (isInitialized) {
    console.log("Vector store already initialized.");
    return;
  }
  console.log("Vector store initializing...");

  try {
    console.log("Vector storage initializing...");

    // 初始化存储管理器
    try {
      initializeStorage();
    } catch (error) {
      console.error("存储系统初始化失败:", error);
      logseq.UI.showMsg("❌ 存储系统初始化失败", "error", { timeout: 5000 });
      return;
    }

    logseq.UI.showMsg("向量存储系统已初始化", "info", { timeout: 3000 });

    // 测试embedding服务连接
    try {
      await testEmbeddingService();
    } catch (error) {
      console.error("Embedding service test failed:", error);
      return;
    }

    isInitialized = true;
    console.log("Vector store initialized successfully.");

  } catch (error) {
      console.error("Vector store initialization failed:", error);
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
export { indexAllPages, continueIndexing } from './vectorIndexing';
export { search } from './vectorSearch';
export { 
  getVectorStoreStats, 
  clearVectorData, 
  checkVectorDataIntegrity 
} from './vectorStorage';

