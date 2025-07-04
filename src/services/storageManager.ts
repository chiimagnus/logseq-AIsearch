// 存储管理器 - 统一的存储接口，支持多种存储后端

import { ChunkedStorage } from './chunkedStorage';

// 存储后端类型
export type StorageBackend = 'assets' | 'chunked-localStorage' | 'simple-localStorage';

// 存储接口
export interface IStorageManager {
  saveData(key: string, data: any): Promise<void>;
  loadData(key: string): Promise<any>;
  clearData(key: string): Promise<void>;
  hasData(key: string): Promise<boolean>;
  getStorageStats(key: string): Promise<any>;
  getBackendType(): StorageBackend;
}

/**
 * Assets API 存储实现
 */
class AssetsStorage implements IStorageManager {
  private storage: any;

  constructor() {
    try {
      this.storage = logseq.Assets.makeSandboxStorage();
    } catch (error) {
      console.error("Assets API 初始化失败:", error);
      throw new Error("Assets API 不可用");
    }
  }

  async saveData(key: string, data: any): Promise<void> {
    try {
      const jsonString = JSON.stringify(data);
      await this.storage.setItem(`${key}.json`, jsonString);
    } catch (error) {
      console.error("Assets API 保存数据失败:", error);
      throw new Error(`Assets API 保存失败: ${error}`);
    }
  }

  async loadData(key: string): Promise<any> {
    try {
      const jsonString = await this.storage.getItem(`${key}.json`);
      return jsonString ? JSON.parse(jsonString) : null;
    } catch (error) {
      console.error("Assets API 加载数据失败:", error);
      // 对于加载失败，返回null而不是抛出错误，让系统可以降级
      return null;
    }
  }

  async clearData(key: string): Promise<void> {
    try {
      await this.storage.removeItem(`${key}.json`);
    } catch (error) {
      console.error("Assets API 清除数据失败:", error);
      // 清除失败不抛出错误，因为可能文件本来就不存在
    }
  }

  async hasData(key: string): Promise<boolean> {
    try {
      const data = await this.storage.getItem(`${key}.json`);
      return data !== null && data !== undefined;
    } catch (error) {
      console.error("Assets API 检查数据存在性失败:", error);
      return false;
    }
  }

  async getStorageStats(key: string): Promise<any> {
    try {
      const data = await this.storage.getItem(`${key}.json`);
      if (!data) return null;

      const size = new Blob([data]).size;
      return {
        backend: 'Assets API',
        sizeMB: (size / 1024 / 1024).toFixed(2),
        location: `assets/storages/${logseq.baseInfo?.id || 'unknown'}/${key}.json`
      };
    } catch (error) {
      console.error("Assets API 获取统计信息失败:", error);
      return null;
    }
  }

  getBackendType(): StorageBackend {
    return 'assets';
  }
}

/**
 * 分块压缩 localStorage 存储实现
 */
class ChunkedLocalStorage implements IStorageManager {
  private chunkedStorage: ChunkedStorage;

  constructor(keyPrefix: string = 'ai-search-vector') {
    this.chunkedStorage = new ChunkedStorage(keyPrefix);
  }

  async saveData(key: string, data: any): Promise<void> {
    await this.chunkedStorage.saveData(key, data);
  }

  async loadData(key: string): Promise<any> {
    return await this.chunkedStorage.loadData(key);
  }

  async clearData(key: string): Promise<void> {
    await this.chunkedStorage.clearData(key);
  }

  async hasData(key: string): Promise<boolean> {
    return await this.chunkedStorage.hasData(key);
  }

  async getStorageStats(key: string): Promise<any> {
    const stats = await this.chunkedStorage.getStorageStats(key);
    return stats ? { ...stats, backend: 'Chunked localStorage' } : null;
  }

  getBackendType(): StorageBackend {
    return 'chunked-localStorage';
  }
}

/**
 * 简单 localStorage 存储实现（原有方案）
 */
class SimpleLocalStorage implements IStorageManager {
  private storageKey: string;

  constructor(storageKey: string = 'ai-search-vector-data') {
    this.storageKey = storageKey;
  }

  async saveData(key: string, data: any): Promise<void> {
    const jsonString = JSON.stringify(data);
    localStorage.setItem(this.storageKey, jsonString);
  }

  async loadData(key: string): Promise<any> {
    const jsonString = localStorage.getItem(this.storageKey);
    return jsonString ? JSON.parse(jsonString) : null;
  }

  async clearData(key: string): Promise<void> {
    localStorage.removeItem(this.storageKey);
  }

  async hasData(key: string): Promise<boolean> {
    return localStorage.getItem(this.storageKey) !== null;
  }

  async getStorageStats(key: string): Promise<any> {
    const data = localStorage.getItem(this.storageKey);
    if (!data) return null;
    
    const size = new Blob([data]).size;
    return {
      backend: 'Simple localStorage',
      sizeMB: (size / 1024 / 1024).toFixed(2),
      location: `localStorage['${this.storageKey}']`
    };
  }

  getBackendType(): StorageBackend {
    return 'simple-localStorage';
  }
}

/**
 * 存储管理器主类
 */
export class StorageManager {
  private currentStorage: IStorageManager;
  private preferredBackend: StorageBackend;

  constructor(preferredBackend: StorageBackend = 'assets') {
    this.preferredBackend = preferredBackend;
    this.currentStorage = this.createStorage(preferredBackend);
  }

  /**
   * 创建存储实例
   */
  private createStorage(backend: StorageBackend): IStorageManager {
    switch (backend) {
      case 'assets':
        return new AssetsStorage();
      case 'chunked-localStorage':
        return new ChunkedLocalStorage();
      case 'simple-localStorage':
        return new SimpleLocalStorage();
      default:
        throw new Error(`不支持的存储后端: ${backend}`);
    }
  }

