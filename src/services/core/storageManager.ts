// Enhanced localStorage 存储实现 - 替代有问题的 Assets API

export class StorageManager {
  private readonly CHUNK_SIZE = 1000; // 每个分片的记录数

  constructor() {
    console.log("🔧 初始化 localStorage 存储管理器");
  }

  async saveData(key: string, data: any): Promise<void> {
    try {
      console.log(`🔄 开始全量保存数据到 localStorage: ${key}`);

      if (!Array.isArray(data)) {
        throw new Error("数据必须是数组格式");
      }

      // 清除旧数据
      await this.clearData(key);

      // 分片保存数据
      const chunks = this.splitIntoChunks(data, this.CHUNK_SIZE);
      console.log(`📊 数据分为 ${chunks.length} 个分片`);

      // 保存元数据
      const metadata = {
        totalChunks: chunks.length,
        totalRecords: data.length,
        timestamp: Date.now(),
        version: 1
      };

      localStorage.setItem(`${key}_metadata`, JSON.stringify(metadata));

      // 保存每个分片
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const chunkKey = `${key}_chunk_${i}`;

        // 异步压缩分片
        const compressedChunk = await this.asyncCompress(JSON.stringify(chunk));
        localStorage.setItem(chunkKey, compressedChunk);

        console.log(`✅ 分片 ${i + 1}/${chunks.length} 保存完成 (${chunk.length} 条记录)`);
      }

      console.log(`✅ localStorage 全量保存完成: ${data.length} 条记录，${chunks.length} 个分片`);
    } catch (error) {
      console.error("localStorage 保存数据失败:", error);
      throw new Error(`localStorage 保存失败: ${error}`);
    }
  }

  // 🚀 新增：增量追加数据（只更新最新分片或创建新分片）
  async appendData(key: string, newData: any[]): Promise<void> {
    try {
      console.log(`🔄 开始增量追加数据到 localStorage: ${key} (${newData.length} 条新记录)`);

      if (!Array.isArray(newData) || newData.length === 0) {
        console.log("没有新数据需要追加");
        return;
      }

      // 获取当前元数据
      const metadataStr = localStorage.getItem(`${key}_metadata`);
      let metadata;

      if (metadataStr) {
        metadata = JSON.parse(metadataStr);
        console.log(`📊 当前状态: ${metadata.totalRecords} 条记录，${metadata.totalChunks} 个分片`);
      } else {
        // 如果没有元数据，创建新的存储
        metadata = {
          totalChunks: 0,
          totalRecords: 0,
          timestamp: Date.now(),
          version: 1
        };
        console.log("📊 创建新的存储结构");
      }

      // 获取最后一个分片的数据
      let lastChunkData: any[] = [];
      let lastChunkIndex = metadata.totalChunks - 1;

      if (metadata.totalChunks > 0) {
        const lastChunkKey = `${key}_chunk_${lastChunkIndex}`;
        const compressedLastChunk = localStorage.getItem(lastChunkKey);

        if (compressedLastChunk) {
          const jsonString = await this.asyncDecompress(compressedLastChunk);
          if (jsonString) {
            lastChunkData = JSON.parse(jsonString);
            console.log(`📦 加载最后分片 ${lastChunkIndex}: ${lastChunkData.length} 条记录`);
          }
        }
      }

      // 将新数据追加到最后一个分片
      const combinedData = [...lastChunkData, ...newData];
      const newChunks = this.splitIntoChunks(combinedData, this.CHUNK_SIZE);

      // 保存更新后的分片
      let chunksToSave = 0;
      for (let i = 0; i < newChunks.length; i++) {
        const chunk = newChunks[i];
        const chunkIndex = lastChunkIndex + i;
        const chunkKey = `${key}_chunk_${chunkIndex}`;

        // 压缩并保存分片
        const compressedChunk = await this.asyncCompress(JSON.stringify(chunk));
        localStorage.setItem(chunkKey, compressedChunk);
        chunksToSave++;

        console.log(`✅ 分片 ${chunkIndex} 保存完成 (${chunk.length} 条记录)`);
      }

      // 更新元数据
      metadata.totalChunks = lastChunkIndex + newChunks.length;
      metadata.totalRecords += newData.length;
      metadata.timestamp = Date.now();

      localStorage.setItem(`${key}_metadata`, JSON.stringify(metadata));

      console.log(`✅ 增量追加完成: 新增 ${newData.length} 条记录，保存了 ${chunksToSave} 个分片，总计 ${metadata.totalRecords} 条记录`);

    } catch (error) {
      console.error("localStorage 增量追加数据失败:", error);
      throw new Error(`localStorage 增量追加失败: ${error}`);
    }
  }

  // 将数据分割成分片
  private splitIntoChunks(data: any[], chunkSize: number): any[][] {
    const chunks: any[][] = [];
    for (let i = 0; i < data.length; i += chunkSize) {
      chunks.push(data.slice(i, i + chunkSize));
    }
    return chunks;
  }

  // 🚀 异步压缩，避免阻塞主线程
  private async asyncCompress(jsonString: string): Promise<string> {
    return new Promise(async (resolve, reject) => {
      setTimeout(async () => {
        try {
          const { default: LZString } = await import('lz-string');
          const result = LZString.compress(jsonString);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      }, 5); // 5ms延迟，让UI有时间更新
    });
  }

  // 🚀 异步解压缩
  private async asyncDecompress(compressedData: string): Promise<string | null> {
    return new Promise(async (resolve, reject) => {
      setTimeout(async () => {
        try {
          const { default: LZString } = await import('lz-string');
          const result = LZString.decompress(compressedData);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      }, 5);
    });
  }

  async loadData(key: string): Promise<any> {
    try {
      console.log(`🔄 开始从 localStorage 加载数据: ${key}`);

      // 检查元数据
      const metadataStr = localStorage.getItem(`${key}_metadata`);
      if (!metadataStr) {
        console.log(`📭 未找到数据: ${key}`);
        return null;
      }

      const metadata = JSON.parse(metadataStr);
      console.log(`📊 找到数据元信息: ${metadata.totalRecords} 条记录，${metadata.totalChunks} 个分片`);

      // 加载所有分片
      const allData: any[] = [];
      let loadedChunks = 0;

      for (let i = 0; i < metadata.totalChunks; i++) {
        const chunkKey = `${key}_chunk_${i}`;
        const compressedChunk = localStorage.getItem(chunkKey);

        if (compressedChunk) {
          try {
            // 异步解压缩
            const jsonString = await this.asyncDecompress(compressedChunk);
            if (jsonString) {
              const chunk = JSON.parse(jsonString);
              allData.push(...chunk);
              loadedChunks++;
              console.log(`✅ 分片 ${i + 1}/${metadata.totalChunks} 加载完成`);
            } else {
              console.warn(`⚠️ 分片 ${i} 解压缩失败`);
            }
          } catch (error) {
            console.error(`❌ 分片 ${i} 处理失败:`, error);
          }
        } else {
          console.warn(`⚠️ 分片 ${i} 不存在`);
        }
      }

      console.log(`✅ 数据加载完成: ${allData.length} 条记录 (${loadedChunks}/${metadata.totalChunks} 分片)`);
      return allData;

    } catch (error) {
      console.error("localStorage 加载数据失败:", error);
      return null;
    }
  }

  async clearData(key: string): Promise<void> {
    try {
      // 获取元数据以确定需要清除的分片数量
      const metadataStr = localStorage.getItem(`${key}_metadata`);
      if (metadataStr) {
        const metadata = JSON.parse(metadataStr);
        
        // 清除所有分片
        for (let i = 0; i < metadata.totalChunks; i++) {
          localStorage.removeItem(`${key}_chunk_${i}`);
        }
        
        // 清除元数据
        localStorage.removeItem(`${key}_metadata`);
        
        console.log(`🗑️ 已清除 localStorage 数据: ${key} (${metadata.totalChunks} 个分片)`);
      } else {
        // 尝试清除可能存在的分片（防止孤立数据）
        let i = 0;
        while (localStorage.getItem(`${key}_chunk_${i}`)) {
          localStorage.removeItem(`${key}_chunk_${i}`);
          i++;
        }
        localStorage.removeItem(`${key}_metadata`);
        
        if (i > 0) {
          console.log(`🗑️ 已清除 localStorage 孤立数据: ${key} (${i} 个分片)`);
        }
      }
    } catch (error) {
      console.error("localStorage 清除数据失败:", error);
      // 清除失败不抛出错误，因为可能数据本来就不存在
    }
  }

  async getStorageStats(key: string): Promise<any> {
    try {
      const metadataStr = localStorage.getItem(`${key}_metadata`);
      if (!metadataStr) return null;

      const metadata = JSON.parse(metadataStr);
      
      // 计算总大小
      let totalSize = 0;
      for (let i = 0; i < metadata.totalChunks; i++) {
        const chunkKey = `${key}_chunk_${i}`;
        const chunk = localStorage.getItem(chunkKey);
        if (chunk) {
          totalSize += new Blob([chunk]).size;
        }
      }

      return {
        backend: 'localStorage (分片存储)',
        sizeMB: (totalSize / 1024 / 1024).toFixed(2),
        totalChunks: metadata.totalChunks,
        totalRecords: metadata.totalRecords,
        compressionRatio: 'LZ压缩',
        compressedSizeMB: (totalSize / 1024 / 1024).toFixed(2)
      };
    } catch (error) {
      console.error("localStorage 获取统计信息失败:", error);
      return null;
    }
  }

  // 检查数据是否存在
  async hasData(key: string): Promise<boolean> {
    return localStorage.getItem(`${key}_metadata`) !== null;
  }

  // 获取数据完整性信息
  async getDataIntegrity(key: string): Promise<any> {
    try {
      const metadataStr = localStorage.getItem(`${key}_metadata`);
      if (!metadataStr) {
        return {
          hasFile: false,
          canLoad: false,
          dataCount: 0,
          fileSize: '0KB',
          isValid: false,
          issues: ['元数据文件不存在']
        };
      }

      const metadata = JSON.parse(metadataStr);
      const issues: string[] = [];
      let actualChunks = 0;

      // 检查所有分片是否存在
      for (let i = 0; i < metadata.totalChunks; i++) {
        const chunkKey = `${key}_chunk_${i}`;
        if (localStorage.getItem(chunkKey)) {
          actualChunks++;
        } else {
          issues.push(`分片 ${i} 缺失`);
        }
      }

      const totalSize = await this.calculateTotalSize(key, metadata.totalChunks);

      return {
        hasFile: true,
        canLoad: actualChunks === metadata.totalChunks,
        dataCount: metadata.totalRecords,
        fileSize: `${(totalSize / 1024).toFixed(2)}KB`,
        isValid: actualChunks === metadata.totalChunks && issues.length === 0,
        issues,
        actualChunks,
        expectedChunks: metadata.totalChunks
      };
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

  // 计算总大小
  private async calculateTotalSize(key: string, totalChunks: number): Promise<number> {
    let totalSize = 0;
    for (let i = 0; i < totalChunks; i++) {
      const chunkKey = `${key}_chunk_${i}`;
      const chunk = localStorage.getItem(chunkKey);
      if (chunk) {
        totalSize += new Blob([chunk]).size;
      }
    }
    return totalSize;
  }
}
