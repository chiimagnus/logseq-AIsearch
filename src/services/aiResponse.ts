// AI 回应服务模块
// 处理用户选中内容的AI回应生成和保存逻辑

import { generateResponse } from './apiService';
import { generateAIResponsePrompt, AI_RESPONSE_STYLES } from '../prompts/aiResponse';

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
    const page = await logseq.Editor.getPage(pageName);
    if (page) {
      return pageName;
    }
  } catch (error) {
    // 页面不存在，继续创建
  }

  // 创建AIResponse页面（不添加任何初始内容）
  await logseq.Editor.createPage(pageName, {
    redirect: false,
    createFirstBlock: false,  // 改为false，不创建第一个block
    format: "markdown"
  });

  return pageName;
}

/**
 * 从设置选项字符串转换为风格键
 */
function getStyleKeyFromSetting(settingValue: string): keyof typeof AI_RESPONSE_STYLES {
  if (settingValue.includes("温暖回应")) return "warm";
  if (settingValue.includes("一针见血")) return "sharp";
  if (settingValue.includes("激发思考")) return "thoughtProvoking";
  if (settingValue.includes("灵感火花")) return "sparks";
  if (settingValue.includes("宇宙视角")) return "cosmic";
  
  // 默认返回温暖回应
  return "warm";
}

/**
 * 获取用户选择的AI回应风格
 */
function getSelectedStyle(): keyof typeof AI_RESPONSE_STYLES {
  const settingValue = logseq.settings?.aiResponseStyle as string;
  
  // 直接从设置中获取风格
  return getStyleKeyFromSetting(settingValue || "");
}

/**
 * 保存AI回应到AIResponse页面
 */
async function saveAIResponseToPage(aiResponse: string, selectedStyle: keyof typeof AI_RESPONSE_STYLES): Promise<string> {
  const pageName = await ensureAIResponsePage();
  
  // 直接使用AI回应的原始内容
  const responseContent = aiResponse;

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
  
  const referenceContent = `((${responseBlockUuid}))`;
  
  await logseq.Editor.insertBlock(lastBlock.uuid, referenceContent, {
    sibling: true
  });
}

/**
 * 主要的AI回应处理函数
 */
export async function generateAIResponse(): Promise<void> {
  try {
    // 1. 获取选中的内容
    const { content, selectedBlocks } = await getSelectedBlocksContent();

    if (!content.trim()) {
      await logseq.UI.showMsg("选中的内容为空 | Selected content is empty", "warning");
      return;
    }

    // 2. 获取AI回应风格
    const selectedStyle = getSelectedStyle();

    // 显示开始生成消息
    const styleInfo = AI_RESPONSE_STYLES[selectedStyle];
    await logseq.UI.showMsg(`${styleInfo.name}的AI回应...`, "info");

    // 3. 生成AI回应提示词
    const prompt = generateAIResponsePrompt(content, selectedStyle);

    // 4. 调用AI API生成回应
    const aiResponse = await generateResponse(prompt);

    if (!aiResponse) {
      await logseq.UI.showMsg("AI回应生成失败 | Failed to generate AI response", "error");
      return;
    }

    // 5. 保存AI回应到AIResponse页面
    const responseBlockUuid = await saveAIResponseToPage(aiResponse, selectedStyle);

    // 6. 在原始blocks旁边插入引用
    await insertAIResponseReference(selectedBlocks, responseBlockUuid);

    // 7. 显示成功消息
    await logseq.UI.showMsg(`✨ ${styleInfo.name}已生成！`, "success");

  } catch (error) {
    console.error("AI回应生成失败:", error);
    await logseq.UI.showMsg(
      `AI回应生成失败: ${error instanceof Error ? error.message : "未知错误"}`, 
      "error"
    );
  }
} 