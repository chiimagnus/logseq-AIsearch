import { aiSearch } from './apiSelector';

export async function aiSearchCommand() {
  try {
    // 获取当前块
    const currentBlock = await logseq.Editor.getCurrentBlock();
    if (!currentBlock?.uuid) {
      await logseq.UI.showMsg("无法获取当前块", "error");
      return;
    }

    // 获取当前块内容
    const blockContent = currentBlock.content;
    if (!blockContent) {
      await logseq.UI.showMsg("当前块没有内容", "warning");
      return;
    }

    await logseq.UI.showMsg("开始搜索...", "info");

    // 调用 大模型 API，开始搜索
    const { summary, results } = await aiSearch(blockContent);

    // 检查是否启用AI总结
    const enableAISummary = logseq.settings?.enableAISummary ?? false;
    let aiSummaryBlock = null;

    // 如果启用了AI总结且有总结内容，先插入AI总结
    if (enableAISummary && summary) {
      const formattedText = `\`\`\`markdown\n${summary.trim()}\n\`\`\``;
      aiSummaryBlock = await logseq.Editor.insertBlock(currentBlock.uuid, formattedText, {
        sibling: false,
      });
    }

    // 插入笔记来源块
    const notesBlock = await logseq.Editor.insertBlock(
      enableAISummary && aiSummaryBlock ? aiSummaryBlock.uuid : currentBlock.uuid,
      `笔记来源 (${results.length}条相关笔记)`,
      {
        sibling: true,
      }
    );

    if (!notesBlock) {
      console.error("插入笔记来源块失败");
      return;
    }

    // 插入相关笔记引用
    for (const result of results) {
      const blockRef = `((${result.block.uuid}))`;
      await logseq.Editor.insertBlock(notesBlock.uuid, blockRef, {
        sibling: false,
      });
    }

    await logseq.UI.showMsg("搜索完成", "success");
    console.log("搜索结果插入完成");
  } catch (error) {
    console.error("AI-Search 命令执行失败：", error);
    await logseq.UI.showMsg("搜索执行失败，请重试", "error");
  }
} 