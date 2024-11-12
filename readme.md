# 🎉🎉🎉 logseq-plugin-AISearch💫💫💫

使用`/`调出AISearch功能，基于该block内容 进行logseq文档内的全局搜索 并输出相关内容。


## What you need?
1. 你在开始使用该插件之前需要部署[ollama](https://ollama.com/)大模型。
2. 你需要注意，该插件默认配置（可以更改）：
   - Ollama 主机地址（默认为 localhost:11434）
   - AI 模型（默认为 qwen2.5）
3. 然后，你就可以通过`/AI-Search`命令调用该插件啦！
4. 祝你使用愉快！对了，记得打开ollama app哦！


## Demo
<img src="public/demo1.png" style="width: 50%;">
<img src="public/demo2.png" style="width: 50%;">


## ROADMAP
- **v1.0.0** 大功能：（基本实现了！）
   <img src="public/v1.0-AIsearch插件设计.png" style="width: 100%;">

- [ ] 优化1：AI搜索性能

- [x] ~~允许用户自定义ollama大模型，2024年11月6日~~
- [x] ~~允许用户自定义ollama API端口，2024年11月6日~~
- [x] ~~允许用户自定义prompt，2024年11月8日~~后来删掉了该功能2024年11月9日😊
- [x] ~~功能1：查询过程(2024年11月8日)~~
  - [x] ~~1.1 正在搜索：显示当前查询的关键词列表，例如「正在搜索：关键词1，关键词2，关键词3…」，让用户知道 AI 正在根据这些关键词展开搜索。~~
  - [x] ~~1.2 正在总结：在搜索完成后，显示「正在总结」状态，提示用户 AI 正在处理和整合信息，以生成回答。~~

- [x] ~~功能2：结果呈现(2024年11月8日)~~
  - [x] ~~2.1 AI总结的内容放在子块1：将 AI 生成的回答作为第一个子块，直接放在用户提问的下方。~~ 
  - [x] ~~2.2 笔记来源放在子块2：将所有引用的相关笔记内容放入第二个子块，每个引用的笔记单独用一个 block 显示，形成多层次结构，便于用户查看。~~
  - [x] ~~2.3 笔记来源中的笔记链接：将笔记内容替换成链接（如果 Logseq API 支持），每个引用笔记都显示为可点击的链接，点击后能跳转到该笔记在 Logseq 中的位置。~~
  - ~~你的需求描述很清楚，现在只需要确认 Logseq 的 API 是否支持笔记链接的功能。如果支持，那么功能2.3 可以实现；如果不支持，可以考虑其他替代方案，例如在插件内创建类似链接的跳转方法。~~

  - [x] ~~功能3：关键词优化 & AI总结优化（这个好难调啊，真是艺术活😭）【2024-11-11】~~
  - [x] ~~3.1 关键词的联想功能：AI 搜索过程会动态显示与查询内容相关的关键词，让用户了解 AI 关注的主题或方向，这也能帮助用户理解 AI 的思考过程。~~
  - [x] ~~3.2 AI总结的优化：AI总结的优化，让AI总结的更加准确，更加符合用户的预期。~~

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
- [x] ~~CORS 的限制解决方案: https://github.com/omagdy7/ollama-logseq/issues/32~~
- [ ] 可能会调用较多的ollama模型资源，因此会占用较大的Mac内存：）【2024-11-12】
- [ ] 我现在还不知道该如何避免搜索准确的同时，又降低性能消耗，抱歉😭【2024-11-12】

## Buy me a coffee☕️
<img src="public/buymeacoffee.jpg" style="width: 50%;">
