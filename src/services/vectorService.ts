// 封装了 AI 模型加载、数据库初始化、内容索引和向量搜索的全部核心逻辑。

import * as lancedb from '@lancedb/lancedb';
import { BlockEntity } from '@logseq/libs/dist/LSPlugin';

// 1. 定义核心变量
let db: lancedb.Connection;
let table: lancedb.Table;
let isInitialized = false;

// 动态获取批处理大小
function getBatchSize(): number {
  return Number(logseq.settings?.vectorBatchSize) || 100;
}

// 获取embedding服务类型
function getEmbeddingServiceType(): 'ollama' | 'cloud' {
  const selected = String(logseq.settings?.embeddingModel || "Ollama本地模型 / Ollama Local Model");
  return selected.includes("Ollama") ? 'ollama' : 'cloud';
}

// 获取向量维度（根据不同模型）
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

// Ollama API调用
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

// 云端API调用
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

// 统一的embedding生成函数
async function generateEmbedding(text: string): Promise<number[]> {
  const serviceType = getEmbeddingServiceType();
  
  if (serviceType === 'ollama') {
    return await generateOllamaEmbedding(text);
  } else {
    return await generateCloudEmbedding(text);
  }
}

// 2. 初始化函数
export async function initializeVectorStore() {
  if (isInitialized) {
    console.log("Vector store already initialized.");
    return;
  }
  console.log("Vector store initializing...");
  
  try {
    // 初始化 LanceDB
    if (!db) {
        const dbPath = `${logseq.settings!.pluginDir}/.lancedb`;
        db = await lancedb.connect(dbPath);
        console.log(`LanceDB connected at: ${dbPath}`);
        logseq.UI.showMsg(`📁 向量数据库路径: ${dbPath}`, "info", { timeout: 5000 });
    }

    // 获取或创建数据表
    const tableNames = await db.tableNames();
    const vectorDim = getVectorDimension();
    
    if (tableNames.includes('logseq_blocks')) {
        table = await db.openTable('logseq_blocks');
        console.log("Opened existing table 'logseq_blocks'.");
    } else {
        console.log("Creating new table 'logseq_blocks'...");
        const dummyData = [{
            vector: Array(vectorDim).fill(0),
            blockUUID: "dummy",
            pageName: "dummy",
            blockContent: "dummy"
        }];
        table = await db.createTable("logseq_blocks", dummyData, { mode: "overwrite" });
        console.log("Created new table 'logseq_blocks'.");
    }

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
      logseq.UI.showMsg("向量数据库初始化失败，请检查控制台日志", "error");
  }
}

