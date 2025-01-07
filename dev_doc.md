# Logseq AI搜索插件开发文档

## 1. 系统架构

### 1.1 整体架构设计

本插件采用分层架构设计，主要分为四个核心层次：

```
┌─────────────────────────────────┐
│        Logseq Plugin API        │
├─────────────────────────────────┤
│         前端界面层
│  ┌─────────────────────────┐
│  │     设置界面   搜索界面
│  └─────────────────────────┘   
├─────────────────────────────────┤
│         搜索逻辑层
│  ┌─────────────────────────┐   
│  │  关键词提取  相关度计算     
│  │  批量处理   结果排序       
│  └─────────────────────────┘   
├─────────────────────────────────┤
│          AI 服务层            
│  ┌─────────────────────────┐   
│  │   Ollama   智谱清言      
│  └─────────────────────────┘   
└─────────────────────────────────┘
```

### 1.2 前端界面层

前端界面层主要负责用户交互和结果展示，包含以下核心组件：

1. **设置界面**
   - 插件配置管理
   - API选择与参数设置
   - 搜索行为自定义

2. **搜索交互**
   - 命令面板集成（/AI-Search）
   - 快捷键支持（alt+mod+a）
   - 搜索结果展示

3. **状态反馈**
   - 搜索进度提示
   - 错误信息展示
   - 操作成功反馈

### 1.3 搜索逻辑层

搜索逻辑层是插件的核心处理层，实现了以下功能：

1. **搜索流程控制**
   ```typescript
   export async function aiSearch(query: string): Promise<{summary: string, results: SearchResult[]}> {
     // 1. 关键词提取
     const keywords = await extractKeywords(query);
     
     // 2. 基于关键词的初筛
     const initialResults = await semanticSearch(keywords);
     
     // 3. AI评分筛选
     const refinedResults = await batchEvaluateRelevance(query, initialResults);
     
     // 4. 生成总结
     const summary = await generate(getSummaryPrompt(query, formattedResults));
     
     return { summary, results: refinedResults };
   }
   ```

2. **相关度评分系统**
   - 位置权重计算
   - 完整匹配判断
   - 密度权重评估
   - 共现分析处理

3. **批量处理优化**
   - 并行任务处理
   - 分批次评估
   - 结果排序与筛选

### 1.4 AI服务层

AI服务层提供了模型调用的统一接口，支持多种模型后端：

1. **Ollama集成**
   ```typescript
   export async function ollamaGenerate(prompt: string): Promise<string> {
     const host = logseq.settings?.host || 'localhost:11434';
     const model = logseq.settings?.model || 'qwen2.5';
     // API调用实现
   }
   ```

2. **智谱清言集成**
   ```typescript
   export async function zhipuGenerate(prompt: string): Promise<string> {
     const apiKey = logseq.settings?.zhipuApiKey;
     const openai = new OpenAI({
       apiKey: apiKey,
       baseURL: "https://open.bigmodel.cn/api/paas/v4"
     });
     // API调用实现
   }
   ```

### 1.5 Logseq插件集成层

插件集成层负责与Logseq平台的交互：

1. **插件生命周期管理**
   ```typescript
   function main() {
     // 注册设置
     logseq.useSettingsSchema(settings);
     
     // 注册命令
     logseq.Editor.registerSlashCommand("AI-Search", aiSearchCommand);
     
     // 注册快捷键
     logseq.App.registerCommandShortcut(
       { binding: logseq.settings?.shortcut || "alt+mod+a" },
       aiSearchCommand
     );
   }
   ```

2. **数据访问接口**
   - 块内容读取
   - 搜索结果写入
   - 设置项管理

### 1.6 核心模块说明

1. **主程序入口（main.tsx）**
   - 插件初始化
   - 组件注册
   - 事件监听

2. **搜索引擎（apiSelector.ts）**
   - 搜索流程控制
   - 模型选择
   - 结果处理

3. **关键词提取（keywordExtraction.ts）**
   - 智能分词
   - 关键词权重计算
   - 多语言支持

4. **AI模型集成（ollama.ts/zhipu.ts）**
   - API封装
   - 错误处理
   - 响应解析

5. **工具函数（utils.ts）**
   - 相关度计算
   - 语言检测
   - 批处理优化

## 2. 核心算法实现

### 2.1 智能搜索算法

智能搜索算法采用多阶段搜索策略，结合关键词提取和AI评分，实现精准的搜索结果：

