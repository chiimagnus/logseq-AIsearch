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

      const jsonString = JSON.stringify(data);
      const originalSize = new Blob([jsonString]).size;
      console.log(`📊 原始数据大小: ${(originalSize / 1024 / 1024).toFixed(2)}MB`);

      // 使用LZ-String压缩
      const { default: LZString } = await import('lz-string');
      const compressedData = LZString.compress(jsonString);
      const compressedSize = new Blob([compressedData]).size;

      console.log(`📊 压缩后大小: ${(compressedSize / 1024 / 1024).toFixed(2)}MB (压缩率: ${((1 - compressedSize / originalSize) * 100).toFixed(1)}%)`);

      // 直接保存压缩数据
      await this.storage.setItem(`${key}.lz`, compressedData);

      console.log(`✅ Assets API 保存完成: ${(compressedSize / 1024 / 1024).toFixed(2)}MB`);
    } catch (error) {
      console.error("Assets API 保存数据失败:", error);
      throw new Error(`Assets API 保存失败: ${error}`);
    }
  }

  async loadData(key: string): Promise<any> {
    try {
      console.log(`🔄 开始从 Assets API 加载数据: ${key}`);

      // 加载压缩文件
      const compressedData = await this.storage.getItem(`${key}.lz`);

      if (compressedData) {
        // 解压缩数据
        const { default: LZString } = await import('lz-string');
        const jsonString = LZString.decompress(compressedData);

        if (jsonString) {
          const data = JSON.parse(jsonString);
          console.log(`✅ 加载数据成功: ${Array.isArray(data) ? data.length : '1'} 条记录`);
          return data;
        }
      }

      console.log(`📭 未找到数据: ${key}`);
      return null;
    } catch (error) {
      console.error("Assets API 加载数据失败:", error);
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

      // 获取原始大小
      let originalSize = compressedSize;
      try {
        const { default: LZString } = await import('lz-string');
        const decompressed = LZString.decompress(compressedData);
        if (decompressed) {
          originalSize = new Blob([decompressed]).size;
        }
      } catch (error) {
        console.warn("无法获取原始大小:", error);
      }

      return {
        backend: 'Assets API',
        sizeMB: (compressedSize / 1024 / 1024).toFixed(2),
        originalSizeMB: (originalSize / 1024 / 1024).toFixed(2),
        compressionRatio: ((1 - compressedSize / originalSize) * 100).toFixed(1) + '%',
        location: `assets/storages/${logseq.baseInfo?.id || 'unknown'}/${key}.lz`
      };
    } catch (error) {
      console.error("Assets API 获取统计信息失败:", error);
      return null;
    }
  }
}
