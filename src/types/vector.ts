// 向量数据相关类型定义

export interface VectorData {
  blockUUID: string;
  pageName: string;
  blockContent: string;
  vector: number[];
  lastUpdated: number;
}

export type VectorDatabase = VectorData[];

// 优化的存储数据结构（减少冗余）
export interface CompactVectorData {
  u: string;      // blockUUID (缩短字段名)
  p: string;      // pageName
  c: string;      // blockContent (预处理后的内容)
  v: number[];    // vector (可选择降低精度)
  t: number;      // lastUpdated timestamp
}

// 向量存储清单
export interface VectorStoreManifest {
  nextShardId: number;
  shards: string[]; // 分片文件名列表
  totalCount: number; // 总向量数
}

// 向量存储统计信息
export interface VectorStoreStats {
  count: number;
  dim: number;
  backend: string;
  storageStats?: any;
}

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

 