1. **搜索流程**
   ```typescript
   async function aiSearch(query: string) {
     // 第一阶段：关键词提取
     const keywords = await extractKeywords(query);
     
     // 第二阶段：基础搜索
     const initialResults = await semanticSearch(keywords);
     
     // 第三阶段：AI评分优化
     const refinedResults = await batchEvaluateRelevance(query, initialResults);
     
     // 第四阶段：内容总结
     const summary = enableAISummary ? await generate(getSummaryPrompt(query, results)) : "";
     
     return { summary, results: refinedResults };
   }
   ```

2. **查询优化**
   - 关键词权重分配
   - 多维度匹配策略
   - 结果排序机制

### 2.2 关键词提取机制

关键词提取采用基于AI的智能分析方法：

1. **提取流程**
   ```typescript
   export async function extractKeywords(input: string): Promise<string[]> {
     const lang = detectLanguage(input);
     const prompt = buildKeywordExtractionPrompt(input, lang);
     const response = await generate(prompt);
     
     try {
       const cleanedResponse = response.replace(/```json\s*|\s*```/g, '').trim();
       const keywords = JSON.parse(cleanedResponse);
       return keywords;
     } catch (error) {
       console.error("关键词解析失败:", error);
       return [];
     }
   }
   ```

2. **关键特性**
   - 智能语义分析
   - 多语言支持
   - 权重排序
   - 关键词去重

### 2.3 相关度评分算法

相关度评分算法采用多维度加权计算方式：

```typescript
export function calculateRelevanceScore(block: any, keywords: string[], importantKeywords: string[]): number {
  const content = block.content.toLowerCase();
  let score = 0;

  // 1. 关键词匹配和共现分析
  keywords.forEach(keyword => {
    const matches = content.matchAll(new RegExp(keyword, 'gi'));
    if (matches.length > 0) {
      // 位置权重
      const positionWeight = Math.exp(-matches[0].index! / 100);
      // 完整匹配权重
      const exactMatchWeight = content.includes(` ${keyword} `) ? 2.0 : 1;
      // 密度权重
      const densityWeight = matches.length > 1 ? 1.1 : 1;
      
      let keywordScore = 3 * positionWeight * exactMatchWeight * densityWeight;
      
      // 重要关键词加权
      if (importantKeywords.includes(keyword)) {
        keywordScore *= 1.5;
      }
      
      score += keywordScore;
    }
  });

  // 2. 内容长度权重
  const lengthWeight = 1 / (1 + Math.exp((content.length - 300) / 300));
  score *= lengthWeight;

  return Math.max(0, Math.min(10, score));
}
```

### 2.4 批量处理优化

批量处理机制通过并行计算提升性能：

```typescript
async function batchEvaluateRelevance(query: string, results: SearchResult[]): Promise<SearchResult[]> {
  const batchSize = logseq.settings?.batchSize || 10;
  const refinedResults: SearchResult[] = [];
  
  for (let i = 0; i < results.length; i += batchSize) {
    const batch = results.slice(i, i + batchSize);
    const currentBatch = i / batchSize + 1;
    
    // 并行处理批次
    const batchPromises = batch.map(async (result) => {
      const relevanceScore = await evaluateRelevance(query, result.block.content);
      return relevanceScore > minScore ? { ...result, score: relevanceScore } : null;
    });

    const batchResults = await Promise.all(batchPromises);
    refinedResults.push(...batchResults.filter((r): r is SearchResult => r !== null));
  }

  return refinedResults.sort((a, b) => b.score - a.score);
}
```

### 2.5 AI总结生成

AI总结功能采用结构化的分析方法：

1. **总结流程**
   ```typescript
   function getSummaryPrompt(query: string, content: string): string {
     const lang = detectLanguage(query);
     return lang === 'en' ? `
       As your friendly life secretary, I'll help analyze the notes...
     ` : `
       作为你的贴心小助手，我来帮你分析...
     `;
   }
   ```

2. **关键特性**
   - 内容充分性评估
   - 时间线分析
   - 个性化见解提取
   - 上下文补充

### 2.6 Prompt设计

Prompt设计采用模板化方案，确保AI输出的一致性：

1. **关键词提取模板**
   ```typescript
   const keywordExtractionPrompt = `
     分析用户输入"${input}"，智能提取关键信息：
     1. 识别核心要素:
        - 主题词/专业术语/核心概念
        - 行为动作/方法论/理论框架
     2. 提取关键信息:
        - 时间/地点/人物等具体要素
        - 专业领域的限定词
     3. 返回格式：JSON数组
   `;
   ```

