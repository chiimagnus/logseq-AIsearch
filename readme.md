# 🎉🎉🎉 logseq-plugin-AISearch💫💫💫

>基于当前block内容，进行logseq文档内的全局搜索，返回笔记来源，并可以进行AI总结。


## What you need?
1. 你在开始使用该插件之前需要部署[ollama](https://ollama.com/)大模型。
2. 你需要注意，该插件默认配置（可以更改）：
   - Ollama 主机地址（默认为 localhost:11434）
   - AI 模型（默认为 qwen2.5）
3. 然后，你就可以通过`/AI-Search`命令或者快捷键`alt+mod+a`调用该插件啦！
4. 祝你使用愉快！对了，记得打开ollama app哦！


## Demo
<div style="text-align: center;">
  <img src="public/demo1.png" style="width: 50%;">
  <img src="public/demo2.png" style="width: 50%;">
</div>


## Roadmap

- [x] v1.0.0
  <div style="text-align: center;">
    <img src="public/v1.0-AIsearch插件设计.png" style="width: 90%;">
  </div>

>详情请见[CHANGELOG.md](CHANGELOG.md)


## Thanks🙏
1. [logseq插件API文档](https://plugins-doc.logseq.com/)
2. [logseq插件开发实战](https://correctroad.gitbook.io/logseq-plugins-in-action/chapter-1/make-logseq-plugins-support-settings)
3. [logseq-plugins-smartsearch](https://github.com/sethyuan/logseq-plugin-smartsearch)
4. [ollama-logseq](https://github.com/omagdy7/ollama-logseq)
5. [logseq-plugin-link-preview](https://github.com/pengx17/logseq-plugin-link-preview)
6. 非常感谢ollama-logseq的开发者[@omagdy7](https://github.com/omagdy7)提供的帮助！

<!-- 1. [farfalle](https://github.com/rashadphz/farfalle)
2. [FreeAskInternet](https://github.com/nashsu/FreeAskInternet)
3. [search_with_ai](https://github.com/yokingma/search_with_ai) -->


## Some problems
- [x] CORS 的限制解决方案: https://github.com/omagdy7/ollama-logseq/issues/32
- [x] 我现在还不知道该如何避免搜索准确的同时，又降低性能消耗，抱歉😭【2024-11-12】

## Buy me a coffee☕️
<div style="text-align: center;">
  <img src="public/buymeacoffee.jpg" style="width: 50%;">
</div>
