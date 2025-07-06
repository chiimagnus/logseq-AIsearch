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
    const maxRetries = 3;
    const timeoutMs = 30000; // 30秒超时

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 开始保存数据到 Assets API: ${key} (尝试 ${attempt}/${maxRetries})`);

        const jsonString = JSON.stringify(data);

        // 使用LZ-String压缩
        const { default: LZString } = await import('lz-string');
        const compressedData = LZString.compress(jsonString);
        const compressedSize = new Blob([compressedData]).size;

        console.log(`📊 压缩后大小: ${(compressedSize / 1024 / 1024).toFixed(2)}MB`);

        // 添加超时控制的保存操作
        await Promise.race([
          this.storage.setItem(`${key}.lz`, compressedData),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('保存操作超时')), timeoutMs)
          )
        ]);

        console.log(`✅ Assets API 保存完成: ${(compressedSize / 1024 / 1024).toFixed(2)}MB`);
        return; // 成功保存，退出重试循环

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`❌ Assets API 保存数据失败 (尝试 ${attempt}/${maxRetries}):`, errorMsg);

        if (attempt === maxRetries) {
          // 最后一次尝试失败
          throw new Error(`Assets API 保存失败 (${maxRetries}次尝试后): ${errorMsg}`);
        }

        // 等待后重试
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // 指数退避，最大5秒
        console.log(`⏳ 等待 ${delay}ms 后重试...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  async loadData(key: string): Promise<any> {
    try {
      console.log(`🔄 开始从 Assets API 加载数据: ${key}`);

      // 加载压缩文件
      const compressedData = await this.storage.getItem(`${key}.lz`);

      if (compressedData) {
        try {
          // 解压缩数据
          const { default: LZString } = await import('lz-string');
          const jsonString = LZString.decompress(compressedData);

          if (jsonString) {
            try {
              const data = JSON.parse(jsonString);
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
