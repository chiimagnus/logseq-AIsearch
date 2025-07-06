// 负责封装 AI 模型加载、数据存储、内容索引和向量搜索的核心逻辑。

import { BlockEntity } from '@logseq/libs/dist/LSPlugin';
import { StorageManager } from './storageManager';

// 1. 定义核心数据结构
interface VectorData {
  blockUUID: string;
  pageName: string;
  blockContent: string;
  vector: number[];
  lastUpdated: number;
}

// 优化的存储数据结构（减少冗余）
interface CompactVectorData {
  u: string;      // blockUUID (缩短字段名)
  p: string;      // pageName
  c: string;      // blockContent (预处理后的内容)
  v: number[];    // vector (可选择降低精度)
  t: number;      // lastUpdated timestamp
}

type VectorDatabase = VectorData[];

// 向量数据优化函数
function optimizeVectorData(data: VectorData[]): CompactVectorData[] {
  return data.map(item => ({
    u: item.blockUUID,
    p: item.pageName,
    c: preprocessContent(item.blockContent), // 使用预处理后的内容
    v: compressVector(item.vector), // 压缩向量精度
    t: item.lastUpdated
  }));
}

function restoreVectorData(compactData: CompactVectorData[]): VectorData[] {
  return compactData.map(item => ({
    blockUUID: item.u,
    pageName: item.p,
    blockContent: item.c,
    vector: item.v,
    lastUpdated: item.t
  }));
}

// 向量精度压缩（减少小数位数）
function compressVector(vector: number[]): number[] {
  return vector.map(v => Math.round(v * 10000) / 10000); // 保留4位小数
}

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

    // 使用优化的数据结构存储
    const compactData = optimizeVectorData(vectorData);
    await storageManager.saveData(VECTOR_STORAGE_KEY, compactData);

    console.log(`保存了 ${vectorData.length} 条向量数据到 Assets API 存储 (优化格式)`);
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

    const compactData = await storageManager.loadData(VECTOR_STORAGE_KEY);
    if (!compactData) {
      console.log("向量数据不存在，返回空数组");
      return [];
    }

    // 检查数据格式，兼容旧格式
    let vectorData: VectorDatabase;
    if (Array.isArray(compactData) && compactData.length > 0) {
      // 检查是否是新的压缩格式
      if ('u' in compactData[0]) {
        vectorData = restoreVectorData(compactData as CompactVectorData[]);
        console.log(`从 Assets API 存储加载了 ${vectorData.length} 条向量数据 (优化格式)`);
      } else {
        vectorData = compactData as VectorDatabase;
        console.log(`从 Assets API 存储加载了 ${vectorData.length} 条向量数据 (兼容格式)`);
      }
    } else {
      vectorData = [];
    }

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
      }),
      // 增加超时时间，避免长时间等待
      signal: AbortSignal.timeout(30000) // 30秒超时
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

