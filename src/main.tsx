import "@logseq/libs";
import React from "react";
import * as ReactDOM from "react-dom/client";
import { SettingSchemaDesc } from "@logseq/libs/dist/LSPlugin";
import { aiSearchCommand } from './services/commands';

const settings: SettingSchemaDesc[] = [
  // ==================== 全局设置 ====================
  {
    key: "globalSettingsHeader",
    type: "heading",
    title: "🌐 全局设置 / Global Settings",
    description: "基本的插件设置",
    default: ""
  },
  {
    key: "apiType",
    type: "enum",
    title: "🔧 API 类型 / API Type",
    description: "选择使用的 AI 服务提供商\nSelect the AI service provider to use",
    enumChoices: ["Ollama", "自定义API"],
    default: "自定义API"
  },
  {
    key: "shortcut",
    type: "string",
    title: "⌨️ 快捷键 / Shortcut",
    description: "设置 AI-Search 的快捷键\nSet the shortcut key for AI-Search",
    default: "alt+mod+a"
  },
  
  // ==================== Ollama 本地部署 ====================
  {
    key: "ollamaHeader",
    type: "heading",
    title: "🖥️ Ollama 本地部署 / Ollama Local Deployment",
    description: "配置本地 Ollama 服务的连接参数",
    default: ""
  },
  {
    key: "host",
    type: "string",
    title: "🌐 Ollama 主机 / Ollama Host",
    description: "设置 Ollama 服务的主机地址和端口\nSet the host address and port for Ollama service",
    default: "localhost:11434"
  },
  {
    key: "model",
    type: "string",
    title: "🤖 Ollama 大模型 / Ollama Model",
    description: "设置要使用的 Ollama 模型\nSet the Ollama model to use",
    default: "qwen2.5"
  },
  {
    key: "ollamaTimeout",
    type: "number",
    title: "⏱️ 连接超时 / Timeout",
    description: "设置 Ollama 连接超时时间（秒）\nSet Ollama connection timeout (seconds)",
    default: 30
  },
  
  // ==================== 自定义API配置 ====================
  {
    key: "unifiedApiHeader",
    type: "heading",
    title: "🛠️ 自定义API配置 / Custom API Configuration",
    description: "配置自定义大模型API服务的连接参数（支持OpenAI、智谱清言、硅基流动、Anthropic等所有兼容服务）",
    default: ""
  },
  {
    key: "apiKey",
    type: "string",
    title: "🔐 API Key",
    description: "输入API密钥\nEnter the API key",
    default: ""
  },
  {
    key: "apiUrl",
    type: "string",
    title: "🔗 完整API URL / Full API URL",
    description: "API的完整URL地址，包含具体端点\nComplete API URL with specific endpoint",
    default: ""
  },
  {
    key: "modelName",
    type: "string",
    title: "🤖 模型名称 / Model Name",
    description: "要使用的模型名称\nModel name to use",
    default: ""
  },
  {
    key: "apiTimeout",
    type: "number",
    title: "⏱️ 连接超时 / Timeout",
    description: "设置API连接超时时间（秒）\nSet API connection timeout (seconds)",
    default: 30
  },
  
  // ==================== API预设配置说明 ====================
  {
    key: "presetConfigHeader",
    type: "heading",
    title: "📋 配置参考 / Configuration Reference",
    description: "常用API服务配置参考",
    default: ""
  },
  {
    key: "configReference",
    type: "string",
    title: "📖 配置参考 / Configuration Reference",
    description: `常用API服务配置参考：
    
🧠 智谱清言 / Zhipu AI:
• API URL: https://open.bigmodel.cn/api/paas/v4/chat/completions
• 推荐模型: GLM-4-Flash-250414 (免费), glm-4-plus, glm-4-0520

🤖 硅基流动 / SiliconFlow:
• API URL: https://api.siliconflow.cn/v1/chat/completions
• 推荐模型: Qwen/Qwen2.5-7B-Instruct, deepseek-ai/DeepSeek-R1

🤖 OpenAI:
• API URL: https://api.openai.com/v1/chat/completions
• 推荐模型: gpt-4o-mini, gpt-4o, gpt-3.5-turbo

🎭 Anthropic:
• API URL: https://api.anthropic.com/v1/messages
• 推荐模型: claude-3-5-sonnet-20241022, claude-3-haiku-20240307

🔧 其他兼容OpenAI格式的API服务也可使用`,
    default: "",
    inputAs: "textarea"
  },
  
  // ==================== 搜索设置 ====================
  {
    key: "searchSettingsHeader",
    type: "heading",
    title: "🔍 搜索设置 / Search Settings",
    description: "配置搜索算法和结果处理参数",
    default: ""
  },
  {
    key: "maxResults",
    type: "number",
    default: 50,
    title: "📊 最大搜索结果数 / Max Results",
    description: "设置搜索返回的最大结果数量\nSet the maximum number of search results to return"
  },
  {
    key: "minScore",
    type: "number",
    default: 4.0,
    title: "⭐ 最低相关度分数 / Minimum Score",
    description: "设置结果筛选的最低相关度分数(0-10)\nSet the minimum relevance score for filtering results (0-10)"
  },
  {
    key: "batchSize",
    type: "number",
    default: 10,
    title: "⚡ 批处理大小 / Batch Size",
    description: "设置并行处理相关性得分的批处理大小\nSet the batch size for parallel relevance score processing"
  },
  
  // ==================== 内容设置 ====================
  {
    key: "contentSettingsHeader",
    type: "heading",
    title: "📝 内容设置 / Content Settings",
    description: "配置搜索结果包含的内容范围",
    default: ""
  },
  {
    key: "includeParent",
    type: "boolean",
    default: false,
    title: "👆 包含父块 / Include Parent",
    description: "搜索结果是否包含父块内容\nWhether to include parent block content in search results"
  },
  {
    key: "includeSiblings",
    type: "boolean",
    default: false,
    title: "👥 包含兄弟块 / Include Siblings",
    description: "搜索结果是否包含兄弟块内容\nWhether to include sibling block content in search results"
  },
  {
    key: "includeChildren",
    type: "boolean",
    default: false,
    title: "👇 包含子块 / Include Children",
    description: "搜索结果是否包含子块内容\nWhether to include child block content in search results"
  },
  {
    key: "enableAISummary",
    type: "boolean",
    default: false,
    title: "🤖 启用AI总结 / Enable AI Summary",
    description: "是否启用AI总结功能\nWhether to enable AI summary feature"
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

  // 修改顶栏按钮
  logseq.App.registerUIItem('toolbar', {
    key: 'AI-Search',
    template: `
      <a class="button" data-on-click="openSettings">
        <svg width="18" height="18" viewBox="0 -1 24 24" stroke-width="2.0" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M7 14C5.34315 14 4 15.3431 4 17C4 18.6569 5.34315 20 7 20C7.35064 20 7.68722 19.9398 8 19.8293" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M4.26392 15.6046C2.9243 14.9582 2.00004 13.587 2.00004 12C2.00004 10.7883 2.53877 9.70251 3.38978 8.96898" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M3.42053 8.8882C3.1549 8.49109 3 8.01363 3 7.5C3 6.11929 4.11929 5 5.5 5C6.06291 5 6.58237 5.18604 7.00024 5.5" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M7.23769 5.56533C7.08524 5.24215 7 4.88103 7 4.5C7 3.11929 8.11929 2 9.5 2C10.8807 2 12 3.11929 12 4.5V20" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M8 20C8 21.1046 8.89543 22 10 22C11.1046 22 12 21.1046 12 20" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M12 7C12 8.65685 13.3431 10 15 10" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M20.6102 8.96898C21.4612 9.70251 22 10.7883 22 12C22 12.7031 21.8186 13.3638 21.5 13.9379" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M20.5795 8.8882C20.8451 8.49109 21 8.01363 21 7.5C21 6.11929 19.8807 5 18.5 5C17.9371 5 17.4176 5.18604 16.9998 5.5" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M12 4.5C12 3.11929 13.1193 2 14.5 2C15.8807 2 17 3.11929 17 4.5C17 4.88103 16.9148 5.24215 16.7623 5.56533" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M14 22C12.8954 22 12 21.1046 12 20" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M20.5 20.5L22 22" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M16 18.5C16 19.8807 17.1193 21 18.5 21C19.1916 21 19.8175 20.7192 20.2701 20.2654C20.7211 19.8132 21 19.1892 21 18.5C21 17.1193 19.8807 16 18.5 16C17.1193 16 16 17.1193 16 18.5Z" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </a>
    `
  })

  // 处理设置按钮点击
  logseq.provideModel({
    openSettings() {
      logseq.showSettingsUI()
    }
  })
}

/**
 * 根据API类型自动更新配置（已禁用，仅保留函数以防需要）
 */
// function updateApiConfig(apiType: string) {
//   // 简化后只有Ollama和自定义API两个选项，不需要自动配置切换
// }

// 启动插件
logseq.ready(main).catch(console.error);

// 渲染 React 组件
const root = ReactDOM.createRoot(document.getElementById("app")!);
root.render(
  <React.StrictMode>
    {/* <App /> */}
  </React.StrictMode>
);