<h1 align="center">
    🎉 AI Search
</h1>

<div align="center">
    <a href="readme.md">中文</a> | <a href="readme_en.md">English</a>
</div>

一款基于AI的Logseq智能搜索插件，可以根据当前block内容进行全局文档搜索，并提供AI智能总结功能。

## ✨ 主要功能

### 🔍 AI智能搜索
- 基于当前block内容的全局搜索
- 搜索结果的AI总结
- 链接原始笔记
- 支持自定义大模型API

### 🤖 AI多风格回应
- 温暖回应：给予理解、支持和鼓励
- 一针见血：直接指出核心问题或洞察
- 激发思考：提出深度问题引导进一步思考
- 灵感火花：从不同视角重新审视问题，激发创意和新的可能性
- 宇宙视角：从更宏大的时空维度思考

## 🚀 快速开始

### AI搜索使用方法
- 命令方式：输入 `/AI-Search`
- 快捷键：`alt+mod+a`
  - Mac: `⌥ + ⌘ + A` (Alt + Command + A)
  - Windows: `Alt + Ctrl + A`

### AI回应使用方法
1. **配置回应风格**：在插件设置中选择您喜欢的AI回应风格。

2. **使用AI回应**：
   - 选中一个或多个blocks
   - 使用以下方式触发AI回应：
     - 命令方式：输入 `/AI-Response`
     - 快捷键：`alt+mod+r`
       - Mac: `⌥ + ⌘ + R` (Alt + Command + R)
       - Windows: `Alt + Ctrl + R`

3. **查看结果**：
   - AI会根据您设置的风格生成回应，保存到"AIResponse"页面
   - 在原始blocks旁边会自动插入AI回应的引用链接

## 📸 功能展示
- [demo.mp4](https://github.com/chiimagnus/logseq-AIsearch/blob/master/public/demo.mp4)
or
[demo_bilibili](https://www.bilibili.com/video/BV1pC6wYXE93)

- prompts位于[`src/prompts`](https://github.com/chiimagnus/logseq-AIsearch/tree/master/src/prompts)，由于本人提示词工程水平有限，恳请大家多多提交issue，我会认真考虑。

## 开发计划
- [ ]实现AI意图识别、工具调用。
- [ ]优化向量搜索的性能。

## 🙏 致谢
- [logseq插件API文档](https://plugins-doc.logseq.com/)
- [logseq插件开发实战](https://correctroad.gitbook.io/logseq-plugins-in-action/chapter-1/make-logseq-plugins-support-settings)
- [logseq-plugins-smartsearch](https://github.com/sethyuan/logseq-plugin-smartsearch)
- [ollama-logseq](https://github.com/omagdy7/ollama-logseq)
- [logseq-plugin-link-preview](https://github.com/pengx17/logseq-plugin-link-preview)

特别感谢 ollama-logseq 开发者 [@omagdy7](https://github.com/omagdy7) 帮助我解决了 CORS 跨域限制问题：[参考链接](https://github.com/omagdy7/ollama-logseq/issues/32)

## ☕️ 支持作者
[buymeacoffee](https://github.com/chiimagnus/logseq-AIsearch/blob/master/public/buymeacoffee.jpg)
<div align="center">
  <img src="https://github.com/chiimagnus/logseq-AIsearch/blob/master/public/buymeacoffee.jpg" width="400">
</div>