  /**
   * 测试存储后端可用性
   */
  async testBackend(backend: StorageBackend): Promise<boolean> {
    console.log(`🧪 测试存储后端: ${backend}`);

    try {
      const storage = this.createStorage(backend);
      const testKey = 'storage-test';
      const testData = { test: true, timestamp: Date.now() };

      // 对于Assets API，添加额外的检查
      if (backend === 'assets') {
        // 检查logseq.Assets是否存在
        if (!logseq?.Assets?.makeSandboxStorage) {
          console.warn("logseq.Assets.makeSandboxStorage API 不存在");
          return false;
        }

        // 检查baseInfo是否可用
        if (!logseq.baseInfo?.id) {
          console.warn("logseq.baseInfo.id 不可用");
          return false;
        }
      }

      // 测试写入
      console.log(`📝 测试写入数据到 ${backend}`);
      await storage.saveData(testKey, testData);

      // 测试读取
      console.log(`📖 测试从 ${backend} 读取数据`);
      const retrievedData = await storage.loadData(testKey);
      const isValid = retrievedData && retrievedData.test === true;

      if (!isValid) {
        console.warn(`${backend} 数据验证失败`);
        return false;
      }

      // 清理测试数据
      console.log(`🗑️ 清理 ${backend} 测试数据`);
      await storage.clearData(testKey);

      console.log(`✅ ${backend} 测试通过`);
      return true;

    } catch (error) {
      console.warn(`❌ 存储后端 ${backend} 测试失败:`, error);

      // 对于Assets API的特定错误，提供更详细的信息
      if (backend === 'assets') {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('path') || errorMessage.includes('dir')) {
          console.warn("Assets API 路径处理错误，这是logseq的已知问题");
        }
      }

      return false;
    }
  }

  /**
   * 自动选择最佳存储后端
   */
  async autoSelectBackend(): Promise<StorageBackend> {
    console.log('🔍 开始自动选择存储后端...');

    // 按优先级测试存储后端，但跳过已知有问题的Assets API
    const backends: StorageBackend[] = ['chunked-localStorage', 'simple-localStorage'];

    // 只有在特定条件下才测试Assets API
    const shouldTestAssets = this.shouldTestAssetsAPI();
    if (shouldTestAssets) {
      backends.unshift('assets');
    } else {
      console.log('⚠️ 跳过Assets API测试（检测到已知兼容性问题）');
    }

    for (const backend of backends) {
      const isAvailable = await this.testBackend(backend);

      if (isAvailable) {
        console.log(`✅ 选择存储后端: ${backend}`);
        this.currentStorage = this.createStorage(backend);
        this.preferredBackend = backend;
        return backend;
      } else {
        console.log(`❌ 存储后端不可用: ${backend}`);
      }
    }

    throw new Error('所有存储后端都不可用');
  }

  /**
   * 检查是否应该测试Assets API
   */
  private shouldTestAssetsAPI(): boolean {
    try {
      // 检查基本API是否存在
      if (!logseq?.Assets?.makeSandboxStorage) {
        console.log('Assets API 不存在');
        return false;
      }

      // 检查baseInfo是否可用
      if (!logseq.baseInfo?.id) {
        console.log('logseq.baseInfo.id 不可用');
        return false;
      }

      // 检查是否在支持的logseq版本中
      // 这里可以添加版本检查逻辑

      return true;
    } catch (error) {
      console.warn('Assets API 预检查失败:', error);
      return false;
    }
  }

  /**
   * 切换存储后端
   */
  async switchBackend(backend: StorageBackend): Promise<void> {
    const isAvailable = await this.testBackend(backend);
    if (!isAvailable) {
      throw new Error(`存储后端 ${backend} 不可用`);
    }
    
    this.currentStorage = this.createStorage(backend);
    this.preferredBackend = backend;
    console.log(`🔄 已切换到存储后端: ${backend}`);
  }

  /**
   * 数据迁移
   */
  async migrateData(fromBackend: StorageBackend, toBackend: StorageBackend, key: string = 'vector-data'): Promise<void> {
    console.log(`🚚 开始数据迁移: ${fromBackend} -> ${toBackend}`);
    
    const sourceStorage = this.createStorage(fromBackend);
    const targetStorage = this.createStorage(toBackend);
    
    // 检查源数据是否存在
    const hasSourceData = await sourceStorage.hasData(key);
    if (!hasSourceData) {
      console.log('📭 源存储中没有数据，跳过迁移');
      return;
    }
    
    // 加载源数据
    const data = await sourceStorage.loadData(key);
    if (!data) {
      throw new Error('加载源数据失败');
    }
    
    // 保存到目标存储
    await targetStorage.saveData(key, data);
    
    // 验证迁移结果
    const migratedData = await targetStorage.loadData(key);
    if (!migratedData) {
      throw new Error('数据迁移验证失败');
    }
    
    console.log(`✅ 数据迁移完成: ${Array.isArray(data) ? data.length : '1'} 条记录`);
  }

  // 代理方法到当前存储
  async saveData(key: string, data: any): Promise<void> {
    return await this.currentStorage.saveData(key, data);
  }

  async loadData(key: string): Promise<any> {
    return await this.currentStorage.loadData(key);
  }

  async clearData(key: string): Promise<void> {
    return await this.currentStorage.clearData(key);
  }

  async hasData(key: string): Promise<boolean> {
    return await this.currentStorage.hasData(key);
  }

  async getStorageStats(key: string): Promise<any> {
    return await this.currentStorage.getStorageStats(key);
  }

  getCurrentBackend(): StorageBackend {
    return this.currentStorage.getBackendType();
  }

  getPreferredBackend(): StorageBackend {
    return this.preferredBackend;
  }
}
