import "@logseq/libs";
import React from "react";
import * as ReactDOM from "react-dom/client";
import { SettingSchemaDesc } from "@logseq/libs/dist/LSPlugin";
import { aiSearchCommand, aiResponseCommand } from './services/commands';
import { initializeVectorStore, indexAllPages } from './services/vectorService';

const settings: SettingSchemaDesc[] = [
  // ==================== 全局设置 ====================
  {
    key: "globalSettingsHeader",
    type: "heading",
    title: "🌐 全局设置 / Global Settings",
    description: "",
    default: ""
  },
  {
    key: "apiType",
    type: "enum",
    title: "🔧 大模型服务商 / LLM Provider",
    description: "",
    enumChoices: ["Ollama", "Custom LLM API"],
    default: "Custom LLM API"
  },
  {
    key: "shortcut",
    type: "string",
    title: "⌨️ AI搜索快捷键 / AI Search Shortcut",
    description: "",
    default: "alt+mod+a"
  },
  {
    key: "responseShortcut",
    type: "string",
    title: "⌨️ AI回应快捷键 / AI Response Shortcut",
    description: "",
    default: "alt+mod+r"
  },
  
  // ==================== Ollama 本地部署 ====================
  {
    key: "ollamaHeader",
    type: "heading",
    title: "🖥️ Ollama 本地部署 / Ollama Local Deployment",
    description: "",
    default: ""
  },
  {
    key: "host",
    type: "string",
    title: "🌐 主机地址和端口 / Host Address and Port",
    description: "",
    default: "localhost:11434"
  },
  {
    key: "model",
    type: "string",
    title: "🤖 模型名称 / Model Name",
    description: "",
    default: "deepseek-r1:8b"
  },
  
  // ==================== 自定义API配置 ====================
  {
    key: "unifiedApiHeader",
    type: "heading",
    title: "🛠️ 自定义API配置 / Custom API Configuration",
    description:
`
🧠 智谱清言Zhipu AI: https://open.bigmodel.cn/api/paas/v4/chat/completions
    
🤖 硅基流动SiliconFlow: https://api.siliconflow.cn/v1/chat/completions
`,
    default: ""
  },
  {
    key: "apiUrl",
    type: "string",
    title: "🔗 完整API URL / Full API URL",
    description: "",
    default: "https://open.bigmodel.cn/api/paas/v4/chat/completions"
  },
  {
    key: "apiKey",
    type: "string",
    title: "🔐 API Key",
    description: "",
    default: ""
  },
  {
    key: "modelName",
    type: "string",
    title: "🤖 模型名称 / Model Name",
    description: "",
    default: "GLM-4-Flash-250414"
  },
  
  // ==================== 向量数据库设置 ====================
  {
    key: "vectorSearchHeader",
    type: "heading",
    title: "🎯 向量数据库设置 / Vector Database Settings",
    description: `
✨ 向量搜索功能说明 / Vector Search Features:
• 基于AI语义理解的智能搜索
• 支持本地embedding模型，保护隐私
• 以block为单位建立索引，支持精确定位

📋 使用步骤 / Usage Steps:
1. 选择embedding模型类型（Ollama本地 或 云端API）
2. 配置相应的模型参数（地址、密钥等）
3. 启用向量搜索功能  
4. 使用快捷键重建索引（首次使用必须）
5. 使用AI搜索命令进行智能搜索

🖥️ Ollama本地模型配置:
• 先下载模型: ollama pull nomic-embed-text
• 确保Ollama服务运行在 http://localhost:11434

☁️ 云端API配置示例:
• 硅基流动: https://api.siliconflow.cn/v1/embeddings
• 模型: BAAI/bge-m3
• 需要提供有效的API密钥

⚠️ 注意事项 / Notes:
• 测试时可设置Block限制（如100）来快速验证
• 索引建立时间取决于笔记数量，请耐心等待
• 建议在笔记内容有大量更新后重建索引
• 向量数据库存储在插件目录/.lancedb文件夹
`,
    default: ""
  },
  {
    key: "enableVectorSearch",
    type: "boolean",
    default: true,
    title: "🚀 启用向量搜索 / Enable Vector Search",
    description: "启用基于AI嵌入的向量搜索功能，提供更智能的语义搜索\nEnable AI embedding-based vector search for smarter semantic search"
  },
  {
    key: "rebuildIndexShortcut",
    type: "string",
    title: "🔄 重建索引快捷键 / Rebuild Index Shortcut",
    description: "设置重建向量索引的快捷键\nSet shortcut for rebuilding vector index",
    default: "alt+mod+i"
  },
  {
    key: "vectorBatchSize",
    type: "number",
    default: 100,
    title: "⚡ 向量化批处理大小 / Vector Batch Size",
    description: "设置向量化处理的批处理大小，较大的值可能更快但消耗更多内存\nSet batch size for vectorization, larger values may be faster but use more memory"
  },
  {
    key: "embeddingModel",
    type: "enum",
    title: "🤖 Embedding模型选择 / Embedding Model",
    description: "选择用于向量化的模型\nSelect the model for vectorization",
    enumChoices: [
      "Ollama本地模型 / Ollama Local Model",
      "云端API服务 / Cloud API Service"
    ],
    default: "Ollama本地模型 / Ollama Local Model"
  },
  {
    key: "ollamaEmbeddingModel", 
    type: "string",
    title: "🖥️ Ollama模型名称 / Ollama Model Name",
    description: "请先使用 'ollama pull nomic-embed-text' 下载模型\nPlease download model first with 'ollama pull nomic-embed-text'",
    default: "nomic-embed-text"
  },
  {
    key: "ollamaHost",
    type: "string", 
    title: "🌐 Ollama服务地址 / Ollama Host",
    description: "Ollama API服务地址\nOllama API service address",
    default: "http://localhost:11434"
  },
  {
    key: "cloudEmbeddingApiUrl",
    type: "string",
    title: "☁️ 云端API地址 / Cloud API URL", 
    description: "如硅基流动: https://api.siliconflow.cn/v1/embeddings\nSiliconFlow: https://api.siliconflow.cn/v1/embeddings",
    default: "https://api.siliconflow.cn/v1/embeddings"
  },
  {
    key: "cloudEmbeddingApiKey",
    type: "string",
    title: "🔐 云端API密钥 / Cloud API Key",
    description: "云端服务的API密钥\nAPI key for cloud service", 
    default: ""
  },
  {
    key: "cloudEmbeddingModel",
    type: "string",
    title: "🤖 云端模型名称 / Cloud Model Name",
    description: "如硅基流动的 BAAI/bge-m3\nSiliconFlow model like BAAI/bge-m3",
    default: "BAAI/bge-m3"
  },
  {
    key: "testModeBlockLimit",
    type: "number",
    default: 100,
    title: "🧪 测试模式Block限制 / Test Mode Block Limit",
    description: "测试时只索引前N个blocks，设置为0表示索引全部\nIn test mode, only index first N blocks, set 0 to index all"
  },

  // ==================== 高级设置 ====================
  {
    key: "searchSettingsHeader",
    type: "heading",
    title: "🔍 高级设置 / Advanced Settings",
    description: "",
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

  {
    key: "enableAISummary",
    type: "boolean",
    default: true,
    title: "🤖 启用AI总结 / Enable AI Summary",
    description: "是否启用AI总结功能\nWhether to enable AI summary feature"
  },
  
  // ==================== AI回应设置 ====================
  {
    key: "aiResponseHeader",
    type: "heading",
    title: "💬 新功能：AI回应 / New Feature: AI Response",
    description: "",
    default: ""
  },
  {
    key: "aiResponseStyle",
    type: "enum",
    title: "🎭 AI回应风格 / AI Response Style",
    description: "选择AI回应的默认风格\nSelect the default style for AI responses",
    enumChoices: [
      "💖 温暖回应 - 给予理解、支持和鼓励",
      "🎯 一针见血 - 直接指出核心问题或洞察", 
      "💭 激发思考 - 提出深度问题引导进一步思考",
      "✨ 灵感火花 - 激发创意和新的可能性",
      "🌌 宇宙视角 - 从更宏大的时空维度思考"
    ],
    default: "💖 温暖回应 - 给予理解、支持和鼓励"
  }
];

async function main() {
  console.info("AI-Search Plugin Loaded");

  // 根据用户设置初始化向量数据库
  if (logseq.settings?.enableVectorSearch) {
    await initializeVectorStore();
  }

  // 注册设置
  logseq.useSettingsSchema(settings);

  // 监听设置变更，动态初始化向量数据库
  logseq.onSettingsChanged(async (newSettings, oldSettings) => {
    const vectorSearchEnabled = newSettings.enableVectorSearch;
    const wasVectorSearchEnabled = oldSettings?.enableVectorSearch;
    
    // 如果向量搜索从关闭变为开启
    if (vectorSearchEnabled && !wasVectorSearchEnabled) {
      await logseq.UI.showMsg("正在初始化向量数据库... | Initializing vector database...", "info");
      await initializeVectorStore();
      await logseq.UI.showMsg("向量数据库已初始化，请重建索引 | Vector database initialized, please rebuild index", "success");
    }
    
    // 如果快捷键发生变更，提示用户重启插件
    if (newSettings.rebuildIndexShortcut !== oldSettings?.rebuildIndexShortcut) {
      await logseq.UI.showMsg("快捷键已更新，重启插件后生效 | Shortcut updated, restart plugin to take effect", "info");
    }
  });

  // 注册AI搜索快捷键
  logseq.App.registerCommandShortcut(
    { 
      binding: logseq.settings?.shortcut || "alt+mod+a",
      mode: "non-editing"
    } as any,
    aiSearchCommand
  );

  // 注册AI回应快捷键
  logseq.App.registerCommandShortcut(
    { 
      binding: logseq.settings?.responseShortcut || "alt+mod+r",
      mode: "non-editing"
    } as any,
    aiResponseCommand
  );

  // 注册一个反斜杠命令，名为 AI-Search
  logseq.Editor.registerSlashCommand("AI-Search", aiSearchCommand);

  // 注册一个反斜杠命令，名为 AI-Response
  logseq.Editor.registerSlashCommand("AI-Response", aiResponseCommand);

  // 注册一个用于重建索引的命令
  logseq.App.registerCommandPalette({
    key: "rebuild-ai-index",
    label: "Re-build AI search index",
    keybinding: {
      binding: logseq.settings?.rebuildIndexShortcut || "alt+mod+i",
      mode: "non-editing"
    } as any,
  }, async () => {
    if (logseq.settings?.enableVectorSearch) {
      await indexAllPages();
    } else {
      await logseq.UI.showMsg("请先启用向量搜索功能 | Please enable vector search first", "warning");
    }
  });
  logseq.Editor.registerSlashCommand("Re-build AI search index", async () => {
    if (logseq.settings?.enableVectorSearch) {
      await indexAllPages();
    } else {
      await logseq.UI.showMsg("请先启用向量搜索功能 | Please enable vector search first", "warning");
    }
  });

  // 注册调试命令
  if (logseq.settings?.enableVectorSearch) {
    const { getVectorStoreStats } = await import('./services/vectorService');
    
    logseq.Editor.registerSlashCommand("Vector Debug: Show Stats", async () => {
      const stats = await getVectorStoreStats();
      console.log("Vector Store Stats:", stats);
      await logseq.UI.showMsg(
        `📊 向量数据库统计:\n` +
        `• 总Block数: ${stats.count || 0}\n` +
        `• 向量维度: ${stats.dim || 'Unknown'}\n` +
        `• 详细信息请查看控制台`, 
        "success", 
        { timeout: 8000 }
      );
    });
  }

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

// 启动插件
logseq.ready(main).catch(console.error);

// 渲染 React 组件
const root = ReactDOM.createRoot(document.getElementById("app")!);
root.render(
  <React.StrictMode>
    {/* <App /> */}
  </React.StrictMode>
);