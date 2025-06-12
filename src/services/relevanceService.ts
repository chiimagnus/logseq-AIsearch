// 相关性评估服务模块

import { generateResponse } from './apiService';
import { getRelevanceEvaluationPrompt } from '../prompts/relevanceEvaluation';

export async function evaluateRelevance(query: string, content: string): Promise<number> {
  const prompt = getRelevanceEvaluationPrompt(query, content);
  
  const response = await generateResponse(prompt);
  const score = parseFloat(response) || 0;
  
  return score;
} 