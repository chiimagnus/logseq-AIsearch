// 本文件实现了 Logseq 的 AI 搜索命令功能。
// 主函数 `aiSearchCommand` 执行以下操作：
// 1. 从 Logseq 获取当前块内容
// 2. 调用 AI 搜索服务查找相关笔记
// 3. 将搜索结果作为块引用插入到可折叠的父块下方
// 4. （可选）可以生成搜索结果的 AI 摘要
// 该命令集成了 Logseq 的插件 API，用于与编辑器交互并向用户显示消息。

import { aiSearch } from './searchOrchestrator';

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

    // 调用 大模型 API，开始搜索
    const { summary, results } = await aiSearch(blockContent);

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

    // 检查是否启用AI总结
    const enableAISummary = logseq.settings?.enableAISummary ?? false;

    // 如果启用了AI总结且有总结内容，在笔记来源后插入AI总结
    if (enableAISummary && summary) {
      const formattedText = `\`\`\`markdown\n${summary.trim()}\n\`\`\``;
      await logseq.Editor.insertBlock(currentBlock.uuid, formattedText, {
        sibling: false,
      });
    }

    await logseq.UI.showMsg("完成啦，我的小宝贝！| All done, my dear!", "success");
    console.log("搜索结果插入完成 | Search results insertion completed");
  } catch (error) {
    console.error("AI-Search 命令执行失败 | AI-Search command execution failed:", error);
    await logseq.UI.showMsg("搜索执行失败，请重试 | Search execution failed, please try again", "error");
  }
} 