2. **相关度评估模板**
   ```typescript
   const relevancePrompt = `
     评估笔记与问题的关联度：
     1. 内容关联（0-4分）
     2. 时间维度（0-3分）
     3. 个人意义（0-3分）
     仅返回0-10的分数
   `;
   ```

### 2.7 多语言支持

多语言支持通过语言检测和模板切换实现：

```typescript
export function detectLanguage(text: string): 'en' | 'zh' {
  // 计算英文字符的比例
  const englishChars = text.match(/[a-zA-Z]/g)?.length || 0;
  // 计算中文字符的比例
  const chineseChars = text.match(/[\u4e00-\u9fa5]/g)?.length || 0;
  
  return englishChars > chineseChars ? 'en' : 'zh';
}
```

### 2.8 上下文处理

上下文处理机制确保搜索结果的完整性：

1. **上下文获取**
   ```typescript
   async function getBlockContext(block: any) {
     const includeParent = logseq.settings?.includeParent ?? true;
     const includeSiblings = logseq.settings?.includeSiblings ?? true;
     const includeChildren = logseq.settings?.includeChildren ?? true;
     
     let fullContent = block.content;
     
     if (includeParent) {
       // 获取父块内容
       const parentBlock = await getParentBlock(block);
       if (parentBlock) {
         fullContent = `${parentBlock.content}\n${fullContent}`;
       }
     }
     
     if (includeSiblings) {
       // 获取兄弟块内容
       const siblings = await getSiblingBlocks(block);
       fullContent += "\n--- 相关内容 ---\n" + siblings.join("\n");
     }
     
     return fullContent;
   }
   ```

2. **关键特性**
   - 父块关联
   - 兄弟块分析
   - 子块包含
   - 上下文权重计算

## 3. 关键技术点详解

### 3.1 相关度评分机制

相关度评分是搜索结果排序的核心机制，采用多维度综合评分方法：

1. **评分组成**
   ```typescript
   let score = 0;
   // 基础分值计算
   const baseScore = keywordMatches * 3;
   // 位置权重
   score += baseScore * positionWeight;
   // 完整匹配权重
   score *= exactMatchWeight;
   // 密度权重
   score *= densityWeight;
   // 长度权重
   score *= lengthWeight;
   ```

2. **评分范围**
   - 最终分数范围：0-10分
   - 重要性分级：
     - 8-10分：极高相关
     - 6-8分：高度相关
     - 4-6分：中度相关
     - 0-4分：低相关

### 3.2 位置权重

位置权重基于关键词在内容中的位置计算：

```typescript
// 位置权重计算
const positionWeight = Math.exp(-firstMatchIndex / 100);

// 权重效果示例：
// 位置索引   权重值
// 0         1.000
// 50        0.607
// 100       0.368
// 200       0.135
```

位置权重的设计原理：
1. 使用指数衰减函数
2. 前置内容获得更高权重
3. 平滑过渡，避免突变

### 3.3 完整匹配权重

完整匹配权重用于提升精确匹配的重要性：

```typescript
// 完整匹配判断
const exactMatchWeight = content.includes(` ${keyword} `) ? 2.0 : 1.0;

// 特殊情况处理
const specialCases = {
  startOfLine: /^keyword/,
  endOfLine: /keyword$/,
  punctuation: /[,.!?:;]keyword|keyword[,.!?:;]/
};

// 完整性判断
function isExactMatch(content: string, keyword: string): boolean {
  return specialCases.some(pattern => pattern.test(content));
}
```

### 3.4 密度权重

密度权重反映关键词在内容中的集中度：

```typescript
// 密度权重计算
function calculateDensityWeight(matches: number, contentLength: number): number {
  // 基础密度
  const density = matches / (contentLength / 100);
  
  // 密度权重曲线
  const densityWeight = 1 + Math.log1p(density);
  
  // 密度上限控制
  return Math.min(densityWeight, 1.5);
}
```

密度权重特点：
1. 对重复出现的关键词给予适度奖励
2. 采用对数函数避免过度权重
3. 设置上限防止垃圾内容干扰

### 3.5 共现分析

共现分析用于发现关键词之间的关联：

