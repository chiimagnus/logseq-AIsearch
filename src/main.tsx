import "@logseq/libs";
import React from "react";
import * as ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

function main() {
  console.info("AI-Search Plugin Loaded");

  // 注册一个反斜杠命令，名为 AI-Search
  logseq.Editor.registerSlashCommand("AI-Search", async () => {
    try {
      // 获取当前编辑的 block
      const currentBlock = await logseq.Editor.getCurrentBlock();

      if (currentBlock?.uuid) {
        // 获取当前 block 的内容
        const blockContent = await logseq.Editor.getEditingBlockContent();

        // 输出当前 block 内容到控制台
        console.log(`当前 block 内容: ${blockContent}`);

        // 在当前 block 的下一个兄弟 block 中插入 "收到"
        await logseq.Editor.insertBlock(currentBlock.uuid, "收到", {
          sibling: true, // 插入在当前 block 之后
        });

        // 提示操作成功
        console.log("已在下一个兄弟 block 中插入 '收到'");
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