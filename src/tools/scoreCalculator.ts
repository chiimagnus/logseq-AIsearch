// 相关性评分算法工具（一），硬性计算，非AI计算
// 
// === 📈 优化版本说明 ===
// 
// 🔍 主要优化内容：
// 1. **结构化内容分析**：能够识别fullContent中的原始块和上下文部分
// 2. **层级权重优化**：根据内容结构（父块、兄弟块、子块）智能调整权重
// 3. **原始块优先**：重点评估原始块内容，上下文内容作为辅助加权
// 4. **改进的关键词匹配**：分别在原始块和上下文中查找关键词，给予不同权重
// 5. **动态长度权重**：基于原始块长度而非整个fullContent长度计算
// 
// 🏗️ 支持的内容结构：
// ```
// 这是pagename，...，pagename:页面名称
// [原始块内容]
// 
// --- 相关内容 ---
// **父块内容：**
// [父块内容]
// 
// **兄弟块内容：**
// [兄弟块内容]
// 
// **子块内容：**
// [子块内容]
// ```
// 
// 🎯 评分策略：
// - 原始块匹配：高权重（4分基础分）
// - 上下文匹配：低权重（1.5分基础分）
// - 层级加权：有上下文支持的原始块得分更高
// - 重要关键词：1.8倍权重乘数
// - 共现加权：原始块内共现2.2倍，上下文支持1.4倍
//
// === 📈 优化版本说明结束 ===

export function calculateRelevanceScore(block: any, keywords: string[], importantKeywords: string[]): number {
  const content = block.content.toLowerCase();
  let score = 0;

  // 分析内容结构，识别原块在fullContent中的位置
  const contentStructure = analyzeContentStructure(block.content);
  
  // 1. 关键词匹配和共现分析 - 重点关注原块部分
  const keywordPairs = keywords.flatMap((k1, i) => 
    keywords.slice(i + 1).map(k2 => [k1, k2])
  );

  keywords.forEach(keyword => {
    const keywordLower = keyword.toLowerCase();
    
    // 分别在原块和上下文中查找关键词
    const originalBlockMatches = findKeywordInSection(contentStructure.originalBlock, keywordLower);
    const contextMatches = findKeywordInSection(contentStructure.contextContent, keywordLower);
    
    // 原块匹配得分更高
    if (originalBlockMatches.length > 0) {
      // 位置权重，作用：位置权重通过关键词在内容中的位置来影响得分。关键词出现在内容开头通常被认为更重要。
      const positionWeight = Math.exp(-originalBlockMatches[0].index / 100);
      // 完整匹配权重，作用：如果一个关键词在内容中完整出现，完整匹配权重会提高该内容的得分。
      const exactMatchWeight = contentStructure.originalBlock.includes(` ${keywordLower} `) ? 2.5 : 1.2;
      // 密度权重，作用：如果一个关键词在内容中多次出现，密度权重会提高该内容的得分。
      const densityWeight = originalBlockMatches.length > 1 ? 1.3 : 1;
      
      let keywordScore = 4 * positionWeight * exactMatchWeight * densityWeight; // 提高原块基础分

      // 增加重要关键词的权重
      if (importantKeywords.includes(keyword)) {
        keywordScore *= 1.8; // 提高重要关键词的权重
      }

      score += keywordScore;
      
      // 检查与其他关键词的共现，作用：如果多个关键词在内容中共现，共现权重会提高该内容的得分。
      const hasCoOccurrence = keywordPairs
        .filter(pair => pair.includes(keyword))
        .some(([k1, k2]) => 
          contentStructure.originalBlock.includes(k1.toLowerCase()) && 
          contentStructure.originalBlock.includes(k2.toLowerCase())
        );
      
      if (hasCoOccurrence) {
        score *= 2.2; // 原块内的共现权重更高
      }
    }
    
    // 上下文匹配得分较低，但仍有助益
    if (contextMatches.length > 0) {
      let contextScore = 1.5 * contextMatches.length;
      
      if (importantKeywords.includes(keyword)) {
        contextScore *= 1.3;
      }
      
      score += contextScore;
    }
  });

  // 2. 内容长度权重 - 基于原块长度计算
  const originalBlockLength = contentStructure.originalBlock.length;
  const idealLength = 200; // 调整理想长度
  const lengthWeight = 1 / (1 + Math.exp((originalBlockLength - idealLength) / 200));
  score *= lengthWeight;

  // 3. 上下文增强权重 - 如果上下文中也包含关键词，给原块加权
  const contextRelevance = keywords.some(keyword => {
    return contentStructure.contextContent.toLowerCase().includes(keyword.toLowerCase());
  });
  
  if (contextRelevance) {
    score *= 1.4; // 上下文支持的原块给予加权
  }

  // 4. 格式权重（基于原块的格式）
  if (contentStructure.originalBlock.startsWith('#') || 
      contentStructure.originalBlock.startsWith('- ') || 
      contentStructure.originalBlock.startsWith('* ') || 
      contentStructure.originalBlock.startsWith('[[')) {
    score *= 1.3; // 适度提高格式权重
  }

  // 5. 层级权重 - 基于内容结构分析
  const hierarchyWeight = calculateHierarchyWeight(contentStructure);
  score *= hierarchyWeight;

  return Math.max(0, Math.min(10, score)); // 限制分数范围在0-10之间
}

/**
 * 分析内容结构，识别原块和上下文部分
 */
