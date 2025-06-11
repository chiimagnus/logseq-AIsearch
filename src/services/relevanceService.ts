/**
 * 相关性评估服务模块
 * Relevance Evaluation Service Module
 */

import { generateResponse } from './apiService';
import { detectLanguage } from '../tools/languageDetector';
import { getRelevanceEvaluationPrompt } from '../prompts/relevanceEvaluation';

/**
 * 单个内容的相关性评估
 * Single Content Relevance Evaluation
 */
export async function evaluateRelevance(query: string, content: string): Promise<number> {
  const lang = detectLanguage(query);
  const prompt = getRelevanceEvaluationPrompt(query, content, lang);
  
  const response = await generateResponse(prompt);
  const score = parseFloat(response) || 0;
  
  return score;
} 