// 智能重试机制
async function generateEmbeddingWithRetry(text: string, maxRetries: number = 3): Promise<number[]> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const serviceType = getEmbeddingServiceType();

      if (serviceType === 'ollama') {
        return await generateOllamaEmbedding(text);
      } else {
        return await generateCloudEmbedding(text);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.warn(`⚠️ [重试] Embedding生成失败 (${attempt}/${maxRetries}): ${errorMsg}`);

      if (attempt === maxRetries) {
        throw error; // 最后一次尝试失败，抛出错误
      }

      // 指数退避延迟
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
      console.log(`⏳ [延迟] 等待${delay}ms后重试...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw new Error("所有重试都失败了");
}

async function generateEmbedding(text: string): Promise<number[]> {
  return await generateEmbeddingWithRetry(text);
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

    // 初始化存储管理器
    try {
      storageManager = new StorageManager();
      logseq.UI.showMsg("📦 存储后端: Assets API (压缩存储)", "info", { timeout: 3000 });
      console.log("✅ 存储系统初始化完成，使用: Assets API");
    } catch (error) {
      console.error("存储系统初始化失败:", error);
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

// 8. 索引所有页面（重新索引）
export async function indexAllPages() {
  return await indexPages(false);
}

// 9. 继续索引（增量索引）
export async function continueIndexing() {
  return await indexPages(true);
}

// 核心索引函数
async function indexPages(isContinue: boolean = false) {
  if (!isInitialized) {
    logseq.UI.showMsg("向量存储未初始化，请稍后再试。", "error");
    return;
  }

  try {
    const actionText = isContinue ? "继续建立" : "重新建立";
    logseq.UI.showMsg(`开始${actionText}向量索引...`, "success");
    console.log(`\n🚀 ===== ${actionText}向量索引 =====`);

    const allBlocks = await getAllBlocksWithPage();
    if (!allBlocks || allBlocks.length === 0) {
      logseq.UI.showMsg("没有需要索引的内容。", "warning");
      console.log("❌ 未找到需要索引的blocks");
      return;
    }

    // 加载现有向量数据
    let existingVectorData: VectorDatabase = [];
    let blocksToIndex: BlockWithPage[] = [];

    if (isContinue) {
      existingVectorData = await loadVectorData();

      // 检查是否存在数据文件但加载失败的情况
      const hasDataFile = await storageManager?.hasData(VECTOR_STORAGE_KEY);

      if (hasDataFile && existingVectorData.length === 0) {
        console.warn("⚠️ 检测到向量数据文件存在但加载失败，可能数据已损坏");

        logseq.UI.showMsg(
          "⚠️ 检测到向量数据文件存在但无法加载，可能是索引过程被中断导致数据损坏。\n" +
          "将自动清除损坏的数据并重新开始索引...",
          "warning",
          { timeout: 5000 }
        );

        // 等待用户看到消息
        await new Promise(resolve => setTimeout(resolve, 2000));

        console.log("🔄 自动清除损坏数据并重新索引");
        await saveVectorData([]);
        existingVectorData = [];
        blocksToIndex = allBlocks;
        console.log(`📊 重新索引统计: 总共${allBlocks.length}个blocks`);
      } else {
        const existingUUIDs = new Set(existingVectorData.map(item => item.blockUUID));

        // 只索引新的blocks
        blocksToIndex = allBlocks.filter(block => !existingUUIDs.has(block.uuid));

        console.log(`📊 继续索引统计:`);
        console.log(`   • 总blocks: ${allBlocks.length}`);
        console.log(`   • 已索引: ${existingVectorData.length}`);
        console.log(`   • 待索引: ${blocksToIndex.length}`);

        if (blocksToIndex.length === 0) {
          logseq.UI.showMsg("所有内容都已索引完成！", "success");
          console.log("✅ 所有blocks都已索引，无需继续");
          return;
        }
      }
    } else {
      // 重新索引所有blocks
      blocksToIndex = allBlocks;
      console.log(`📊 重新索引统计: 总共${allBlocks.length}个blocks`);

      // 清除旧数据
      await saveVectorData([]);
      console.log("🗑️ 已清除旧的向量数据");
    }

    let vectorData: VectorDatabase = [...existingVectorData];
    let indexedCount = 0;
    const startTime = Date.now();
    const batchSize = 10; // 批处理大小
    const saveBatchSize = 500; // 减少保存频率，提高性能
    
    // 分批处理，添加延迟避免卡顿
    for (let i = 0; i < blocksToIndex.length; i += batchSize) {
      const batch = blocksToIndex.slice(i, i + batchSize);

      // 并行处理当前批次
      const batchPromises = batch.map(async (block) => {
        try {
          // 使用预处理后的内容生成embedding
          const processedContent = preprocessContent(block.content);
          const vector = await generateEmbedding(processedContent);
          const compressedVector = compressVector(vector);

          return {
            blockUUID: block.uuid,
            pageName: block.pageName,
            blockContent: processedContent, // 存储预处理后的内容
            vector: compressedVector, // 存储压缩后的向量
            lastUpdated: startTime
          };
        } catch (error) {
          console.warn(`⚠️ [失败] Block ${block.uuid.slice(0, 8)}... embedding生成失败:`, error instanceof Error ? error.message : error);
          return null; // 标记为失败
        }
      });
      
      // 等待当前批次完成
      const batchResults = await Promise.all(batchPromises);

      // 过滤掉失败的结果并添加到vectorData
      const validResults = batchResults.filter((result): result is VectorData => result !== null);
      vectorData.push(...validResults);

      indexedCount += batch.length;

      // 添加延迟避免UI卡顿，让主线程有时间处理其他任务
      if (i + batchSize < blocksToIndex.length) {
        await new Promise(resolve => setTimeout(resolve, 100)); // 100ms延迟
      }
      
      // 每处理saveBatchSize个blocks就保存一次（增量保存）
      if (indexedCount % saveBatchSize === 0 || indexedCount === blocksToIndex.length) {
        await saveVectorData(vectorData);
        console.log(`💾 [保存] 已保存 ${vectorData.length} 条向量数据`);
      }

      // 显示详细进度和性能统计
      const progress = Math.round((indexedCount / blocksToIndex.length) * 100);
      const successRate = Math.round((vectorData.length / (indexedCount || 1)) * 100);
      const elapsedTime = Date.now() - startTime;
      const avgTime = indexedCount > 0 ? elapsedTime / indexedCount : 0;
      const estimatedTotal = avgTime * blocksToIndex.length;
      const remainingTime = Math.max(0, estimatedTotal - elapsedTime);

      if (indexedCount % 1000 === 0 || indexedCount === blocksToIndex.length) {
        console.log(`\n📊 [进度] ${progress}% (${indexedCount}/${blocksToIndex.length})`);
        console.log(`   ✅ 成功: ${vectorData.length} 条 (${successRate}%)`);
        console.log(`   ⚡ 速度: ${avgTime.toFixed(0)}ms/条`);
        console.log(`   ⏱️ 预计剩余: ${(remainingTime / 1000 / 60).toFixed(1)}分钟`);

        logseq.UI.showMsg(
          `🔄 ${actionText}索引进度: ${progress}%\n` +
          `📝 已处理: ${indexedCount}/${blocksToIndex.length}\n` +
          `✅ 成功: ${vectorData.length}条 (${successRate}%)\n` +
          `⏱️ 预计剩余: ${(remainingTime / 1000 / 60).toFixed(1)}分钟`,
          "info",
          { timeout: 3000 }
        );
      }
    }
    
    const totalTime = (Date.now() - startTime) / 1000;
    const finalSuccessRate = Math.round((vectorData.length / (indexedCount || 1)) * 100);

    console.log(`\n🎉 ===== ${actionText}索引完成 =====`);
    console.log(`   📊 总计处理: ${indexedCount} 个blocks`);
    console.log(`   ✅ 成功索引: ${vectorData.length} 条 (${finalSuccessRate}%)`);
    console.log(`   ⏱️ 总耗时: ${totalTime.toFixed(1)}秒`);
    console.log(`   ⚡ 平均速度: ${(totalTime / indexedCount * 1000).toFixed(0)}ms/条`);
    console.log(`===============================\n`);

    logseq.UI.showMsg(
      `🎉 ${actionText}索引完成！\n` +
      `📊 处理: ${indexedCount}个blocks\n` +
      `✅ 成功: ${vectorData.length}条 (${finalSuccessRate}%)\n` +
      `⏱️ 耗时: ${totalTime.toFixed(1)}秒`,
      "success",
      { timeout: 8000 }
    );

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

// 内容预处理函数
function preprocessContent(content: string): string {
  // 移除多余的空白字符
  content = content.replace(/\s+/g, ' ').trim();

  // 移除logseq特殊语法，保留核心内容
  content = content.replace(/\[\[([^\]]+)\]\]/g, '$1'); // 移除双括号链接
  content = content.replace(/#\w+/g, ''); // 移除标签
  content = content.replace(/\*\*([^*]+)\*\*/g, '$1'); // 移除粗体标记
  content = content.replace(/\*([^*]+)\*/g, '$1'); // 移除斜体标记

  return content.trim();
}

// 检查内容是否值得索引
function isContentWorthIndexing(content: string): boolean {
  const processed = preprocessContent(content);

  // 过滤条件
  if (processed.length < 10) return false; // 太短
  if (processed.length > 2000) return false; // 太长，可能是代码块
  if (/^[\d\s\-\.\,]+$/.test(processed)) return false; // 只包含数字和符号
  if (/^https?:\/\//.test(processed)) return false; // 只是URL

  return true;
}

// 9. 获取所有页面中的 Block
async function getAllBlocksWithPage(): Promise<BlockWithPage[]> {
  try {
    const allPages = await logseq.Editor.getAllPages();
    if (!allPages) {
      return [];
    }

    let allBlocks: BlockWithPage[] = [];
    const seenContent = new Set<string>(); // 用于去重

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

    // 智能过滤和去重
    const filteredBlocks = allBlocks.filter(block => {
      if (!block.content || block.content.trim() === '') return false;

      // 检查内容是否值得索引
      if (!isContentWorthIndexing(block.content)) return false;

      // 去重：基于预处理后的内容
      const processedContent = preprocessContent(block.content);
      if (seenContent.has(processedContent)) return false;

      seenContent.add(processedContent);
      return true;
    });

    console.log(`📊 内容过滤统计: 原始${allBlocks.length}个blocks → 过滤后${filteredBlocks.length}个blocks`);
    return filteredBlocks;

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
    const backend = 'Assets API';
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

// 14. 检查向量数据完整性
export async function checkVectorDataIntegrity(): Promise<{
  isValid: boolean;
  hasFile: boolean;
  canLoad: boolean;
  dataCount: number;
  fileSize: string;
  issues: string[];
}> {
  if (!isInitialized || !storageManager) {
    return {
      isValid: false,
      hasFile: false,
      canLoad: false,
      dataCount: 0,
      fileSize: '0MB',
      issues: ['向量服务未初始化']
    };
  }

  const issues: string[] = [];
  let hasFile = false;
  let canLoad = false;
  let dataCount = 0;
  let fileSize = '0MB';

  try {
    // 检查文件是否存在
    hasFile = await storageManager.hasData(VECTOR_STORAGE_KEY);

    if (hasFile) {
      // 获取文件大小
      const storageStats = await storageManager.getStorageStats(VECTOR_STORAGE_KEY);
      fileSize = storageStats?.sizeMB ? `${storageStats.sizeMB}MB` : '未知';

      // 尝试加载数据
      const vectorData = await loadVectorData();
      if (vectorData && Array.isArray(vectorData)) {
        canLoad = true;
        dataCount = vectorData.length;

        // 检查数据结构完整性
        if (vectorData.length > 0) {
          const sample = vectorData[0];
          if (!sample.blockUUID || !sample.vector || !Array.isArray(sample.vector)) {
            issues.push('向量数据结构不完整');
          }

          // 检查向量维度一致性
          const expectedDim = getVectorDimension();
          const inconsistentDims = vectorData.filter(item =>
            !item.vector || item.vector.length !== expectedDim
          );

          if (inconsistentDims.length > 0) {
            issues.push(`发现${inconsistentDims.length}条向量维度不一致的数据`);
          }
        }
      } else {
        issues.push('无法加载向量数据，可能文件已损坏');
      }
    } else {
      issues.push('向量数据文件不存在');
    }

    const isValid = hasFile && canLoad && issues.length === 0;

    return {
      isValid,
      hasFile,
      canLoad,
      dataCount,
      fileSize,
      issues
    };

  } catch (error) {
    issues.push(`检查过程出错: ${error}`);
    return {
      isValid: false,
      hasFile,
      canLoad: false,
      dataCount: 0,
      fileSize,
      issues
    };
  }
}

