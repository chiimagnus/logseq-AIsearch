// 向量数据相关类型定义

export interface VectorData {
  blockUUID: string;
  pageName: string;
  blockContent: string;
  vector: number[];
  lastUpdated: number;
}

// 优化的存储数据结构（减少冗余）
export interface CompactVectorData {
  u: string;      // blockUUID (缩短字段名)
  p: string;      // pageName
  c: string;      // blockContent (预处理后的内容)
  v: number[];    // vector (可选择降低精度)
  t: number;      // lastUpdated timestamp
}

export type VectorDatabase = VectorData[];

export interface BlockWithPage {
  uuid: string;
  content: string;
  pageName: string;
}

export interface VectorSearchResult {
  blockUUID: string;
  pageName: string;
  blockContent: string;
  score: number;
}

export interface VectorStoreStats {
  count: number;
  dim: number;
  backend: string;
  storageStats?: {
    totalChunks?: number;
    compressionRatio?: string;
    compressedSizeMB?: string;
    sizeMB?: string;
  };
}

export interface VectorDataIntegrity {
  isValid: boolean;
  hasFile: boolean;
  canLoad: boolean;
  dataCount: number;
  fileSize: string;
  issues: string[];
} 