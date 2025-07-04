// 负责封装 AI 模型加载、数据存储、内容索引和向量搜索的核心逻辑。

import { BlockEntity } from '@logseq/libs/dist/LSPlugin';
import { StorageManager, StorageBackend } from './storageManager';

// 1. 定义核心数据结构
interface VectorData {
  blockUUID: string;
  pageName: string;
  blockContent: string;
  vector: number[];
  lastUpdated: number;
}

type VectorDatabase = VectorData[];

// 2. 核心变量
let isInitialized = false;
const VECTOR_STORAGE_KEY = 'vector-data';
let storageManager: StorageManager;

// 3. 配置函数
function getEmbeddingServiceType(): 'ollama' | 'cloud' {
  const selected = String(logseq.settings?.embeddingModel || "Ollama本地模型 / Ollama Local Model");
  return selected.includes("Ollama") ? 'ollama' : 'cloud';
}

function getVectorDimension(): number {
  const serviceType = getEmbeddingServiceType();
  if (serviceType === 'ollama') {
    // nomic-embed-text 的维度是 768
    return 768;
  } else {
    // BAAI/bge-m3 的维度是 1024  
    return 1024;
  }
}

// 4. 存储和加载函数
async function saveVectorData(vectorData: VectorDatabase): Promise<void> {
  try {
    if (!storageManager) {
      throw new Error("存储管理器未初始化");
    }

    await storageManager.saveData(VECTOR_STORAGE_KEY, vectorData);
    console.log(`保存了 ${vectorData.length} 条向量数据到 ${storageManager.getCurrentBackend()} 存储`);
  } catch (error) {
    console.error("保存向量数据失败:", error);
    throw error;
  }
}

async function loadVectorData(): Promise<VectorDatabase> {
  try {
    if (!storageManager) {
      console.log("存储管理器未初始化，返回空数组");
      return [];
    }

    const vectorData = await storageManager.loadData(VECTOR_STORAGE_KEY);
    if (!vectorData) {
      console.log("向量数据不存在，返回空数组");
      return [];
    }

    console.log(`从 ${storageManager.getCurrentBackend()} 存储加载了 ${vectorData.length} 条向量数据`);
    return vectorData;
  } catch (error) {
    console.error("加载向量数据失败:", error);
    return [];
  }
}

