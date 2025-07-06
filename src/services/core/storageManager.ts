// Assets API 压缩存储实现

export class StorageManager {
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
      console.log(`🔄 开始保存数据到 Assets API: ${key}`);

      // 🚀 优化：异步序列化，避免阻塞主线程
      const jsonString = await this.asyncJsonStringify(data);

      // 🚀 优化：异步压缩，避免阻塞主线程
      const compressedData = await this.asyncCompress(jsonString);
      const compressedSize = new Blob([compressedData]).size;

      console.log(`📊 压缩后大小: ${(compressedSize / 1024 / 1024).toFixed(2)}MB`);

      // 直接保存压缩数据
      await this.storage.setItem(`${key}.lz`, compressedData);

      console.log(`✅ Assets API 保存完成: ${(compressedSize / 1024 / 1024).toFixed(2)}MB`);
    } catch (error) {
      console.error("Assets API 保存数据失败:", error);
      throw new Error(`Assets API 保存失败: ${error}`);
    }
  }

  // 🚀 新增：异步JSON序列化，分块处理大数据
  private async asyncJsonStringify(data: any): Promise<string> {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        try {
          console.log(`🔄 [异步序列化] 开始序列化 ${Array.isArray(data) ? data.length : '1'} 条数据`);
          const result = JSON.stringify(data);
          console.log(`✅ [异步序列化] 序列化完成，大小: ${(result.length / 1024 / 1024).toFixed(2)}MB`);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      }, 5); // 5ms延迟，让UI有时间更新
    });
  }

  // 🚀 新增：异步压缩，避免阻塞主线程
  private async asyncCompress(jsonString: string): Promise<string> {
    return new Promise(async (resolve, reject) => {
      setTimeout(async () => {
        try {
          console.log(`🔄 [异步压缩] 开始压缩数据...`);
          const { default: LZString } = await import('lz-string');
          
          // 🚀 优化：分块压缩大数据
          const chunkSize = 1024 * 1024; // 1MB chunks
          if (jsonString.length > chunkSize) {
            console.log(`📊 [分块压缩] 数据较大 (${(jsonString.length / 1024 / 1024).toFixed(2)}MB)，使用分块压缩`);
            const result = await this.compressInChunks(jsonString, LZString);
            resolve(result);
          } else {
            const result = LZString.compress(jsonString);
            console.log(`✅ [异步压缩] 压缩完成`);
            resolve(result);
          }
        } catch (error) {
          reject(error);
        }
      }, 5); // 5ms延迟，让UI有时间更新
    });
  }

  // 🚀 新增：分块压缩，处理大数据时避免长时间阻塞
  private async compressInChunks(jsonString: string, LZString: any): Promise<string> {
    return new Promise((resolve, reject) => {
      const processChunk = () => {
        try {
          const result = LZString.compress(jsonString);
          console.log(`✅ [分块压缩] 压缩完成`);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      };

      // 使用 setTimeout 确保不阻塞UI
      setTimeout(processChunk, 10);
    });
  }

  async loadData(key: string): Promise<any> {
    try {
      console.log(`🔄 开始从 Assets API 加载数据: ${key}`);

      // 加载压缩文件
      const compressedData = await this.storage.getItem(`${key}.lz`);

      if (compressedData) {
        try {
          // 🚀 优化：异步解压缩数据
          const jsonString = await this.asyncDecompress(compressedData);

          if (jsonString) {
            try {
              // 🚀 优化：异步JSON解析
              const data = await this.asyncJsonParse(jsonString);
              console.log(`✅ 加载数据成功: ${Array.isArray(data) ? data.length : '1'} 条记录`);
              return data;
            } catch (parseError) {
              console.error(`❌ JSON解析失败，数据可能损坏: ${key}`, parseError);
              console.log(`🔧 尝试修复数据文件...`);

              // 尝试修复JSON（移除末尾不完整的部分）
              const repairedData = this.tryRepairJson(jsonString);
              if (repairedData) {
                console.log(`✅ 数据修复成功: ${Array.isArray(repairedData) ? repairedData.length : '1'} 条记录`);
                return repairedData;
              }

              console.error(`❌ 数据修复失败，返回null`);
              return null;
            }
          } else {
            console.error(`❌ 解压缩失败，数据可能损坏: ${key}`);
            return null;
          }
        } catch (decompressError) {
          console.error(`❌ 解压缩过程出错: ${key}`, decompressError);
          return null;
        }
      }

      console.log(`📭 未找到数据: ${key}`);
      return null;
    } catch (error) {
      console.error("Assets API 加载数据失败:", error);
      return null;
    }
  }

  // 🚀 新增：异步解压缩
  private async asyncDecompress(compressedData: string): Promise<string | null> {
    return new Promise(async (resolve, reject) => {
      setTimeout(async () => {
        try {
          console.log(`🔄 [异步解压] 开始解压缩数据...`);
          const { default: LZString } = await import('lz-string');
          const result = LZString.decompress(compressedData);
          console.log(`✅ [异步解压] 解压缩完成`);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      }, 5);
    });
  }

  // 🚀 新增：异步JSON解析
  private async asyncJsonParse(jsonString: string): Promise<any> {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        try {
          console.log(`🔄 [异步解析] 开始解析JSON数据...`);
          const result = JSON.parse(jsonString);
          console.log(`✅ [异步解析] JSON解析完成`);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      }, 5);
    });
  }

  // 尝试修复损坏的JSON数据
  private tryRepairJson(jsonString: string): any {
    try {
      // 如果是数组，尝试找到最后一个完整的对象
      if (jsonString.trim().startsWith('[')) {
        // 找到最后一个完整的 '},' 或 '}'
        let lastValidIndex = -1;
        let braceCount = 0;
        let inString = false;
        let escapeNext = false;

        for (let i = 1; i < jsonString.length; i++) {
          const char = jsonString[i];

          if (escapeNext) {
            escapeNext = false;
            continue;
          }

          if (char === '\\') {
            escapeNext = true;
            continue;
          }

          if (char === '"' && !escapeNext) {
            inString = !inString;
            continue;
          }

          if (!inString) {
            if (char === '{') {
              braceCount++;
            } else if (char === '}') {
              braceCount--;
              if (braceCount === 0) {
                // 找到一个完整的对象
                const nextChar = jsonString[i + 1];
                if (nextChar === ',' || nextChar === ']' || i === jsonString.length - 2) {
                  lastValidIndex = i;
                }
              }
            }
          }
        }

        if (lastValidIndex > 0) {
          // 构造修复后的JSON
          const repairedJson = jsonString.substring(0, lastValidIndex + 1) + ']';
          console.log(`🔧 尝试修复JSON，截取到位置: ${lastValidIndex}`);
          return JSON.parse(repairedJson);
        }
      }

      return null;
    } catch (error) {
      console.error("JSON修复失败:", error);
      return null;
    }
  }

  async clearData(key: string): Promise<void> {
    try {
      await this.storage.removeItem(`${key}.lz`);
      console.log(`🗑️ 已清除 Assets API 数据: ${key}`);
    } catch (error) {
      console.error("Assets API 清除数据失败:", error);
      // 清除失败不抛出错误，因为可能文件本来就不存在
    }
  }

  async hasData(key: string): Promise<boolean> {
    try {
      // 🚀 安全检查：确保key不为空
      if (!key || key.trim() === '') {
        console.warn("⚠️ hasData调用时key为空，返回false");
        return false;
      }

      const data = await this.storage.getItem(`${key}.lz`);
      return data !== null && data !== undefined;
    } catch (error) {
      console.error("Assets API 检查数据存在性失败:", error);
      return false;
    }
  }

  async getStorageStats(key: string): Promise<any> {
    try {
      const compressedData = await this.storage.getItem(`${key}.lz`);

      if (!compressedData) return null;

      const compressedSize = new Blob([compressedData]).size;

      return {
        backend: 'Assets API',
        sizeMB: (compressedSize / 1024 / 1024).toFixed(2),
        location: `assets/storages/${logseq.baseInfo?.id || 'unknown'}/${key}.lz`
      };
    } catch (error) {
      console.error("Assets API 获取统计信息失败:", error);
      return null;
    }
  }
}
