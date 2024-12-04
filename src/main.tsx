import "@logseq/libs";
import React from "react";
import * as ReactDOM from "react-dom/client";
import { SettingSchemaDesc } from "@logseq/libs/dist/LSPlugin";
import { aiSearchCommand } from './commands';

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