// 5. Embedding 生成函数
async function generateOllamaEmbedding(text: string): Promise<number[]> {
  const ollamaHost = String(logseq.settings?.ollamaHost || "http://localhost:11434");
  const modelName = String(logseq.settings?.ollamaEmbeddingModel || "nomic-embed-text");
  
  try {
    const response = await fetch(`${ollamaHost}/api/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelName,
        prompt: text
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.embedding;
  } catch (error) {
    console.error("Ollama embedding failed:", error);
    throw error;
  }
}

async function generateCloudEmbedding(text: string): Promise<number[]> {
  const apiUrl = String(logseq.settings?.cloudEmbeddingApiUrl || "https://api.siliconflow.cn/v1/embeddings");
  const apiKey = String(logseq.settings?.cloudEmbeddingApiKey || "");
  const modelName = String(logseq.settings?.cloudEmbeddingModel || "BAAI/bge-m3");

  if (!apiKey) {
    throw new Error("云端API密钥未设置 / Cloud API key not set");
  }

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelName,
        input: text
      })
    });

    if (!response.ok) {
      throw new Error(`Cloud API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
  } catch (error) {
    console.error("Cloud embedding failed:", error);
    throw error;
  }
}

async function generateEmbedding(text: string): Promise<number[]> {
  const serviceType = getEmbeddingServiceType();
  
  if (serviceType === 'ollama') {
    return await generateOllamaEmbedding(text);
  } else {
    return await generateCloudEmbedding(text);
  }
}

// 6. 向量搜索函数
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error('向量维度不匹配');
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  if (normA === 0 || normB === 0) {
    return 0;
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// 7. 初始化函数
export async function initializeVectorStore() {
  if (isInitialized) {
    console.log("Vector store already initialized.");
    return;
  }
  console.log("Vector store initializing...");

  try {
    console.log("Vector storage initializing...");

    // 从设置中获取用户偏好的存储后端
    const storagePreference = String(logseq.settings?.vectorStorageBackend || "Assets API 存储 (推荐) / Assets API Storage (Recommended)");
    const preferredBackend = storagePreference.includes('Assets') ? 'assets' : 'chunked-localStorage';

    // 初始化存储管理器
    storageManager = new StorageManager(preferredBackend);

    // 自动选择最佳存储后端
    try {
      const selectedBackend = await storageManager.autoSelectBackend();

      // 显示存储后端信息
      const backendNames = {
        'assets': 'Assets API',
        'chunked-localStorage': '分块压缩存储',
        'simple-localStorage': '简单存储'
      };

      logseq.UI.showMsg(
        `📦 存储后端: ${backendNames[selectedBackend] || selectedBackend}`,
        "info",
        { timeout: 3000 }
      );

      console.log(`✅ 存储系统初始化完成，使用: ${selectedBackend}`);

    } catch (error) {
      console.error("存储后端选择失败:", error);
      logseq.UI.showMsg("❌ 存储系统初始化失败", "error", { timeout: 5000 });
      return;
    }

    logseq.UI.showMsg("向量存储系统已初始化", "info", { timeout: 3000 });

    // 测试embedding服务连接
    const serviceType = getEmbeddingServiceType();
    logseq.UI.showMsg(`🔧 正在测试${serviceType === 'ollama' ? 'Ollama' : '云端'}embedding服务...`, "info");

    try {
      await generateEmbedding("测试连接");
      logseq.UI.showMsg(`✅ ${serviceType === 'ollama' ? 'Ollama' : '云端'}embedding服务连接成功`, "success", { timeout: 3000 });
    } catch (error) {
      console.error("Embedding service test failed:", error);
      logseq.UI.showMsg(`❌ embedding服务连接失败: ${error}`, "error", { timeout: 8000 });
      return;
    }

    isInitialized = true;
    console.log("Vector store initialized successfully.");

  } catch (error) {
      console.error("Vector store initialization failed:", error);
      logseq.UI.showMsg("向量存储初始化失败，请检查控制台日志", "error");
  }
}

// 8. 索引所有页面
export async function indexAllPages() {
  if (!isInitialized) {
    logseq.UI.showMsg("向量存储未初始化，请稍后再试。", "error");
    return;
  }

  try {
    logseq.UI.showMsg("开始建立向量索引...", "success");
    console.log("Starting to build vector index...");

    const allBlocks = await getAllBlocksWithPage();
    if (!allBlocks || allBlocks.length === 0) {
      logseq.UI.showMsg("没有需要索引的内容。", "warning");
      console.log("No blocks found to index.");
      return;
    }

    // 索引所有blocks
    const blocksToIndex = allBlocks;
    
    console.log(`Found ${allBlocks.length} blocks total, indexing all blocks.`);
    
    // 首先清除旧数据，开始全新索引
    await saveVectorData([]);
    
    let vectorData: VectorDatabase = [];
    let indexedCount = 0;
    const currentTime = Date.now();
    const batchSize = 10; // 批处理大小
    const saveBatchSize = 100; // 每处理100个blocks保存一次
    
    // 分批处理以提高速度
    for (let i = 0; i < blocksToIndex.length; i += batchSize) {
      const batch = blocksToIndex.slice(i, i + batchSize);
      
      // 并行处理当前批次
      const batchPromises = batch.map(async (block) => {
        try {
          const vector = await generateEmbedding(block.content);
          return {
            blockUUID: block.uuid,
            pageName: block.pageName,
            blockContent: block.content,
            vector: vector,
            lastUpdated: currentTime
          };
        } catch (error) {
          console.error(`Failed to generate embedding for block ${block.uuid}:`, error);
          return null; // 标记为失败
        }
      });
      
      // 等待当前批次完成
      const batchResults = await Promise.all(batchPromises);
      
      // 过滤掉失败的结果并添加到vectorData
      const validResults = batchResults.filter((result): result is VectorData => result !== null);
      vectorData.push(...validResults);
      
      indexedCount += batch.length;
      
      // 每处理saveBatchSize个blocks就保存一次（增量保存）
      if (indexedCount % saveBatchSize === 0 || indexedCount === blocksToIndex.length) {
        await saveVectorData(vectorData);
        console.log(`💾 已保存 ${vectorData.length} 条向量数据到本地存储`);
      }
      
      // 显示详细进度
      const progress = Math.round((indexedCount / blocksToIndex.length) * 100);
      if (indexedCount % 1000 === 0 || indexedCount === blocksToIndex.length) {
        logseq.UI.showMsg(`索引建立中... ${progress}% (${indexedCount}/${blocksToIndex.length}) | 成功: ${vectorData.length}`);
        console.log(`Indexed ${indexedCount}/${blocksToIndex.length} blocks (${progress}%) | Success: ${vectorData.length}`);
      }
    }
    
    logseq.UI.showMsg(`✅ 索引建立完成！共处理 ${indexedCount} 个blocks，成功索引 ${vectorData.length} 条内容。`, "success", { timeout: 5000 });

  } catch (error) {
    console.error("Failed to index all pages:", error);
    logseq.UI.showMsg("索引建立失败，请检查控制台日志。", "error");
  }
}

interface BlockWithPage {
  uuid: string;
  content: string;
  pageName: string;
}

// 9. 获取所有页面中的 Block
async function getAllBlocksWithPage(): Promise<BlockWithPage[]> {
  try {
    const allPages = await logseq.Editor.getAllPages();
    if (!allPages) {
      return [];
    }

    let allBlocks: BlockWithPage[] = [];

    for (const page of allPages) {
      const pageBlocks = await logseq.Editor.getPageBlocksTree(page.name);
      if (pageBlocks) {
        const flattenedBlocks = flattenBlocks(pageBlocks).map(block => ({
          uuid: block.uuid,
          content: block.content,
          pageName: page.name
        }));
        allBlocks = allBlocks.concat(flattenedBlocks);
      }
    }
    
    // 过滤掉内容为空的 block
    return allBlocks.filter(block => block.content && block.content.trim() !== '');

  } catch (error) {
    console.error("Error getting all blocks:", error);
    return [];
  }
}

function flattenBlocks(blocks: BlockEntity[]): BlockEntity[] {
  let flattened: BlockEntity[] = [];
  for (const block of blocks) {
    flattened.push(block);
    if (block.children && block.children.length > 0) {
      flattened = flattened.concat(flattenBlocks(block.children as BlockEntity[]));
    }
  }
  return flattened;
}

// 10. 获取初始化状态
export function getInitializationStatus() {
  return { isInitialized };
}

// 11. 搜索函数
export async function search(queryText: string, limit: number = 50) {
  if (!isInitialized) {
    logseq.UI.showMsg("向量存储未初始化，请稍后再试。", "error");
    return null;
  }

  try {
    console.log(`Searching for: "${queryText}"`);
    
    // 生成查询向量
    const queryVector = await generateEmbedding(queryText);
    
    // 加载所有向量数据
    const vectorData = await loadVectorData();
    
    if (vectorData.length === 0) {
      logseq.UI.showMsg("向量数据为空，请先建立索引", "warning");
      return [];
    }
    
    // 计算相似度并排序
    const results = vectorData.map(item => ({
      blockUUID: item.blockUUID,
      pageName: item.pageName,
      blockContent: item.blockContent,
      score: cosineSimilarity(queryVector, item.vector)
    }))
    .filter(item => item.score > 0.3)  // 过滤掉相似度太低的结果
    .sort((a, b) => b.score - a.score)  // 按相似度降序排列
    .slice(0, limit);  // 取前 limit 个结果

    console.log("Search results:", results);
    return results;

  } catch (error) {
    console.error("Search failed:", error);
    logseq.UI.showMsg("搜索失败，请检查控制台日志。", "error");
    return null;
  }
}

// 12. 获取向量存储统计信息
export async function getVectorStoreStats() {
  if (!isInitialized || !storageManager) {
    return { count: 0, dim: 0, backend: 'none' };
  }

  try {
    const vectorData = await loadVectorData();
    const count = vectorData.length;
    const dim = vectorData.length > 0 ? vectorData[0].vector.length : getVectorDimension();
    const backend = storageManager.getCurrentBackend();
    const storageStats = await storageManager.getStorageStats(VECTOR_STORAGE_KEY);

    return {
      count,
      dim,
      backend,
      storageStats
    };
  } catch (error) {
    console.error("Failed to get vector store stats:", error);
    return { count: 0, dim: getVectorDimension(), backend: 'error' };
  }
}

// 13. 清除向量数据
export async function clearVectorData() {
  if (!storageManager) {
    throw new Error("存储管理器未初始化");
  }

  try {
    await storageManager.clearData(VECTOR_STORAGE_KEY);
    console.log("向量数据已清除");
  } catch (error) {
    console.error("清除向量数据失败:", error);
    throw error;
  }
}

// 14. 切换存储后端
export async function switchStorageBackend(backend: StorageBackend) {
  if (!storageManager) {
    throw new Error("存储管理器未初始化");
  }

  try {
    await storageManager.switchBackend(backend);
    console.log(`已切换到存储后端: ${backend}`);
  } catch (error) {
    console.error("切换存储后端失败:", error);
    throw error;
  }
}

// 15. 数据迁移
export async function migrateVectorData(fromBackend: StorageBackend, toBackend: StorageBackend) {
  if (!storageManager) {
    throw new Error("存储管理器未初始化");
  }

  try {
    await storageManager.migrateData(fromBackend, toBackend, VECTOR_STORAGE_KEY);
    console.log(`数据迁移完成: ${fromBackend} -> ${toBackend}`);
  } catch (error) {
    console.error("数据迁移失败:", error);
    throw error;
  }
}