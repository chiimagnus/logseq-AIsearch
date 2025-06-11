/**
 * 语言检测工具
 * Language Detection Tool
 */

export function detectLanguage(text: string): 'en' | 'zh' {
  // 计算英文字符的比例
  const englishChars = text.match(/[a-zA-Z]/g)?.length || 0;
  // 计算中文字符的比例
  const chineseChars = text.match(/[\u4e00-\u9fa5]/g)?.length || 0;
  
  return englishChars > chineseChars ? 'en' : 'zh';
} 