```typescript
// 共现分析实现
function analyzeCoOccurrence(keywords: string[], content: string): number {
  // 生成关键词对
  const keywordPairs = keywords.flatMap((k1, i) => 
    keywords.slice(i + 1).map(k2 => [k1, k2])
  );
  
  // 计算共现得分
  let coOccurrenceScore = 0;
  keywordPairs.forEach(([k1, k2]) => {
    const distance = calculateKeywordDistance(content, k1, k2);
    if (distance !== -1 && distance < 100) {
      coOccurrenceScore += Math.exp(-distance / 50);
    }
  });
  
  return coOccurrenceScore;
}
```

### 3.6 上下文相关性

上下文相关性评估考虑了块间关系：

```typescript
// 上下文相关性评估
async function evaluateContextRelevance(block: any, query: string): Promise<number> {
  let contextScore = 0;
  
  // 父块权重
  if (block.parent) {
    const parentRelevance = await calculateRelevanceScore(block.parent, query);
    contextScore += parentRelevance * 0.3;
  }
  
  // 兄弟块权重
  const siblings = await getSiblingBlocks(block);
  const siblingScores = await Promise.all(
    siblings.map(sibling => calculateRelevanceScore(sibling, query))
  );
  contextScore += Math.max(...siblingScores) * 0.2;
  
  return contextScore;
}
```

### 3.7 批量处理优化

批量处理通过分组和并行提升性能：

```typescript
// 批量处理配置
interface BatchConfig {
  batchSize: number;
  maxConcurrent: number;
  timeout: number;
}

// 批量处理实现
async function processBatch<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  config: BatchConfig
): Promise<R[]> {
  const results: R[] = [];
  
  // 分批处理
  for (let i = 0; i < items.length; i += config.batchSize) {
    const batch = items.slice(i, i + config.batchSize);
    
    // 并行处理
    const batchPromises = batch.map(item => 
      Promise.race([
        processor(item),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), config.timeout)
        )
      ])
    );
    
    // 收集结果
    const batchResults = await Promise.allSettled(batchPromises);
    results.push(...batchResults
      .filter(result => result.status === 'fulfilled')
      .map(result => (result as PromiseFulfilledResult<R>).value)
    );
  }
  
  return results;
}
```

### 3.8 并行处理

并行处理策略的具体实现：

```typescript
// 并行处理管理器
class ParallelProcessor {
  private queue: Array<() => Promise<any>> = [];
  private running = 0;
  private maxConcurrent: number;

  constructor(maxConcurrent = 5) {
    this.maxConcurrent = maxConcurrent;
  }

  async add<T>(task: () => Promise<T>): Promise<T> {
    if (this.running >= this.maxConcurrent) {
      // 等待队列
      await new Promise(resolve => this.queue.push(resolve));
    }
    
    this.running++;
    try {
      return await task();
    } finally {
      this.running--;
      if (this.queue.length > 0) {
        const next = this.queue.shift();
        next?.();
      }
    }
  }
}
```

### 3.9 性能优化

性能优化的关键策略：

1. **内存优化**
   ```typescript
   // 内存池复用
   class MemoryPool<T> {
     private pool: T[] = [];
     private factory: () => T;
     
     constructor(factory: () => T, initialSize = 10) {
       this.factory = factory;
       for (let i = 0; i < initialSize; i++) {
         this.pool.push(factory());
       }
     }
     
     acquire(): T {
       return this.pool.pop() ?? this.factory();
     }
     
     release(item: T) {
       this.pool.push(item);
     }
   }
   ```

2. **计算优化**
   ```typescript
   // 计算结果缓存
   const resultCache = new Map<string, SearchResult[]>();
   
   function getCachedResults(query: string): SearchResult[] | undefined {
     const cacheKey = generateCacheKey(query);
     const cached = resultCache.get(cacheKey);
     
     if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
       return cached.results;
     }
     
     return undefined;
   }
   ```

3. **资源管理**
   ```typescript
   // 资源限制器
   class ResourceLimiter {
     private limits: Map<string, number> = new Map();
     
     async acquire(resource: string, amount: number): Promise<boolean> {
       const current = this.limits.get(resource) ?? 0;
       if (current + amount <= this.getResourceLimit(resource)) {
         this.limits.set(resource, current + amount);
         return true;
       }
       return false;
     }
     
     release(resource: string, amount: number) {
       const current = this.limits.get(resource) ?? 0;
       this.limits.set(resource, Math.max(0, current - amount));
     }
   }
   ```