// 负责封装 AI 模型加载、数据库初始化、内容索引和向量搜索的核心逻辑。

import * as duckdb from '@duckdb/duckdb-wasm';
import { BlockEntity } from '@logseq/libs/dist/LSPlugin';

// 1. 定义核心变量
let db: duckdb.AsyncDuckDB;
let isInitialized = false;
const TABLE_NAME = 'logseq_blocks';

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

// 2. 初始化函数 (Rewritten for DuckDB)
export async function initializeVectorStore() {
  if (isInitialized) {
    console.log("Vector store already initialized.");
    return;
  }
  console.log("Vector store initializing with DuckDB-WASM...");

  try {
    const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();
    const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);
    
    const worker_url = URL.createObjectURL(
        new Blob([`importScripts("${bundle.mainWorker!}");`], {type: 'application/javascript'})
    );

    // Instantiate the async DB
    const worker = new Worker(worker_url);
    const logger = new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING); // Only show warnings and errors
    db = new duckdb.AsyncDuckDB(logger, worker);
    await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
    URL.revokeObjectURL(worker_url);
    
    // Connect to a persistent database
    await db.open({
        path: 'logseq-ai-search.db',
    });

    const conn = await db.connect();
    console.log("DuckDB-WASM initialized and connected to persistent storage.");
    logseq.UI.showMsg("DuckDB 向量数据库已连接", "info", { timeout: 3000 });

    // Install and load VSS extension
    await conn.query(`INSTALL vss;`);
    await conn.query(`LOAD vss;`);
    console.log("VSS extension for DuckDB loaded.");

    // Create table if it doesn't exist
    const vectorDim = getVectorDimension();
    await conn.query(`
      CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
        blockUUID VARCHAR PRIMARY KEY,
        pageName VARCHAR,
        blockContent TEXT,
        vector FLOAT[]
      );
    `);
    console.log(`Table '${TABLE_NAME}' is ready.`);

    await conn.close();

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
      console.error("Vector store (DuckDB) initialization failed:", error);
      logseq.UI.showMsg("向量数据库初始化失败，请检查控制台日志", "error");
  }
}

// 3. 索引全部页面
export async function indexAllPages() {
  if (!isInitialized || !db) {
    logseq.UI.showMsg("向量数据库未初始化，请稍后再试。", "error");
    return;
  }

  const conn = await db.connect();
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
    await conn.query(`DROP TABLE IF EXISTS ${TABLE_NAME};`);
    await conn.query(`
      CREATE TABLE ${TABLE_NAME} (
        blockUUID VARCHAR PRIMARY KEY,
        pageName VARCHAR,
        blockContent TEXT,
        vector FLOAT[]
      );
    `);
    console.log("Old table dropped and new table created for re-indexing.");

    let indexedCount = 0;
    const batchSize = getBatchSize();
    
    for (let i = 0; i < blocksToIndex.length; i += batchSize) {
      const batch = blocksToIndex.slice(i, i + batchSize);
      
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
        // Register JSON data as temporary file and insert
        const jsonData = JSON.stringify(data);
        await db.registerFileText(`batch_${i}.json`, jsonData);
        await conn.insertJSONFromPath(`batch_${i}.json`, { name: TABLE_NAME });
        console.log(`Added batch of ${data.length} blocks to database.`);
      }
    }

    console.log("Start creating HNSW index on vector column.");
    logseq.UI.showMsg(`索引数据添加完毕，开始构建快速搜索索引...`, "success");
    await conn.query(`CREATE INDEX hnsw_idx ON ${TABLE_NAME} USING HNSW (vector);`);
    console.log("HNSW Index created successfully.");

    logseq.UI.showMsg(`✅ 索引建立完成！共 ${indexedCount} 条内容。`, "success", { timeout: 5000 });

  } catch (error) {
    console.error("Failed to index all pages:", error);
    logseq.UI.showMsg("索引建立失败，请检查控制台日志。", "error");
  } finally {
    await conn.close();
  }
}

interface BlockWithPage {
  uuid: string;
  content: string;
  pageName: string;
}

// 4. 获取所有页面中的 Block
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

// 5. 获取初始化状态
export function getInitializationStatus() {
  return { isInitialized };
}

// 6. 搜索函数
export async function search(queryText: string, limit: number = 10) {
  if (!isInitialized || !db) {
    logseq.UI.showMsg("向量数据库未初始化，请稍后再试。", "error");
    return null;
  }

  const conn = await db.connect();
  try {
    console.log(`Searching for: "${queryText}"`);
    const queryVector = await generateEmbedding(queryText);

    const p_stmt = await conn.prepare(
      `SELECT
          blockUUID,
          pageName,
          blockContent, 
          list_similarity(vector, ?) AS score
       FROM ${TABLE_NAME}
       ORDER BY score DESC
       LIMIT ?;`
    );
    
    const result = await p_stmt.query(queryVector, limit);
    const searchResults = result.toArray().map(row => row.toJSON());
    
    await p_stmt.close();

    console.log("Search results:", searchResults);
    return searchResults;

  } catch (error) {
    console.error("Search failed:", error);
    logseq.UI.showMsg("搜索失败，请检查控制台日志。", "error");
    return null;
  } finally {
    await conn.close();
  }
}

// 7. 获取数据库统计信息
export async function getVectorStoreStats() {
    if (!isInitialized || !db) {
        return { count: 0, dim: 0 };
    }
    const conn = await db.connect();
    try {
        const countResult = await conn.query(`SELECT COUNT(*) as count FROM ${TABLE_NAME};`);
        const count = countResult.toArray()[0].toJSON().count as number;
        const dim = getVectorDimension();
        return { count, dim };
    } catch (error) {
        console.error("Failed to get vector store stats:", error);
        return { count: 0, dim: getVectorDimension() };
    } finally {
      await conn.close();
    }
} 