// 3. 索引全部页面
export async function indexAllPages() {
  if (!isInitialized || !db || !table) {
    logseq.UI.showMsg("向量数据库未初始化，请稍后再试。", "error");
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

    // 测试模式：只索引部分blocks
    const testLimit = Number(logseq.settings?.testModeBlockLimit) || 0;
    const blocksToIndex = testLimit > 0 ? allBlocks.slice(0, testLimit) : allBlocks;
    
    console.log(`Found ${allBlocks.length} blocks total, indexing ${blocksToIndex.length} blocks.`);
    if (testLimit > 0) {
      logseq.UI.showMsg(`🧪 测试模式：只索引前 ${blocksToIndex.length} 个blocks`, "info", { timeout: 3000 });
    }
    
    // 清空旧表并重建
    await db.dropTable("logseq_blocks");
    const vectorDim = getVectorDimension();
    const dummyData = [{ vector: Array(vectorDim).fill(0), blockUUID: "dummy", pageName: "dummy", blockContent: "dummy" }];
    table = await db.createTable("logseq_blocks", dummyData, { mode: "overwrite" });
    console.log("Old table dropped and new table created for re-indexing.");

    let indexedCount = 0;
    const batchSize = getBatchSize();
    
    for (let i = 0; i < blocksToIndex.length; i += batchSize) {
      const batch = blocksToIndex.slice(i, i + batchSize);
      
      // 逐个生成embedding（避免批处理API限制）
      const data = [];
      for (const block of batch) {
        try {
          const vector = await generateEmbedding(block.content);
          data.push({
            vector,
            blockUUID: block.uuid,
            pageName: block.pageName,
            blockContent: block.content
          });
          indexedCount++;
          
          // 显示详细进度
          const progress = Math.round((indexedCount / blocksToIndex.length) * 100);
          if (indexedCount % 10 === 0 || indexedCount === blocksToIndex.length) {
            logseq.UI.showMsg(`索引建立中... ${progress}% (${indexedCount}/${blocksToIndex.length})`);
            console.log(`Indexed ${indexedCount}/${blocksToIndex.length} blocks (${progress}%)`);
          }
        } catch (error) {
          console.error(`Failed to generate embedding for block ${block.uuid}:`, error);
          // 继续处理其他blocks
        }
      }

      if (data.length > 0) {
        await table.add(data);
        console.log(`Added batch of ${data.length} blocks to database.`);
      }
    }

    console.log("Start creating IVF_PQ index on vector column.");
    logseq.UI.showMsg(`索引数据添加完毕，开始构建快速搜索索引...`, "success");
    await table.createIndex("vector");
    console.log("Index created successfully.");

    logseq.UI.showMsg(`✅ 索引建立完成！共 ${indexedCount} 条内容。`, "success", { timeout: 5000 });

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

async function getAllBlocksWithPage(): Promise<BlockWithPage[]> {
  try {
    const allPages = await logseq.Editor.getAllPages();
    if (!allPages) return [];

    let allBlocksWithPage: BlockWithPage[] = [];

    for (const page of allPages) {
      if (page.name) {
        const pageBlocks = await logseq.Editor.getPageBlocksTree(page.name);
        const flatBlocks = flattenBlocks(pageBlocks);
        
        const blocksWithPage = flatBlocks
          .filter(block => block.content && block.content.trim() !== '')
          .map(block => ({
            uuid: block.uuid,
            content: block.content,
            pageName: page.name
          }));
        
        allBlocksWithPage.push(...blocksWithPage);
      }
    }
    return allBlocksWithPage;
  } catch (error) {
    console.error("Error getting all blocks:", error);
    return [];
  }
}

function flattenBlocks(blocks: BlockEntity[]): BlockEntity[] {
  let flatBlocks: BlockEntity[] = [];
  for (const block of blocks) {
    flatBlocks.push(block);
    if (block.children && block.children.length > 0) {
      flatBlocks = flatBlocks.concat(flattenBlocks(block.children as BlockEntity[]));
    }
  }
  return flatBlocks;
}

// 4. 获取初始化状态
export function getInitializationStatus() {
  return {
    isInitialized,
    hasDatabase: !!db,
    hasTable: !!table,
    embeddingService: getEmbeddingServiceType()
  };
}

// 5. 搜索函数
export async function search(queryText: string) {
  if (!isInitialized || !table) {
    const status = getInitializationStatus();
    console.error("Vector search service not properly initialized:", status);
    logseq.UI.showMsg("向量搜索服务未初始化，请检查设置或重建索引 | Vector search service not initialized", "error");
    return [];
  }

  try {
    console.log(`Searching for: "${queryText}"`);

    // 1. 为查询文本生成 embedding
    const queryVector = await generateEmbedding(queryText);

    // 2. 执行搜索
    const searchResults = await table
      .search(queryVector)
      .limit(Number(logseq.settings?.maxResults || 50))
      .toArray();
    
    console.log(`Found ${searchResults.length} results.`);
    return searchResults;

  } catch (error) {
    console.error("Search failed:", error);
    logseq.UI.showMsg("搜索失败，请检查控制台日志。", "error");
    return [];
  }
}

// 添加调试和统计功能
export async function getVectorStoreStats() {
  if (!isInitialized || !table) {
    return {
      error: "Vector store not initialized"
    };
  }

  try {
    const countResult = await table.countRows();
    const vectorDim = getVectorDimension();
    const sampleData = await table.search([0.1, 0.1, 0.1, ...Array(vectorDim - 3).fill(0)]).limit(5).toArray();
    
    const serviceType = getEmbeddingServiceType();
    const serviceConfig = serviceType === 'ollama' 
      ? {
          host: String(logseq.settings?.ollamaHost || "http://localhost:11434"),
          model: String(logseq.settings?.ollamaEmbeddingModel || "nomic-embed-text")
        }
      : {
          apiUrl: String(logseq.settings?.cloudEmbeddingApiUrl || ""),
          model: String(logseq.settings?.cloudEmbeddingModel || "BAAI/bge-m3")
        };
    
    return {
      totalBlocks: countResult,
      modelInfo: {
        serviceType,
        dimension: vectorDim,
        config: serviceConfig
      },
      indexInfo: {
        batchSize: getBatchSize(),
        hasSearchIndex: true,
        testModeLimit: Number(logseq.settings?.testModeBlockLimit) || 0
      },
      databasePath: `${logseq.settings!.pluginDir}/.lancedb`,
      sampleBlocks: sampleData.map(item => ({
        blockUUID: item.blockUUID,
        pageName: item.pageName,
        contentPreview: item.blockContent.substring(0, 100) + "...",
        vectorPreview: item.vector.slice(0, 5) // 只显示前5个维度
      }))
    };
  } catch (error) {
    return {
      error: `Failed to get stats: ${error}`
    };
  }
}

// 添加相似度测试功能
export async function testSimilarity(query1: string, query2: string) {
  if (!isInitialized) {
    return { error: "Vector store not initialized" };
  }

  try {
    const vector1 = await generateEmbedding(query1);
    const vector2 = await generateEmbedding(query2);
    
    // 计算余弦相似度
    const dotProduct = vector1.reduce((sum, a, i) => sum + a * vector2[i], 0);
    const magnitude1 = Math.sqrt(vector1.reduce((sum, a) => sum + a * a, 0));
    const magnitude2 = Math.sqrt(vector2.reduce((sum, a) => sum + a * a, 0));
    const similarity = dotProduct / (magnitude1 * magnitude2);
    
    return {
      query1,
      query2,
      similarity,
      interpretation: similarity > 0.8 ? "很相似" : similarity > 0.6 ? "较相似" : similarity > 0.4 ? "有些相似" : "不太相似"
    };
  } catch (error) {
    return { error: `Similarity test failed: ${error}` };
  }
} 