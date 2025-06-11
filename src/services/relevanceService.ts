/**
 * 相关性评估服务模块
 * Relevance Evaluation Service Module
 */

import { generateResponse } from './apiService';
import { getRelevanceEvaluationPrompt } from '../prompts/relevanceEvaluation';

/**
 * 单个内容的相关性评估
 * Single Content Relevance Evaluation
 */
export async function evaluateRelevance(query: string, content: string): Promise<number> {
  const prompt = getRelevanceEvaluationPrompt(query, content);
  
  const response = await generateResponse(prompt);
  const score = parseFloat(response) || 0;
  
  return score;
} 