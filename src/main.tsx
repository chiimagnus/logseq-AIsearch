import "@logseq/libs";
import React from "react";
import * as ReactDOM from "react-dom/client";
import { aiSearch } from './apiSelector';
import { SettingSchemaDesc } from "@logseq/libs/dist/LSPlugin";

const settings: SettingSchemaDesc[] = [
  {
    key: "apiType",
    type: "enum",
    title: "API 类型",
    description: "选择使用的 API 类型",
    enumChoices: ["Ollama", "智谱清言"],
    default: "智谱清言"
  },
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
    title: "Ollama 大模型",
    description: "设置要使用的 Ollama 模型",
    default: "qwen2.5"
  },
  {
    key: "zhipuApiKey",
    type: "string",
    title: "智谱清言 API Key",
    description: "输入智谱清言 API 的密钥",
    default: ""
  },
  {
    key: "zhipuBaseUrl",
    type: "string",
    title: "智谱清言 Base URL",
    description: "输入智谱清言 API 的base_url（默认即可）",
    default: "https://open.bigmodel.cn/api/paas/v4/"
  },
  {
    key: "zhipuModel",
    type: "string",
    title: "智谱清言大模型（glm-4-flash目前是免费的）",
    description: "输入要使用的智谱清言模型名称",
    default: "glm-4-flash"
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
  },
  {
    key: "batchSize",
    type: "number",
    default: 10,
    title: "批处理大小",
    description: "设置并行处理相关性得分的批处理大小"
  },
  {
    key: "shortcut",
    type: "string",
    title: "快捷键",
    description: "设置 AI-Search 的快捷键",
    default: "alt+mod+a"
  }
];

async function aiSearchCommand() {
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
      const formattedText = `\`\`\`markdown
AI总结结果: ${summary}\`\`\``;
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

function main() {
  console.info("AI-Search Plugin Loaded");

  // 注册设置
  logseq.useSettingsSchema(settings);

  // 注册快捷键
  logseq.App.registerCommandShortcut(
    { 
      binding: logseq.settings?.shortcut || "alt+mod+a",
      mode: "non-editing"
    } as any,
    aiSearchCommand
  );

  // 注册一个反斜杠命令，名为 AI-Search
  logseq.Editor.registerSlashCommand("AI-Search", aiSearchCommand);
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