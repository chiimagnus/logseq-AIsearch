export interface SearchResult {
  block: {
    content: string;
    uuid: string;
    parent?: string;
    page?: {
      name: string;
      "journal-day"?: number;
    };
  };
  score: number;
}

export interface SearchConfig {
  maxResults: number;
  minScore: number;
  batchSize: number;
  includeParent: boolean;
  includeSiblings: boolean;
  includeChildren: boolean;
  enableAISummary: boolean;
  enableTimeTools: boolean;
}

export interface SearchResponse {
  summary: string;
  results: SearchResult[];
} 