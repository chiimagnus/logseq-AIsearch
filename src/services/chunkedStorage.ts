// 分块压缩存储模块 - 突破localStorage容量限制

import LZString from 'lz-string';

// 存储配置
interface StorageConfig {
  chunkSize: number;        // 每块的最大大小（字节）
  maxChunks: number;        // 最大块数
  compressionEnabled: boolean; // 是否启用压缩
  keyPrefix: string;        // 存储键前缀
}

// 元数据结构
interface ChunkMetadata {
  totalChunks: number;      // 总块数
  originalSize: number;     // 原始数据大小
  compressedSize: number;   // 压缩后大小
  checksum: string;         // 数据校验和
  timestamp: number;        // 创建时间戳
  version: string;          // 数据版本
}

// 默认配置
const DEFAULT_CONFIG: StorageConfig = {
  chunkSize: 1024 * 1024,   // 1MB per chunk
  maxChunks: 50,            // 最多50块
  compressionEnabled: true,
  keyPrefix: 'chunked_'
};

/**
 * 分块压缩存储类
 */
export class ChunkedStorage {
  private config: StorageConfig;
  private metadataKey: string;

  constructor(keyPrefix: string = 'ai-search-vector', config: Partial<StorageConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config, keyPrefix };
    this.metadataKey = `${this.config.keyPrefix}_metadata`;
  }

  /**
   * 计算字符串的简单校验和
   */
  private calculateChecksum(data: string): string {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * 压缩数据
   */
  private compressData(data: string): string {
    if (!this.config.compressionEnabled) {
      return data;
    }
    return LZString.compress(data) || data;
  }

  /**
   * 解压数据
   */
  private decompressData(compressedData: string): string {
    if (!this.config.compressionEnabled) {
      return compressedData;
    }
    const decompressed = LZString.decompress(compressedData);
    return decompressed || compressedData;
  }

  /**
   * 将数据分割成块
   */
  private splitIntoChunks(data: string): string[] {
    const chunks: string[] = [];
    const chunkSize = this.config.chunkSize;
    
    for (let i = 0; i < data.length; i += chunkSize) {
      chunks.push(data.slice(i, i + chunkSize));
    }
    
    return chunks;
  }

  /**
   * 保存数据
   */
  async saveData(key: string, data: any): Promise<void> {
    try {
      console.log(`🔄 开始保存数据到分块存储: ${key}`);
      
      // 序列化数据
      const jsonString = JSON.stringify(data);
      const originalSize = new Blob([jsonString]).size;
      
      console.log(`📊 原始数据大小: ${(originalSize / 1024 / 1024).toFixed(2)}MB`);
      
      // 压缩数据
      const compressedData = this.compressData(jsonString);
      const compressedSize = new Blob([compressedData]).size;
      
      console.log(`📊 压缩后大小: ${(compressedSize / 1024 / 1024).toFixed(2)}MB (压缩率: ${((1 - compressedSize / originalSize) * 100).toFixed(1)}%)`);
      
      // 分割成块
      const chunks = this.splitIntoChunks(compressedData);
      
      if (chunks.length > this.config.maxChunks) {
        throw new Error(`数据过大，需要 ${chunks.length} 块，超过最大限制 ${this.config.maxChunks} 块`);
      }
      
      console.log(`📦 数据分割为 ${chunks.length} 块`);
      
      // 创建元数据
      const metadata: ChunkMetadata = {
        totalChunks: chunks.length,
        originalSize,
        compressedSize,
        checksum: this.calculateChecksum(jsonString),
        timestamp: Date.now(),
        version: '1.0'
      };
      
      // 清理旧数据
      await this.clearData(key);
      
      // 保存块数据
      for (let i = 0; i < chunks.length; i++) {
        const chunkKey = `${this.config.keyPrefix}_${key}_chunk_${i}`;
        try {
          localStorage.setItem(chunkKey, chunks[i]);
        } catch (error) {
          // 如果保存失败，清理已保存的块
          for (let j = 0; j < i; j++) {
            localStorage.removeItem(`${this.config.keyPrefix}_${key}_chunk_${j}`);
          }
          throw new Error(`保存第 ${i} 块时失败: ${error}`);
        }
      }
      
      // 保存元数据
      localStorage.setItem(`${this.metadataKey}_${key}`, JSON.stringify(metadata));
      
      console.log(`✅ 数据保存完成: ${chunks.length} 块，总大小 ${(compressedSize / 1024 / 1024).toFixed(2)}MB`);
      
    } catch (error) {
      console.error(`❌ 保存数据失败:`, error);
      throw error;
    }
  }

  /**
   * 加载数据
   */
  async loadData(key: string): Promise<any> {
    try {
      console.log(`🔄 开始从分块存储加载数据: ${key}`);
      
      // 加载元数据
      const metadataJson = localStorage.getItem(`${this.metadataKey}_${key}`);
      if (!metadataJson) {
        console.log(`📭 未找到数据: ${key}`);
        return null;
      }
      
      const metadata: ChunkMetadata = JSON.parse(metadataJson);
      console.log(`📊 元数据: ${metadata.totalChunks} 块，原始大小 ${(metadata.originalSize / 1024 / 1024).toFixed(2)}MB`);
      
      // 加载所有块
      const chunks: string[] = [];
      for (let i = 0; i < metadata.totalChunks; i++) {
        const chunkKey = `${this.config.keyPrefix}_${key}_chunk_${i}`;
        const chunk = localStorage.getItem(chunkKey);
        
        if (chunk === null) {
          throw new Error(`缺失第 ${i} 块数据`);
        }
        
        chunks.push(chunk);
      }
      
      // 重组数据
      const compressedData = chunks.join('');
      
      // 解压数据
      const jsonString = this.decompressData(compressedData);
      
      // 验证校验和
      const checksum = this.calculateChecksum(jsonString);
      if (checksum !== metadata.checksum) {
        console.warn(`⚠️ 数据校验和不匹配，可能存在数据损坏`);
      }
      
      // 解析JSON
      const data = JSON.parse(jsonString);
      
      console.log(`✅ 数据加载完成: ${metadata.totalChunks} 块，${Array.isArray(data) ? data.length : '1'} 条记录`);
      
      return data;
      
    } catch (error) {
      console.error(`❌ 加载数据失败:`, error);
      return null;
    }
  }

  /**
   * 清理数据
   */
  async clearData(key: string): Promise<void> {
    try {
      // 获取元数据以确定块数
      const metadataJson = localStorage.getItem(`${this.metadataKey}_${key}`);
      if (metadataJson) {
        const metadata: ChunkMetadata = JSON.parse(metadataJson);
        
        // 删除所有块
        for (let i = 0; i < metadata.totalChunks; i++) {
          localStorage.removeItem(`${this.config.keyPrefix}_${key}_chunk_${i}`);
        }
      }
      
      // 删除元数据
      localStorage.removeItem(`${this.metadataKey}_${key}`);
      
      console.log(`🗑️ 已清理数据: ${key}`);
      
    } catch (error) {
      console.error(`❌ 清理数据失败:`, error);
    }
  }

  /**
   * 检查数据是否存在
   */
  async hasData(key: string): Promise<boolean> {
    return localStorage.getItem(`${this.metadataKey}_${key}`) !== null;
  }

  /**
   * 获取存储统计信息
   */
  async getStorageStats(key: string): Promise<any> {
    const metadataJson = localStorage.getItem(`${this.metadataKey}_${key}`);
    if (!metadataJson) {
      return null;
    }
    
    const metadata: ChunkMetadata = JSON.parse(metadataJson);
    return {
      totalChunks: metadata.totalChunks,
      originalSizeMB: (metadata.originalSize / 1024 / 1024).toFixed(2),
      compressedSizeMB: (metadata.compressedSize / 1024 / 1024).toFixed(2),
      compressionRatio: ((1 - metadata.compressedSize / metadata.originalSize) * 100).toFixed(1) + '%',
      timestamp: new Date(metadata.timestamp).toLocaleString(),
      version: metadata.version
    };
  }
}
