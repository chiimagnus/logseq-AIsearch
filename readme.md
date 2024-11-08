# 🎉🎉🎉 logseq-plugin-AISearch💫💫💫

使用`/`调出AISearch功能，基于该block内容 进行logseq文档内的全局搜索 并输出相关内容。


## How to deploy?
1. 下载源码[repo](https://github.com/chiimagnus/logseq-AIsearch)。
2. 还需要部署[ollama](https://ollama.com/)，下载ollama软件，然后就可以下载到qwen2.5模型啦！`ollama run qwen2.5`。
3. 在 Logseq 插件设置中配置：
   - Ollama 主机地址（默认为 localhost:11434）
   - AI 模型（默认为 qwen2.5）
4. 在项目文件夹终端运行`pnpm install && pnpm run build`。


## How it works?
1. 用户触发搜索：通过`/AI-Search`命令调用。
2. 插件处理：
   - 获取当前block内容
   - 调用AI模型进行内容分析
   - 在文档中搜索相关内容
   - 生成格式化的搜索结果
3. 结果展示：在当前block下方（兄弟block）自动插入搜索结果
4. 在调用之前你还需要打开ollama app，不然会报错：）


## Demo
![demo.png](public/demo1.png)


## TODO
- **v1.0.0** 大功能：UI界面升级，~~类似biji.com AI助手那样~~不了，我想着还是深度结合logseq的block吧。效果这样：
   <img src="public/v0.5AIsearch插件设计.png" style="width: 100%;">

- [ ] 功能1：查询过程  
  - [ ] 1.1 正在搜索：显示当前查询的关键词列表，例如「正在搜索：关键词1，关键词2，关键词3…」，让用户知道 AI 正在根据这些关键词展开搜索。  
  - [ ] 1.2 正在总结：在搜索完成后，显示「正在总结」状态，提示用户 AI 正在处理和整合信息，以生成回答。  
  - [ ] 1.3 关键词的联想功能：AI 搜索过程会动态显示与查询内容相关的关键词，让用户了解 AI 关注的主题或方向，这也能帮助用户理解 AI 的思考过程。  

- [ ] 功能2：结果呈现  
  - [ ] 2.1 AI总结的内容放在子块1：将 AI 生成的回答作为第一个子块，直接放在用户提问的下方。  
  - [ ] 2.2 笔记来源放在子块2：将所有引用的相关笔记内容放入第二个子块，每个引用的笔记单独用一个 block 显示，形成多层次结构，便于用户查看。  
  - [ ] 2.3 笔记来源中的笔记链接：将笔记内容替换成链接（如果 Logseq API 支持），每个引用笔记都显示为可点击的链接，点击后能跳转到该笔记在 Logseq 中的位置。  

- 你的需求描述很清楚，现在只需要确认 Logseq 的 API 是否支持笔记链接的功能。如果支持，那么功能2.3 可以实现；如果不支持，可以考虑其他替代方案，例如在插件内创建类似链接的跳转方法。
- [x] ~~允许用户自定义ollama模型~~
- [x] ~~允许用户自定义ollama API端口~~
- [x] ~~允许用户自定义prompt~~


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


## Buy me a coffee☕️
<img src="public/buymeacoffee.jpg" style="width: 50%;">
