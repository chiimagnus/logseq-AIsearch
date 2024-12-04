import OpenAI from "openai";

export async function zhipuGenerate(prompt: string): Promise<string> {
  try {
    const apiKey = logseq.settings?.zhipuApiKey as string | undefined;
    const openai = new OpenAI({
      apiKey: apiKey,
      baseURL: "https://open.bigmodel.cn/api/paas/v4",
      dangerouslyAllowBrowser: true
    });

    const response = await openai.chat.completions.create({
      model: (logseq.settings?.zhipuModel as string) || 'glm-4-plus',
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: undefined,
      temperature: 0.5
    });

    return response.choices[0].message.content || '';
  } catch (error) {
    console.error("智谱清言 API Error:", error);
    logseq.UI.showMsg("调用智谱清言 API 失败，请检查服务状态", 'error');
    return "请求失败，请稍后重试";
  }
}