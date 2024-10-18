import "@logseq/libs";
import React from "react";
import * as ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// 调用 Ollama API 的函数
async function callOllamaAPI(content: string): Promise<string> {
  try {
    const response = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "qwen2.5:latest",  // 使用你已经安装的模型名称
        prompt: content,   // block 中的内容作为 prompt 发送
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API 请求失败: ${response.statusText}`);
    }

    const data = await response.json();
    return data.text;  // 假设 API 返回的数据中包含生成的文本字段
  } catch (error) {
    console.error("调用 Ollama API 失败: ", error);
    return "生成文本失败";
  }
}

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

        // 调用 Ollama API，生成文本
        const generatedText = await callOllamaAPI(blockContent);

        // 在当前 block 的下一个兄弟 block 中插入生成的文本
        await logseq.Editor.insertBlock(currentBlock.uuid, generatedText, {
          sibling: true, // 插入在当前 block 之后
        });

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