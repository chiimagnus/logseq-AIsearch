<h1 align="center">
    🎉 logseq-plugin-AISearch
</h1>

一款基于AI的Logseq智能搜索插件，可以根据当前block内容进行全局文档搜索，并提供AI智能总结功能。

## ✨ 主要功能
- 🔍 基于当前block内容的智能搜索
- 📝 搜索结果的AI智能总结
- 🔗 快速跳转到原始笔记
- ⚡️ 支持自定义AI模型和参数
- 🌐 新增智谱清言大模型API支持

## 🚀 快速开始

### 前置要求（二选一）
1. Ollama本地部署
   - 安装并部署 [ollama](https://ollama.com/) 大模型
   - 确保 ollama 服务正常运行
2. 智谱清言API
   - 在[智谱清言开放平台](https://open.bigmodel.cn/pricing)申请API密钥
   - 获取模型调用权限
   - PS：可选用免费的glm-4-flash模型

### 安装配置
1. 在 Logseq 市场安装插件
2. 根据选择的方式配置参数：
   - Ollama方式：
     - 设置主机地址（默认：localhost:11434）
     - 选择AI模型（默认：qwen2.5）
   - 智谱清言方式：
     - 配置API密钥
     - 选择模型（如：glm-4-plus）

### 使用方法
- 命令方式：输入 `/AI-Search`
- 快捷键：`alt+mod+a`

## 📸 功能展示
<div align="center">
  <img src="public/demo1.png" width="600">
  <img src="public/demo2.png" width="600">
</div>

## 🗺️ 开发计划
- [ ] 增加更多模型支持
- [ ] 增加暂停和取消功能
- [ ] 优化时间维度的AI总结

### 已完成
- [x] v1.0.0 核心功能发布
- [x] v1.3.0 新增智谱清言大模型API支持
  <div align="center">
    <img src="public/v1.0-AIsearch插件设计.png" width="800">
  </div>

> 更多更新详情请查看 [CHANGELOG.md](CHANGELOG.md)

## 🔧 常见问题

- ✅ 性能优化：持续改进中，努力在搜索准确度和性能消耗之间寻找平衡

## 🙏 致谢
- [logseq插件API文档](https://plugins-doc.logseq.com/)
- [logseq插件开发实战](https://correctroad.gitbook.io/logseq-plugins-in-action/chapter-1/make-logseq-plugins-support-settings)
- [logseq-plugins-smartsearch](https://github.com/sethyuan/logseq-plugin-smartsearch)
- [ollama-logseq](https://github.com/omagdy7/ollama-logseq)
- [logseq-plugin-link-preview](https://github.com/pengx17/logseq-plugin-link-preview)

特别感谢 ollama-logseq 开发者 [@omagdy7](https://github.com/omagdy7) 帮助我解决了 CORS 跨域限制问题：[参考链接](https://github.com/omagdy7/ollama-logseq/issues/32)

## ☕️ 支持作者
<div align="center">
  <img src="public/buymeacoffee.jpg" width="400">
</div>
