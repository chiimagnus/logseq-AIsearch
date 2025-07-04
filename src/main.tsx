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
    key: "embeddingModel",
    type: "enum",
    title: "🤖 Embedding模型选择 / Embedding Model",
    description: "选择用于向量化的模型\nSelect the model for vectorization",
    enumChoices: [
      "Ollama Embedding",
      "Custom Embedding API"
    ],
    default: "Ollama本地模型 / Ollama Local Model"
  },
  {
    key: "vectorStorageBackend",
    type: "enum",
    title: "💾 向量存储方案 / Vector Storage Backend",
    description: "选择向量数据的存储方案\nSelect the storage backend for vector data",
    enumChoices: [
      "分块压缩存储 (推荐) / Chunked localStorage (Recommended)",
      "Assets API 存储 / Assets API Storage"
    ],
    default: "分块压缩存储 (推荐) / Chunked localStorage (Recommended)"
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

  {
    key: "rebuildIndexShortcut",
    type: "string",
    title: "⌨️ 重建索引快捷键 / Rebuild Index Shortcut",
    description: "设置重建向量索引的快捷键\nSet shortcut for rebuilding vector index",
    default: "alt+mod+i"
  },

  
  // ==================== Ollama 本地部署 ====================
  {
    key: "ollamaHeader",
    type: "heading",
    title: "🖥️ Ollama 本地部署 / Ollama Local Deployment",
    description: "请先使用 'ollama pull nomic-embed-text' 下载embedding模型",
    default: ""
  },

  {
    key: "model",
    type: "string",
    title: "🤖 Ollama聊天模型名称 / Ollama Chat Model Name",
    description: "",
    default: "deepseek-r1:8b"
  },
  {
    key: "ollamaHost",
    type: "string", 
    title: "🌐 Ollama Host",
    description: "Ollama API服务地址 (聊天和Embedding) / Ollama API service address (Chat and Embedding)",
    default: "http://localhost:11434"
  },
  {
    key: "ollamaEmbeddingModel", 
    type: "string",
    title: "🤖 Ollama Embedding模型名称 / Ollama Embedding Model Name",
    description: "推荐使用 nomic-embed-text",
    default: "nomic-embed-text"
  },
  
  // ==================== 自定义API配置 ====================
  {
    key: "unifiedApiHeader",
    type: "heading",
    title: "🛠️ 自定义API / Custom API Configuration",
    description: "",
    default: ""
  },
  {
    key: "apiUrl",
    type: "string",
    title: "🔗 聊天模型API URL / Chat Model API URL",
    description: "",
    default: "https://open.bigmodel.cn/api/paas/v4/chat/completions"
  },
  {
    key: "apiKey",
    type: "string",
    title: "🔐 聊天模型API Key / Chat Model API Key",
    description: "",
    default: ""
  },
  {
    key: "modelName",
    type: "string",
    title: "🤖 聊天模型名称 / Chat Model Name",
    description: `
支持符合OpenAI格式的各种API服务。

🧠 聊天模型API示例 (Chat Model API Examples):
• 智谱清言Zhipu AI: https://open.bigmodel.cn/api/paas/v4/chat/completions
• 硅基流动SiliconFlow: https://api.siliconflow.cn/v1/chat/completions
`,
    default: "GLM-4-Flash-250414"
  },
  {
    key: "cloudEmbeddingApiUrl",
    type: "string",
    title: "Embedding API URL", 
    description: "如SiliconFlow: https://api.siliconflow.cn/v1/embeddings",
    default: "https://api.siliconflow.cn/v1/embeddings"
  },
  {
    key: "cloudEmbeddingApiKey",
    type: "string",
    title: "🔐 Embedding API密钥 / Embedding API Key",
    description: "", 
    default: ""
  },
  {
    key: "cloudEmbeddingModel",
    type: "string",
    title: "🤖 Embedding模型名称 / Embedding Model Name",
    description: "SiliconFlow model like BAAI/bge-m3",
    default: "BAAI/bge-m3"
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

  // 初始化向量数据库
  await initializeVectorStore();

  // 注册设置
  logseq.useSettingsSchema(settings);

  // 监听设置变更
  logseq.onSettingsChanged(async (newSettings, oldSettings) => {
    // 如果快捷键发生变更，提示用户重启插件
    if (newSettings.rebuildIndexShortcut !== oldSettings?.rebuildIndexShortcut) {
      await logseq.UI.showMsg("快捷键已更新，重启插件后生效 | Shortcut updated, restart plugin to take effect", "info");
    }

    // 如果存储后端发生变更，切换存储方案
    if (newSettings.vectorStorageBackend !== oldSettings?.vectorStorageBackend) {
      try {
        const { switchStorageBackend } = await import('./services/vectorService');
        const backend = newSettings.vectorStorageBackend?.includes('Assets') ? 'assets' : 'chunked-localStorage';
        await switchStorageBackend(backend);

        const backendName = backend === 'assets' ? 'Assets API 存储' : '分块压缩存储';
        await logseq.UI.showMsg(`✅ 已切换到 ${backendName}`, "success", { timeout: 3000 });
      } catch (error) {
        console.error("切换存储后端失败:", error);
        await logseq.UI.showMsg("❌ 存储后端切换失败，请重启插件", "error");
      }
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
    await indexAllPages();
  });
  logseq.Editor.registerSlashCommand("Re-build AI search index", async () => {
    await indexAllPages();
  });

  // 注册调试命令
  const { getVectorStoreStats, clearVectorData } = await import('./services/vectorService');

  // 向量数据管理命令
  logseq.Editor.registerSlashCommand("Vector: Show Stats", async () => {
    try {
      const stats = await getVectorStoreStats();
      console.log("📊 向量存储统计:", stats);

      let message = `📊 向量存储统计\n` +
        `• 总Block数: ${stats.count || 0}\n` +
        `• 向量维度: ${stats.dim || 'Unknown'}\n` +
        `• 存储后端: ${stats.backend || 'Unknown'}`;

      if (stats.storageStats) {
        if (stats.storageStats.totalChunks) {
          message += `\n• 数据块数: ${stats.storageStats.totalChunks}`;
          message += `\n• 压缩率: ${stats.storageStats.compressionRatio}`;
          message += `\n• 存储大小: ${stats.storageStats.compressedSizeMB}MB`;
        } else if (stats.storageStats.sizeMB) {
          message += `\n• 存储大小: ${stats.storageStats.sizeMB}MB`;
        }
      }

      message += `\n• 详细信息请查看控制台`;

      await logseq.UI.showMsg(message, "success", { timeout: 10000 });
    } catch (error) {
      await logseq.UI.showMsg("❌ 获取存储统计失败", "error");
      console.error("获取存储统计失败:", error);
    }
  });

  logseq.Editor.registerSlashCommand("Vector: Clear Data", async () => {
    try {
      await clearVectorData();
      await logseq.UI.showMsg("✅ 向量数据已清除，请重新建立索引", "success");
      console.log("向量数据已清除");
    } catch (error) {
      await logseq.UI.showMsg("❌ 清除向量数据失败", "error");
      console.error("清除向量数据失败:", error);
    }
  });

  // 存储系统管理命令
  logseq.Editor.registerSlashCommand("Storage: Test & Status", async () => {
    try {
      const { runStorageTests } = await import('./services/storageTest');
      await runStorageTests();
    } catch (error) {
      await logseq.UI.showMsg("❌ 存储测试失败", "error");
      console.error("存储测试失败:", error);
    }
  });

  logseq.Editor.registerSlashCommand("Storage: Reinitialize", async () => {
    try {
      await logseq.UI.showMsg("🔄 正在重新初始化存储系统...", "info");

      // 重新初始化向量存储
      const { initializeVectorStore } = await import('./services/vectorService');
      await initializeVectorStore();

      await logseq.UI.showMsg("✅ 存储系统重新初始化完成", "success");
    } catch (error) {
      await logseq.UI.showMsg("❌ 存储系统重新初始化失败", "error");
      console.error("存储系统重新初始化失败:", error);
    }
  });

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