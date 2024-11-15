import "@logseq/libs";
import React from "react";
import * as ReactDOM from "react-dom/client";
import { aiSearch } from './ollama';
import { SettingSchemaDesc } from "@logseq/libs/dist/LSPlugin";

const settings: SettingSchemaDesc[] = [
  {
    key: "host",
    type: "string",
    title: "Ollama 主机",
    description: "设置 Ollama 服务的主机地址和端口",
    default: "localhost:11434"
  },
  {
    key: "model",
    type: "string",
    title: "AI 模型",
    description: "设置要使用的 Ollama 模型",
    default: "qwen2.5"
  },
  {
    key: "maxResults",
    type: "number",
    default: 50,
    title: "最大搜索结果数",
    description: "设置搜索返回的最大结果数量"
  },
  {
    key: "minScore",
    type: "number",
    default: 4.0,
    title: "最低相关度分数",
    description: "设置结果筛选的最低相关度分数(0-10)"
  },
  {
    key: "includeParent",
    type: "boolean",
    default: false,
    title: "包含父块",
    description: "搜索结果是否包含父块内容"
  },
  {
    key: "includeSiblings",
    type: "boolean",
    default: false,
    title: "包含兄弟块",
    description: "搜索结果是否包含兄弟块内容"
  },
  {
    key: "includeChildren",
    type: "boolean",
    default: false,
    title: "包含子块",
    description: "搜索结果是否包含子块内容"
  },
  {
    key: "enableAISummary",
    type: "boolean",
    default: false,
    title: "启用AI总结",
    description: "是否启用AI总结功能"
  }
];

function main() {
  console.info("AI-Search Plugin Loaded");

  // 注册设置
  logseq.useSettingsSchema(settings);

  // 注册一个反斜杠命令，名为 AI-Search
  logseq.Editor.registerSlashCommand("AI-Search", async () => {
    try {
      // 获取当前编辑的 block
      const currentBlock = await logseq.Editor.getCurrentBlock();

      if (currentBlock?.uuid) {
        // 获取当前 block 的内容
        const blockContent = await logseq.Editor.getEditingBlockContent();

        // 调用 Ollama API，生成文本
        const { summary, results } = await aiSearch(blockContent);

        // 检查是否启用AI总结
        const enableAISummary = logseq.settings?.enableAISummary ?? false;
        let aiSummaryBlock = null;

        // 如果启用了AI总结且有总结内容，先插入AI总结
        if (enableAISummary && summary) {
          const formattedText = `\`\`\`markdown
AI总结结果: ${summary}\`\`\``;
          // 插入AI生成的内容作为子块
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
      }
    } catch (error) {
      console.error("AI-Search 命令执行失败：", error);
      await logseq.UI.showMsg("搜索执行失败，请重试", "error");
    }
  });
}

// 启动插件
logseq.ready(main).catch(console.error);

// 渲染 React 组件
const root = ReactDOM.createRoot(document.getElementById("app")!);
root.render(
  <React.StrictMode>
    {/* <App /> */}
  </React.StrictMode>
);