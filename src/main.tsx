import "@logseq/libs";
import React from "react";
import * as ReactDOM from "react-dom/client";
import App from "./App";
// import "./index.css";
import { aiSearch } from './ollama';  // 新增：导入 Ollama API 调用函数
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

        // 构造带有代码块格式的文本
        const formattedText = `\`\`\`markdown
以下内容为AI搜索的结果:${summary}\`\`\``;

        // 插入AI生成的内容作为子块
        const aiSummaryBlock = await logseq.Editor.insertBlock(currentBlock.uuid, formattedText, {
          sibling: false, // 插入为子块
        });

        if (aiSummaryBlock) {  // 添加空值检查
          // 插入笔记来源作为第二个子块
          const notesBlock = await logseq.Editor.insertBlock(aiSummaryBlock.uuid, `笔记来源 (${results.length}条相关笔记)`, {
            sibling: true, // 改为 true，使其成为 AI 总结的兄弟块
          });

          if (notesBlock) {  // 添加空值检查
            // 插入每个引用的笔记作为笔记来源的子块
            for (const result of results) {
              // 创建块引用链接
              const blockRef = `((${result.block.uuid}))`;
              await logseq.Editor.insertBlock(notesBlock.uuid, blockRef, {
                sibling: false, // 插入为子子块
              });
            }
          } else {
            console.error("插入笔记来源块失败");
          }
        } else {
          console.error("插入AI总结块失败");
        }

        // 提示操作成功
        console.log("已在下一个兄弟 block 中插入生成的文本");
      }
    } catch (error) {
      console.error("AI-Search 命令执行失败：", error);
    }
  });
}

// 启动插件
logseq.ready(main).catch(console.error);

// 渲染 React 组件
const root = ReactDOM.createRoot(document.getElementById("app")!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);