function analyzeContentStructure(fullContent: string): {
  originalBlock: string;
  contextContent: string;
  hasParent: boolean;
  hasSiblings: boolean;
  hasChildren: boolean;
} {
  const lines = fullContent.split('\n');
  
  // 查找关键标识符来分析结构
  let originalBlockStart = -1;
  let contextStart = -1;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // 识别页面信息行（以"这是pagename"开头）
    if (line.includes('这是pagename')) {
      continue;
    }
    
    // 识别"--- 相关内容 ---"分割线
    if (line.includes('--- 相关内容 ---')) {
      contextStart = i + 1;
      break;
    }
    
    // 如果还没找到上下文标识，当前内容视为原块
    if (originalBlockStart === -1 && line.length > 0) {
      originalBlockStart = i;
    }
  }
  
  // 提取原块内容
  let originalBlock = '';
  if (originalBlockStart !== -1) {
    const endIndex = contextStart !== -1 ? contextStart - 1 : lines.length;
    originalBlock = lines.slice(originalBlockStart, endIndex)
      .filter(line => !line.includes('这是pagename') && !line.includes('--- 相关内容 ---'))
      .join('\n')
      .trim();
  }
  
  // 提取上下文内容
  let contextContent = '';
  if (contextStart !== -1) {
    contextContent = lines.slice(contextStart).join('\n').trim();
  }
  
  // 分析结构特征
  const hasParent = contextContent.includes('**父块内容：**');
  const hasSiblings = contextContent.includes('**兄弟块内容：**');
  const hasChildren = contextContent.includes('**子块内容：**');
  
  return {
    originalBlock: originalBlock || fullContent,
    contextContent,
    hasParent,
    hasSiblings,
    hasChildren
  };
}

/**
 * 在指定文本段落中查找关键词
 */
function findKeywordInSection(text: string, keyword: string): { index: number }[] {
  const matches: { index: number }[] = [];
  const regex = new RegExp(keyword, 'gi');
  let match;
  
  while ((match = regex.exec(text)) !== null) {
    matches.push({ index: match.index });
  }
  
  return matches;
}

/**
 * 计算层级权重
 */
function calculateHierarchyWeight(structure: ReturnType<typeof analyzeContentStructure>): number {
  let weight = 1.0;
  
  // 基础权重：有原块内容
  if (structure.originalBlock.length > 0) {
    weight = 1.5; // 原块基础权重
  }
  
  // 上下文支持加权
  if (structure.hasParent) {
    weight *= 1.15; // 有父块上下文
  }
  
  if (structure.hasChildren) {
    weight *= 1.1; // 有子块支持
  }
  
  if (structure.hasSiblings) {
    weight *= 1.05; // 有兄弟块关联
  }
  
  return weight;
}

/**
 * 测试函数：验证优化后的评分算法
 */
export function testScoreCalculator(): void {
  console.log("🧪 [测试] 开始测试优化后的评分算法");
  
  // 测试用例1：结构化内容
  const testContent1 = `这是pagename，如果是时间词，那么就表示这个这个page包含的block内容都是此时间创建的，pagename:2024-01-15
今天学习了React Hooks，特别是useState和useEffect

--- 相关内容 ---
**父块内容：**
前端学习笔记

**兄弟块内容：**
需要继续学习useMemo和useCallback

**子块内容：**
useState用于管理组件状态
useEffect用于处理副作用`;

  const keywords1 = ["React", "Hooks", "学习"];
  const importantKeywords1 = ["React", "Hooks"];
  
  const score1 = calculateRelevanceScore(
    { content: testContent1 }, 
    keywords1, 
    importantKeywords1
  );
  
  console.log("📊 [测试1] 结构化内容评分:");
  console.log(`   查询关键词: ${keywords1.join(", ")}`);
  console.log(`   评分结果: ${score1.toFixed(2)}`);
  console.log(`   内容结构分析:`);
  
  const structure1 = analyzeContentStructure(testContent1);
  console.log(`   - 原块: "${structure1.originalBlock.substring(0, 50)}..."`);
  console.log(`   - 有父块: ${structure1.hasParent}`);
  console.log(`   - 有兄弟块: ${structure1.hasSiblings}`);
  console.log(`   - 有子块: ${structure1.hasChildren}`);
  
  // 测试用例2：简单内容（无上下文）
  const testContent2 = `这是pagename，如果是时间词，那么就表示这个这个page包含的block内容都是此时间创建的，pagename:2024-01-15
今天学习了Vue组件的生命周期`;

  const keywords2 = ["Vue", "组件", "生命周期"];
  const importantKeywords2 = ["Vue", "组件"];
  
  const score2 = calculateRelevanceScore(
    { content: testContent2 }, 
    keywords2, 
    importantKeywords2
  );
  
  console.log("\n📊 [测试2] 简单内容评分:");
  console.log(`   查询关键词: ${keywords2.join(", ")}`);
  console.log(`   评分结果: ${score2.toFixed(2)}`);
  
  const structure2 = analyzeContentStructure(testContent2);
  console.log(`   - 原块: "${structure2.originalBlock.substring(0, 50)}..."`);
  console.log(`   - 有上下文: ${structure2.contextContent.length > 0}`);
  
  // 测试用例3：关键词不匹配
  const testContent3 = `这是pagename，如果是时间词，那么就表示这个这个page包含的block内容都是此时间创建的，pagename:2024-01-15
今天去了超市买菜`;

  const keywords3 = ["React", "编程", "技术"];
  const importantKeywords3 = ["React"];
  
  const score3 = calculateRelevanceScore(
    { content: testContent3 }, 
    keywords3, 
    importantKeywords3
  );
  
  console.log("\n📊 [测试3] 不匹配内容评分:");
  console.log(`   查询关键词: ${keywords3.join(", ")}`);
  console.log(`   评分结果: ${score3.toFixed(2)}`);
  
  console.log("\n✅ [测试] 评分算法测试完成");
} 