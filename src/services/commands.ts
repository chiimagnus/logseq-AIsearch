// 本文件实现了 Logseq 的 AI 搜索和AI回应命令功能。
// 主函数 `aiSearchCommand` 执行以下操作：
// 1. 从 Logseq 获取当前块内容
// 2. 调用 AI 搜索服务查找相关笔记
// 3. 将搜索结果作为块引用插入到可折叠的父块下方
// 4. （可选）可以生成搜索结果的 AI 摘要
// 
// 主函数 `aiResponseCommand` 执行以下操作：
// 1. 获取用户选中的blocks内容
// 2. 调用AI生成5种风格的回应（温暖、一针见血、激发思考、灵感火花、宇宙视角）
// 3. 将AI回应保存到AIResponse页面
// 4. 在原始blocks旁边插入AI回应的引用
// 该命令集成了 Logseq 的插件 API，用于与编辑器交互并向用户显示消息。

import { aiSearch } from './searchOrchestrator';
import { generateAIResponse } from './aiResponse';
import { search as vectorSearch, getInitializationStatus } from './vectorService';
import { SearchResult } from '../types/search';

export async function aiSearchCommand() {
  try {
    // 获取当前块
    const currentBlock = await logseq.Editor.getCurrentBlock();
    if (!currentBlock?.uuid) {
      await logseq.UI.showMsg("无法获取当前块 | Unable to get current block", "error");
      return;
    }

    // 获取当前块内容
    const blockContent = currentBlock.content;
    if (!blockContent) {
      await logseq.UI.showMsg("当前块没有内容 | Current block has no content", "warning");
      return;
    }

    await logseq.UI.showMsg("开始搜索... | Starting search...", "info");

    // 统一使用向量搜索
    let results: SearchResult[] = [];
    let generateSummary: () => Promise<string | null>;

    // 检查向量搜索服务状态
    const status = getInitializationStatus();
    if (!status.isInitialized) {
      await logseq.UI.showMsg("向量搜索未初始化，使用传统搜索 | Vector search not initialized, using traditional search", "warning");
      // 回退到传统搜索
      const searchResult = await aiSearch(blockContent);
      results = searchResult.results;
      generateSummary = searchResult.generateSummary;
    } else {
      // 使用向量搜索
      const vectorResults = await vectorSearch(blockContent);
      if (vectorResults && vectorResults.length > 0) {
        // 将向量搜索结果转换为兼容格式
        results = vectorResults.map((result: any) => ({
          block: { 
            uuid: result.blockUUID,
            content: result.blockContent,
            page: {
              name: result.pageName
            }
          },
          score: result._distance ? (1 - result._distance) * 10 : 5 // 将距离转换为分数
        }));
        
        // 如果启用AI总结，使用传统方式生成总结
        if (logseq.settings?.enableAISummary) {
          const searchResult = await aiSearch(blockContent);
          generateSummary = searchResult.generateSummary;
        } else {
          generateSummary = async () => null;
        }
      } else {
        results = [];
        generateSummary = async () => null;
      }
    }

    // === 第一阶段：立即插入搜索结果和引用 ===
    if (results.length > 0) {
      // 先插入笔记来源块
      const notesBlock = await logseq.Editor.insertBlock(
        currentBlock.uuid,
        `${results.length} related notes`,
        {
          sibling: false,
        }
      );

      if (!notesBlock) {
        console.error("插入笔记来源块失败 | Failed to insert note source block");
        return;
      }

      // 插入相关笔记引用
      for (const result of results) {
        const blockRef = `((${result.block.uuid}))`;
        await logseq.Editor.insertBlock(notesBlock.uuid, blockRef, {
          sibling: false,
        });
      }

      // 将笔记来源块设置为折叠状态
      await logseq.Editor.setBlockCollapsed(notesBlock.uuid, true);
      
      await logseq.UI.showMsg("📝 引用已插入！正在生成AI总结... | References inserted! Generating AI summary...", "success");
    }

    // === 第二阶段：异步生成并插入AI总结 ===
    try {
      const summary = await generateSummary();
      
      if (summary && summary.trim()) {
        const formattedText = `\`\`\`markdown\n${summary.trim()}\n\`\`\``;
        await logseq.Editor.insertBlock(currentBlock.uuid, formattedText, {
          sibling: false,
        });
        await logseq.UI.showMsg("✨ AI总结已完成！| AI summary completed!", "success");
      } else {
        await logseq.UI.showMsg("📝 搜索完成！| Search completed!", "success");
      }
    } catch (summaryError) {
      console.error("AI总结生成失败:", summaryError);
      await logseq.UI.showMsg("⚠️ 引用已插入，但AI总结生成失败 | References inserted, but AI summary generation failed", "warning");
    }
    console.log("搜索结果插入完成 | Search results insertion completed");
  } catch (error) {
    console.error("AI-Search 命令执行失败 | AI-Search command execution failed:", error);
    await logseq.UI.showMsg("搜索执行失败，请重试 | Search execution failed, please try again", "error");
  }
}

export async function aiResponseCommand() {
  try {
    await generateAIResponse();
  } catch (error) {
    console.error("AI-Response 命令执行失败 | AI-Response command execution failed:", error);
    await logseq.UI.showMsg("AI回应生成失败，请重试 | AI response generation failed, please try again", "error");
  }
} 