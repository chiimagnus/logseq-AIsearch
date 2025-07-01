// 封装了 AI 模型加载、数据库初始化、内容索引和向量搜索的全部核心逻辑。

import * as lancedb from '@lancedb/lancedb';
import { pipeline, env } from '@xenova/transformers';
import { BlockEntity } from '@logseq/libs/dist/LSPlugin';

// 1. 定义核心变量
let db: lancedb.Connection;
let table: lancedb.Table;
let extractor: any;
let isInitialized = false;

// 动态获取批处理大小
function getBatchSize(): number {
  return Number(logseq.settings?.vectorBatchSize) || 100;
}

// 动态获取embedding模型名称
function getEmbeddingModelName(): string {
  const selected = String(logseq.settings?.embeddingModel || "Xenova/all-MiniLM-L6-v2 (推荐/Recommended)");
  // 提取实际的模型名称
  if (selected.includes("all-MiniLM-L6-v2")) return "Xenova/all-MiniLM-L6-v2";
  if (selected.includes("all-distilroberta-v1")) return "Xenova/all-distilroberta-v1";
  if (selected.includes("multi-qa-MiniLM-L6-cos-v1")) return "Xenova/multi-qa-MiniLM-L6-cos-v1";
  return "Xenova/all-MiniLM-L6-v2"; // 默认值
}
const VECTOR_DIMENSION = 384; // all-MiniLM-L6-v2 模型的维度

// 2. 初始化函数
export async function initializeVectorStore() {
  if (isInitialized) {
    console.log("Vector store already initialized.");
    return;
  }
  console.log("Vector store initializing...");
  
  try {
    // 初始化 Embedding 模型
    if (!extractor) {
        logseq.UI.showMsg("开始加载AI模型，请稍候...", "success", { timeout: 3000 });
        env.cacheDir = `${logseq.settings!.pluginDir}/.cache`;
        const modelName = getEmbeddingModelName();
        extractor = await pipeline('feature-extraction', modelName, {
            progress_callback: (progress: any) => {
                console.log("Model loading progress:", progress);
                if (progress.status === 'progress') {
                    const percentage = Math.round(progress.progress);
                    logseq.UI.showMsg(`AI模型加载中... ${percentage}%`);
                }
            }
        });
        console.log("Embedding model loaded.");
        logseq.UI.showMsg("✅ AI模型加载完成", "success", { timeout: 3000 });
    }

    // 初始化 LanceDB
    if (!db) {
        const dbPath = `${logseq.settings!.pluginDir}/.lancedb`;
        db = await lancedb.connect(dbPath);
        console.log("LanceDB connected.");
    }

    // 获取或创建数据表
    const tableNames = await db.tableNames();
    if (tableNames.includes('logseq_blocks')) {
        table = await db.openTable('logseq_blocks');
        console.log("Opened existing table 'logseq_blocks'.");
    } else {
        console.log("Creating new table 'logseq_blocks'...");
        const dummyData = [{
            vector: Array(VECTOR_DIMENSION).fill(0),
            blockUUID: "dummy",
            pageName: "dummy",
            blockContent: "dummy"
        }];
        table = await db.createTable("logseq_blocks", dummyData, { mode: "overwrite" });
        console.log("Created new table 'logseq_blocks'.");
    }

    isInitialized = true;
    console.log("Vector store initialized successfully.");

  } catch (error) {
      console.error("Vector store initialization failed:", error);
      logseq.UI.showMsg("AI服务初始化失败，请检查控制台日志", "error");
  }
}

// 3. 索引全部页面
export async function indexAllPages() {
  if (!isInitialized || !db || !table || !extractor) {
    logseq.UI.showMsg("AI 服务未初始化，请稍后再试。", "error");
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

    console.log(`Found ${allBlocks.length} blocks to index.`);
    
    // 清空旧表并重建
    await db.dropTable("logseq_blocks");
    const dummyData = [{ vector: Array(VECTOR_DIMENSION).fill(0), blockUUID: "dummy", pageName: "dummy", blockContent: "dummy" }];
    table = await db.createTable("logseq_blocks", dummyData, { mode: "overwrite" });
    console.log("Old table dropped and new table created for re-indexing.");

    let indexedCount = 0;
    const batchSize = getBatchSize();
    for (let i = 0; i < allBlocks.length; i += batchSize) {
      const batch = allBlocks.slice(i, i + batchSize);
      const contents = batch.map(b => b.content);
      
      const embeddings = await extractor(contents, { pooling: 'mean', normalize: true });

      const data = batch.map((block, index) => {
        const vector = Array.from(embeddings.data.slice(index * VECTOR_DIMENSION, (index + 1) * VECTOR_DIMENSION));
        return {
          vector,
          blockUUID: block.uuid,
          pageName: block.pageName,
          blockContent: block.content
        };
      });

      await table.add(data);
      indexedCount += batch.length;

      const progress = Math.round((indexedCount / allBlocks.length) * 100);
      logseq.UI.showMsg(`索引建立中... ${progress}% (${indexedCount}/${allBlocks.length})`);
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
    hasExtractor: !!extractor
  };
}

// 5. 搜索函数
export async function search(queryText: string) {
  if (!isInitialized || !table || !extractor) {
    const status = getInitializationStatus();
    console.error("Vector search service not properly initialized:", status);
    logseq.UI.showMsg("向量搜索服务未初始化，请检查设置或重建索引 | Vector search service not initialized", "error");
    return [];
  }

  try {
    console.log(`Searching for: "${queryText}"`);

    // 1. 为查询文本生成 embedding
    const result: { data: Float32Array } = await extractor(queryText, { pooling: 'mean', normalize: true });
    const queryVector: number[] = Array.from(result.data);

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
    const sampleData = await table.search([0.1, 0.1, 0.1, ...Array(381).fill(0)]).limit(5).toArray();
    
    return {
      totalBlocks: countResult,
      modelInfo: {
        name: getEmbeddingModelName(),
        dimension: VECTOR_DIMENSION,
        type: "Transformers.js based"
      },
      indexInfo: {
        batchSize: getBatchSize(),
        hasSearchIndex: true
      },
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
  if (!extractor) {
    return { error: "Extractor not initialized" };
  }

  try {
    const result1: { data: Float32Array } = await extractor(query1, { pooling: 'mean', normalize: true });
    const result2: { data: Float32Array } = await extractor(query2, { pooling: 'mean', normalize: true });
    
    const vector1 = Array.from(result1.data);
    const vector2 = Array.from(result2.data);
    
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