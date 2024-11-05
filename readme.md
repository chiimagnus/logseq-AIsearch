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
![demo.png](public/demo2.png)


## TODO
1. 还有些地方需要改进，搜索的内容尽可能简洁点，因为关键词拆分的时候有些毛病。这个也是我需要完善的
2. 增加用户自定义UI界面，比如用户自定义ollama模型。


## Thanks🙏
1. [logseq插件API文档](https://plugins-doc.logseq.com/)
2. [logseq插件开发实战](https://correctroad.gitbook.io/logseq-plugins-in-action/chapter-1/make-logseq-plugins-support-settings)
3. [logseq开发模版：logseq-plugin-template-react](https://github.com/pengx17/logseq-plugin-template-react)

1. [logseq-plugins-smartsearch](https://github.com/sethyuan/logseq-plugin-smartsearch)
2. [ollama-logseq](https://github.com/omagdy7/ollama-logseq)
3. [logseq-plugin-link-preview](https://github.com/pengx17/logseq-plugin-link-preview)

1. [farfalle](https://github.com/rashadphz/farfalle)
2. [FreeAskInternet](https://github.com/nashsu/FreeAskInternet)
3. [search_with_ai](https://github.com/yokingma/search_with_ai)


## Some problems
1. CORS 的限制解决方案：（DOING）
 - [How to Solve CORS Issues When Calling Ollama API from a Chrome Extension](https://blog.mellowtel.com/how-to-solve-cors-issues-when-calling-ollama-api-from-a-chrome-extension)
 - [feat: api allow chrome-extension origin #6010](https://github.com/ollama/ollama/pull/6010)


## Buy me a coffee☕️
![buymeacoffee](public/buymeacoffee.jpg)