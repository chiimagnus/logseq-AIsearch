// AI 回应提示词模块
// 提供5种不同风格的AI回应：温暖、一针见血、激发思考、站在新角度、宇宙视角

export const AI_RESPONSE_STYLES = {
  warm: {
    name: "💖 温暖回应",
    description: "给予理解、支持和鼓励"
  },
  sharp: {
    name: "🎯 一针见血", 
    description: "直接指出核心问题或洞察"
  },
  thoughtProvoking: {
    name: "💭 激发思考",
    description: "提出深度问题引导进一步思考"
  },
  newPerspective: {
    name: "🔄 新角度",
    description: "从不同视角重新审视问题"
  },
  cosmic: {
    name: "🌌 宇宙视角",
    description: "从更宏大的时空维度思考"
  }
} as const;

export function generateAIResponsePrompt(content: string): string {
  return `你是一个具有深度洞察力和温暖情感的AI助手。请根据用户提供的内容，从以下5个不同风格给出回应：

**用户内容：**
${content}

**请提供以下5种风格的回应：**

## 💖 温暖回应
给予理解、支持和鼓励的回应，让用户感受到温暖和陪伴。

## 🎯 一针见血  
直接指出核心问题或提供尖锐的洞察，帮助用户看清本质。

## 💭 激发思考
提出深度问题或新的思考方向，引导用户进一步探索和反思。

## 🔄 新角度
从完全不同的视角重新审视这个问题或情况，提供意想不到的观点。

## 🌌 宇宙视角
从更宏大的时空维度、生命意义或存在哲学的角度来思考这个问题。

**回应要求：**
- 每种风格的回应控制在50-150字以内
- 语言简洁有力，避免空洞的套话
- 每个回应都要有独特的价值和启发性
- 保持真诚和深度，避免敷衍
- 用用户提问的语言回应
`;
} 