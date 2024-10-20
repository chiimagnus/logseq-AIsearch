import compromise from 'compromise';

export async function aiSearch(query: string): Promise<string> {
  try {
    console.log("开始搜索，查询词：", query);

    // 使用compromise库进行关键词提取
    const doc = compromise(query);
    const nouns = doc.nouns().out('array');
    const verbs = doc.verbs().out('array');

    // 使用正则表达式拆分句子为单词
    const words = query.match(/\b(\w+)\b/g) || [];

    // 合并所有提取的关键词
    const keywords = [...new Set([...nouns, ...verbs, ...words])];
    console.log("提取的关键词：", keywords);

    let allResults: string[] = [];

    // 对每个关键词进行查询
    for (const keyword of keywords) {
      const searchResults = await logseq.DB.datascriptQuery(`
        [:find (pull ?b [*])
         :where
         [?b :block/content ?c]
         [(clojure.string/includes? ?c "${keyword}")]]
      `);

      console.log(`关键词 "${keyword}" 的搜索结果:`, searchResults);

      if (searchResults.length > 0) {
        const formattedResults = searchResults.map((result: any) => {
          const block = result[0];
          const pageName = block.page ? block.page.name : "未命名页面";
          return `- ${block.content}\n  页面: ${pageName}`;
        }).join('\n');

        allResults.push(formattedResults);
      }
    }

    if (allResults.length === 0) {
      return "未找到相关内容";
    }

    const combinedResults = allResults.join('\n\n');
    console.log("所有格式化后的搜索结果:", combinedResults);

    // 使用Ollama API进行结果总结
    const summaryPrompt = `以下是Logseq中搜索"${query}"的结果,请总结这些内容:\n\n${combinedResults}`;
    const summary = await ollamaGenerate(summaryPrompt);

    return `搜索结果摘要:\n${summary}\n`; // \n原始搜索结果:\n${combinedResults}
  } catch (error) {
    console.error("AI搜索失败: ", error);
    return "搜索失败,请稍后重试";
  }
}

// 保留原有的ollamaGenerate函数,用于生成摘要
async function ollamaGenerate(prompt: string): Promise<string> {
  try {
    const response = await fetch("http://localhost:11434/api/generate", {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: "qwen2.5",
        prompt: prompt,
        stream: false,
      }),
    });
  
    if (!response.ok) {
      throw new Error(`Ollama API 请求失败: ${response.statusText}`);
    }
  
    const rawData = await response.text();
    console.log("Ollama API 返回的数据:", rawData);

    if (!rawData) {
      throw new Error("Ollama API 返回了空数据");
    }
  
    const data = JSON.parse(rawData);
  
    if (!data.response) {
      throw new Error("Ollama API 未生成文本");
    }
  
    return data.response;
  } catch (error) {
    console.error("调用 Ollama API 失败: ", error);
    return "生成文本失败";
  }
}
