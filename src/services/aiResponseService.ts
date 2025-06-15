// AI 回应服务模块
// 处理用户选中内容的AI回应生成和保存逻辑

import { generateResponse } from './apiService';
import { generateAIResponsePrompt } from '../prompts/aiResponse';

/**
 * 获取用户选中的blocks内容
 */
async function getSelectedBlocksContent(): Promise<{ content: string; selectedBlocks: any[] }> {
  // 获取当前选中的blocks
  const selectedBlocks = await logseq.Editor.getSelectedBlocks();
  
  if (!selectedBlocks || selectedBlocks.length === 0) {
    // 如果没有选中blocks，尝试获取当前block
    const currentBlock = await logseq.Editor.getCurrentBlock();
    if (!currentBlock) {
      throw new Error("没有选中任何内容，也无法获取当前块");
    }
    return {
      content: currentBlock.content || "",
      selectedBlocks: [currentBlock]
    };
  }

  // 合并所有选中blocks的内容
  const content = selectedBlocks
    .map(block => block.content || "")
    .filter(content => content.trim())
    .join("\n\n");

  return { content, selectedBlocks };
}

/**
 * 确保AIResponse页面存在，如果不存在则创建
 */
async function ensureAIResponsePage(): Promise<string> {
  const pageName = "AIResponse";
  
  try {
    // 尝试获取AIResponse页面
    const page = await logseq.Editor.getPage(pageName);
    if (page) {
      return pageName;
    }
  } catch (error) {
    // 页面不存在，继续创建
  }

  // 创建AIResponse页面
  await logseq.Editor.createPage(pageName, {
    redirect: false,
    createFirstBlock: true,
    format: "markdown"
  });

  // 在页面首行添加说明
  const pageBlocks = await logseq.Editor.getPageBlocksTree(pageName);
  if (pageBlocks && pageBlocks.length > 0) {
    await logseq.Editor.updateBlock(pageBlocks[0].uuid, 
      "# AI 回应记录\n这里保存了所有AI对您思考的回应，每个回应都有独特的视角和洞察。"
    );
  }

  return pageName;
}

/**
 * 保存AI回应到AIResponse页面
 */
async function saveAIResponseToPage(content: string, aiResponse: string): Promise<string> {
  const pageName = await ensureAIResponsePage();
  
  // 获取当前时间戳
  const timestamp = new Date().toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  // 构建保存的内容
  const responseContent = `## 📝 用户内容 (${timestamp})
${content}

---

${aiResponse}

---`;

  // 在AIResponse页面的最后插入新的回应
  const pageBlocks = await logseq.Editor.getPageBlocksTree(pageName);
  let targetUuid: string;

  if (pageBlocks && pageBlocks.length > 0) {
    // 在最后一个block后插入
    const lastBlock = pageBlocks[pageBlocks.length - 1];
    const insertedBlock = await logseq.Editor.insertBlock(lastBlock.uuid, responseContent, {
      sibling: true
    });
    targetUuid = insertedBlock?.uuid || lastBlock.uuid;
  } else {
    // 如果页面为空，直接插入
    const insertedBlock = await logseq.Editor.insertBlock(pageName, responseContent, {
      isPageBlock: true
    });
    targetUuid = insertedBlock?.uuid || "";
  }

  return targetUuid;
}

/**
 * 在原始blocks旁边插入AI回应的引用
 */
async function insertAIResponseReference(selectedBlocks: any[], responseBlockUuid: string) {
  if (!selectedBlocks || selectedBlocks.length === 0) {
    return;
  }

  // 在最后一个选中block的后面插入引用
  const lastBlock = selectedBlocks[selectedBlocks.length - 1];
  
  const referenceContent = `🤖 **AI回应**: ((${responseBlockUuid}))`;
  
  await logseq.Editor.insertBlock(lastBlock.uuid, referenceContent, {
    sibling: true
  });
}

/**
 * 主要的AI回应处理函数
 */
export async function generateAIResponse(): Promise<void> {
  try {
    // 显示开始消息
    await logseq.UI.showMsg("🤖 正在生成AI回应...", "info");

    // 1. 获取选中的内容
    const { content, selectedBlocks } = await getSelectedBlocksContent();

    if (!content.trim()) {
      await logseq.UI.showMsg("选中的内容为空 | Selected content is empty", "warning");
      return;
    }

    // 2. 生成AI回应提示词
    const prompt = generateAIResponsePrompt(content);

    // 3. 调用AI API生成回应
    const aiResponse = await generateResponse(prompt);

    if (!aiResponse) {
      await logseq.UI.showMsg("AI回应生成失败 | Failed to generate AI response", "error");
      return;
    }

    // 4. 保存AI回应到AIResponse页面
    const responseBlockUuid = await saveAIResponseToPage(content, aiResponse);

    // 5. 在原始blocks旁边插入引用
    await insertAIResponseReference(selectedBlocks, responseBlockUuid);

    // 6. 显示成功消息
    await logseq.UI.showMsg("✨ AI回应已生成并保存！", "success");

  } catch (error) {
    console.error("AI回应生成失败:", error);
    await logseq.UI.showMsg(
      `AI回应生成失败: ${error instanceof Error ? error.message : "未知错误"}`, 
      "error"
    );
  }
} 