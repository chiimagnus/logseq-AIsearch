/**
 * 时间工具模块 - Time Tools Module
 * 实现MCP风格的时间工具，用于解析用户的时间相关查询
 */

export interface TimeRange {
  start?: Date;
  end?: Date;
  description: string;
  isRelativeTime: boolean;
}

export interface TimeToolsResult {
  timeRanges: TimeRange[];
  keywords: string[];
  originalQuery: string;
  hasTimeContext: boolean;
}

/**
 * 获取当前页面的日期信息
 */
async function getCurrentPageDate(): Promise<Date | null> {
  try {
    const currentPage = await logseq.Editor.getCurrentPage();
    if (currentPage?.name) {
      // 尝试解析页面名称为日期
      const pageName = currentPage.name as string;
      
      // 支持多种日期格式
      const datePatterns = [
        /^(\d{4})-(\d{1,2})-(\d{1,2})$/, // 2025-06-02
        /^(\d{4})年(\d{1,2})月(\d{1,2})日$/, // 2025年6月2日
        /^(\d{1,2})月(\d{1,2})日$/, // 6月2日
        /^(\d{1,2})-(\d{1,2})$/, // 6-2
      ];
      
      for (const pattern of datePatterns) {
        const match = pageName.match(pattern);
        if (match) {
          let year: number, month: number, day: number;
          const currentYear = new Date().getFullYear();
          
          if (pattern.source.includes('年')) {
            // YYYY年MM月DD日格式
            year = parseInt(match[1]);
            month = parseInt(match[2]) - 1;
            day = parseInt(match[3]);
          } else if (pattern.source.includes('-') && match.length === 4) {
            // YYYY-MM-DD格式
            year = parseInt(match[1]);
            month = parseInt(match[2]) - 1;
            day = parseInt(match[3]);
          } else {
            // 短格式，使用当前年份
            year = currentYear;
            if (match.length === 3) {
              // MM月DD日 或 MM-DD
              month = parseInt(match[1]) - 1;
              day = parseInt(match[2]);
            } else {
              continue;
            }
          }
          
          return new Date(year, month, day);
        }
      }
    }
  } catch (error) {
    console.log("📅 无法获取当前页面日期，使用系统日期 | Cannot get current page date, using system date");
  }
  
  return null;
}

/**
 * 将日期转换为多种格式的关键词
 */
function generateDateKeywords(date: Date): string[] {
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // JavaScript月份从0开始
  const day = date.getDate();
  
  const keywords = [
    // 标准格式
    `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`, // 2025-06-02
    `${year}-${month}-${day}`, // 2025-6-2
    
    // 中文格式
    `${year}年${month}月${day}日`, // 2025年6月2日
    `${year}年${String(month).padStart(2, '0')}月${String(day).padStart(2, '0')}日`, // 2025年06月02日
    
    // 短格式
    `${month}月${day}日`, // 6月2日
    `${String(month).padStart(2, '0')}月${String(day).padStart(2, '0')}日`, // 06月02日
    `${month}-${day}`, // 6-2
    `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`, // 06-02
    
    // 英文格式
    `${year}/${month}/${day}`, // 2025/6/2
    `${month}/${day}/${year}`, // 6/2/2025
    
    // 其他可能的格式
    `${year}.${month}.${day}`, // 2025.6.2
    `${day}/${month}/${year}`, // 2/6/2025 (欧洲格式)
  ];
  
  return keywords;
}

/**
 * 时间工具 - 解析用户查询中的时间信息
 */
export async function parseTimeQuery(query: string): Promise<TimeToolsResult> {
  // 先获取参考日期（优先使用当前页面日期，否则使用系统日期）
  let referenceDate = await getCurrentPageDate();
  if (!referenceDate) {
    referenceDate = new Date();
  }
  
  console.log("📅 [时间工具] 参考日期 | Reference date:", referenceDate.toLocaleDateString());
  
  const timeRanges: TimeRange[] = [];
  const keywords: string[] = [];
  let hasTimeContext = false;

  // 检测时间关键词
  const timePatterns = {
    // 今天相关
    today: [
      /今天/g, /today/gi, /今日/g
    ],
    // 昨天相关
    yesterday: [
      /昨天/g, /yesterday/gi, /昨日/g
    ],
    // 本周相关
    thisWeek: [
      /本周/g, /这周/g, /this week/gi
    ],
    // 上周相关
    lastWeek: [
      /上周/g, /上个星期/g, /last week/gi
    ],
    // 本月相关
    thisMonth: [
      /本月/g, /这个月/g, /this month/gi
    ],
    // 上月相关
    lastMonth: [
      /上月/g, /上个月/g, /last month/gi
    ],
    // 今年相关
    thisYear: [
      /今年/g, /this year/gi
    ],
    // 去年相关
    lastYear: [
      /去年/g, /last year/gi
    ],
    // 去年的今天
    lastYearToday: [
      /去年的今天/g, /去年今天/g, /去年同期/g, /a year ago today/gi, /this day last year/gi
    ],
    // 几天前
    daysAgo: [
      /(\d+)天前/g, /(\d+) days? ago/gi, /前(\d+)天/g
    ],
    // 几周前
    weeksAgo: [
      /(\d+)周前/g, /(\d+) weeks? ago/gi, /(\d+)个星期前/g
    ],
    // 几个月前
    monthsAgo: [
      /(\d+)个月前/g, /(\d+) months? ago/gi
    ],
    // 具体日期 (YYYY-MM-DD, MM/DD/YYYY等)
    specificDate: [
      /(\d{4})-(\d{1,2})-(\d{1,2})/g,
      /(\d{1,2})\/(\d{1,2})\/(\d{4})/g,
      /(\d{4})年(\d{1,2})月(\d{1,2})日/g
    ]
  };

  // 解析今天
  if (timePatterns.today.some(pattern => pattern.test(query))) {
    hasTimeContext = true;
    const todayDate = new Date(referenceDate);
    const startOfDay = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate());
    const endOfDay = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate(), 23, 59, 59);
    timeRanges.push({
      start: startOfDay,
      end: endOfDay,
      description: "今天 | Today",
      isRelativeTime: true
    });
    // 添加今天的各种日期格式作为关键词
    keywords.push(...generateDateKeywords(todayDate));
    keywords.push("今天", "today", "当天");
  }

  // 解析昨天
  if (timePatterns.yesterday.some(pattern => pattern.test(query))) {
    hasTimeContext = true;
    const yesterday = new Date(referenceDate);
    yesterday.setDate(yesterday.getDate() - 1);
    const startOfDay = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
    const endOfDay = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59);
    timeRanges.push({
      start: startOfDay,
      end: endOfDay,
      description: "昨天 | Yesterday",
      isRelativeTime: true
    });
    // 添加昨天的各种日期格式作为关键词
    keywords.push(...generateDateKeywords(yesterday));
    keywords.push("昨天", "yesterday");
  }

  // 解析本周
  if (timePatterns.thisWeek.some(pattern => pattern.test(query))) {
    hasTimeContext = true;
    const startOfWeek = getStartOfWeek(referenceDate);
    const endOfWeek = getEndOfWeek(referenceDate);
    timeRanges.push({
      start: startOfWeek,
      end: endOfWeek,
      description: "本周 | This Week",
      isRelativeTime: true
    });
    keywords.push("本周", "这周", "this week");
  }

  // 解析上周
  if (timePatterns.lastWeek.some(pattern => pattern.test(query))) {
    hasTimeContext = true;
    const lastWeekStart = new Date(referenceDate);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    const startOfLastWeek = getStartOfWeek(lastWeekStart);
    const endOfLastWeek = getEndOfWeek(lastWeekStart);
    timeRanges.push({
      start: startOfLastWeek,
      end: endOfLastWeek,
      description: "上周 | Last Week",
      isRelativeTime: true
    });
    keywords.push("上周", "上个星期", "last week");
  }

  // 解析本月
  if (timePatterns.thisMonth.some(pattern => pattern.test(query))) {
    hasTimeContext = true;
    const startOfMonth = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
    const endOfMonth = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0, 23, 59, 59);
    timeRanges.push({
      start: startOfMonth,
      end: endOfMonth,
      description: "本月 | This Month",
      isRelativeTime: true
    });
    keywords.push("本月", "这个月", "this month");
  }

  // 解析上月
  if (timePatterns.lastMonth.some(pattern => pattern.test(query))) {
    hasTimeContext = true;
    const lastMonth = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - 1, 1);
    const endOfLastMonth = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 0, 23, 59, 59);
    timeRanges.push({
      start: lastMonth,
      end: endOfLastMonth,
      description: "上月 | Last Month",
      isRelativeTime: true
    });
    keywords.push("上月", "上个月", "last month");
  }

  // 解析今年
  if (timePatterns.thisYear.some(pattern => pattern.test(query))) {
    hasTimeContext = true;
    const startOfYear = new Date(referenceDate.getFullYear(), 0, 1);
    const endOfYear = new Date(referenceDate.getFullYear(), 11, 31, 23, 59, 59);
    timeRanges.push({
      start: startOfYear,
      end: endOfYear,
      description: "今年 | This Year",
      isRelativeTime: true
    });
    keywords.push("今年", "this year");
  }

  // 解析去年
  if (timePatterns.lastYear.some(pattern => pattern.test(query))) {
    hasTimeContext = true;
    const lastYear = referenceDate.getFullYear() - 1;
    const startOfLastYear = new Date(lastYear, 0, 1);
    const endOfLastYear = new Date(lastYear, 11, 31, 23, 59, 59);
    timeRanges.push({
      start: startOfLastYear,
      end: endOfLastYear,
      description: "去年 | Last Year",
      isRelativeTime: true
    });
    keywords.push("去年", "last year");
  }

  // 解析去年的今天
  if (timePatterns.lastYearToday.some(pattern => pattern.test(query))) {
    hasTimeContext = true;
    const lastYearToday = new Date(referenceDate.getFullYear() - 1, referenceDate.getMonth(), referenceDate.getDate());
    const startOfDay = new Date(lastYearToday.getFullYear(), lastYearToday.getMonth(), lastYearToday.getDate());
    const endOfDay = new Date(lastYearToday.getFullYear(), lastYearToday.getMonth(), lastYearToday.getDate(), 23, 59, 59);
    timeRanges.push({
      start: startOfDay,
      end: endOfDay,
      description: "去年的今天 | This Day Last Year",
      isRelativeTime: true
    });
    // 添加去年今天的各种日期格式作为关键词
    keywords.push(...generateDateKeywords(lastYearToday));
    keywords.push("去年的今天", "去年今天", "去年同期", "this day last year");
  }

  // 解析具体天数前
  for (const pattern of timePatterns.daysAgo) {
    let match;
    while ((match = pattern.exec(query)) !== null) {
      hasTimeContext = true;
      const daysAgo = parseInt(match[1]);
      const targetDate = new Date(referenceDate);
      targetDate.setDate(targetDate.getDate() - daysAgo);
      const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
      const endOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59);
      timeRanges.push({
        start: startOfDay,
        end: endOfDay,
        description: `${daysAgo}天前 | ${daysAgo} days ago`,
        isRelativeTime: true
      });
      // 添加具体天数前的各种日期格式作为关键词
      keywords.push(...generateDateKeywords(targetDate));
      keywords.push(`${daysAgo}天前`, `${daysAgo} days ago`);
    }
  }

  // 解析具体周数前
  for (const pattern of timePatterns.weeksAgo) {
    let match;
    while ((match = pattern.exec(query)) !== null) {
      hasTimeContext = true;
      const weeksAgo = parseInt(match[1]);
      const targetDate = new Date(referenceDate);
      targetDate.setDate(targetDate.getDate() - (weeksAgo * 7));
      const startOfWeek = getStartOfWeek(targetDate);
      const endOfWeek = getEndOfWeek(targetDate);
      timeRanges.push({
        start: startOfWeek,
        end: endOfWeek,
        description: `${weeksAgo}周前 | ${weeksAgo} weeks ago`,
        isRelativeTime: true
      });
      keywords.push(`${weeksAgo}周前`, `${weeksAgo} weeks ago`);
    }
  }

  // 解析具体月数前
  for (const pattern of timePatterns.monthsAgo) {
    let match;
    while ((match = pattern.exec(query)) !== null) {
      hasTimeContext = true;
      const monthsAgo = parseInt(match[1]);
      const targetDate = new Date(referenceDate);
      targetDate.setMonth(targetDate.getMonth() - monthsAgo);
      const startOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
      const endOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0, 23, 59, 59);
      timeRanges.push({
        start: startOfMonth,
        end: endOfMonth,
        description: `${monthsAgo}个月前 | ${monthsAgo} months ago`,
        isRelativeTime: true
      });
      keywords.push(`${monthsAgo}个月前`, `${monthsAgo} months ago`);
    }
  }

  // 解析具体日期
  for (const pattern of timePatterns.specificDate) {
    let match;
    while ((match = pattern.exec(query)) !== null) {
      hasTimeContext = true;
      let year: number, month: number, day: number;
      
      if (pattern.source.includes('年')) {
        // YYYY年MM月DD日格式
        year = parseInt(match[1]);
        month = parseInt(match[2]) - 1; // JavaScript月份从0开始
        day = parseInt(match[3]);
      } else if (pattern.source.includes('-')) {
        // YYYY-MM-DD格式
        year = parseInt(match[1]);
        month = parseInt(match[2]) - 1;
        day = parseInt(match[3]);
      } else {
        // MM/DD/YYYY格式
        month = parseInt(match[1]) - 1;
        day = parseInt(match[2]);
        year = parseInt(match[3]);
      }
      
      const specificDate = new Date(year, month, day);
      const startOfDay = new Date(year, month, day);
      const endOfDay = new Date(year, month, day, 23, 59, 59);
      
      timeRanges.push({
        start: startOfDay,
        end: endOfDay,
        description: `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        isRelativeTime: false
      });
      keywords.push(match[0]);
    }
  }

  return {
    timeRanges,
    keywords,
    originalQuery: query,
    hasTimeContext
  };
}

/**
 * 获取一周的开始时间（周一）
 */
function getStartOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // 调整到周一
  return new Date(d.setDate(diff));
}

/**
 * 获取一周的结束时间（周日）
 */
function getEndOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? 0 : 7); // 调整到周日
  return new Date(d.setDate(diff));
}

/**
 * 生成时间相关的搜索关键词
 */
export function generateTimeBasedKeywords(timeResult: TimeToolsResult): string[] {
  const allKeywords = [...timeResult.keywords];
  
  // 添加通用时间相关关键词
  if (timeResult.hasTimeContext) {
    allKeywords.push(
      "时间", "time", "日期", "date", 
      "记录", "record", "日志", "log",
      "回忆", "memory", "想起", "recall"
    );
  }
  
  // 确保返回去重后的关键词，并按重要性排序
  // 将具体的日期格式关键词排在前面
  const uniqueKeywords = [...new Set(allKeywords)];
  const dateKeywords = uniqueKeywords.filter(keyword => 
    /\d{4}[-年]\d{1,2}[-月]\d{1,2}日?/.test(keyword) || // 匹配日期格式
    /\d{1,2}[-月]\d{1,2}日?/.test(keyword) ||
    /\d{4}[/.]\d{1,2}[/.]\d{1,2}/.test(keyword)
  );
  const otherKeywords = uniqueKeywords.filter(keyword => !dateKeywords.includes(keyword));
  
  return [...dateKeywords, ...otherKeywords];
}

/**
 * 根据时间范围过滤搜索结果
 */
export function filterResultsByTimeRange(
  results: any[], 
  timeRanges: TimeRange[]
): any[] {
  if (timeRanges.length === 0) {
    return results;
  }
  
  return results.filter(result => {
    // 尝试从不同地方提取时间信息
    let resultDate: Date | null = null;
    
    // 1. 尝试从block.journal中获取时间（日记页面）
    if (result.block?.page?.journal && result.block.page.journalDay) {
      const journalDay = result.block.page.journalDay;
      // journalDay格式通常为YYYYMMDD
      if (/^\d{8}$/.test(journalDay.toString())) {
        const year = Math.floor(journalDay / 10000);
        const month = Math.floor((journalDay % 10000) / 100) - 1; // JavaScript月份从0开始
        const day = journalDay % 100;
        resultDate = new Date(year, month, day);
      }
    }
    
    // 2. 尝试从block.updatedAt获取时间
    if (!resultDate && result.block?.updatedAt) {
      resultDate = new Date(result.block.updatedAt);
    }
    
    // 3. 尝试从block.createdAt获取时间
    if (!resultDate && result.block?.createdAt) {
      resultDate = new Date(result.block.createdAt);
    }
    
    // 4. 尝试从内容中提取时间戳（格式如: 2024-01-15 10:30）
    if (!resultDate && result.block?.content) {
      const timeMatch = result.block.content.match(/(\d{4})-(\d{2})-(\d{2})/);
      if (timeMatch) {
        resultDate = new Date(parseInt(timeMatch[1]), parseInt(timeMatch[2]) - 1, parseInt(timeMatch[3]));
      }
    }
    
    // 如果无法提取时间，保留该结果（避免过度过滤）
    if (!resultDate) {
      return true;
    }
    
    // 检查是否在任何一个时间范围内
    return timeRanges.some(range => {
      // 再次确保resultDate不为null（TypeScript类型检查需要）
      if (!resultDate) {
        return true;
      }
      
      if (range.start && range.end) {
        return resultDate >= range.start && resultDate <= range.end;
      } else if (range.start) {
        return resultDate >= range.start;
      } else if (range.end) {
        return resultDate <= range.end;
      }
      return true;
    });
  });
}

/**
 * 生成时间上下文的总结
 */
export function generateTimeContextSummary(timeResult: TimeToolsResult): string {
  if (!timeResult.hasTimeContext || timeResult.timeRanges.length === 0) {
    return "";
  }
  
  const ranges = timeResult.timeRanges.map(range => range.description).join("、");
  return `🕒 检测到时间相关查询，搜索范围：${ranges}`;
} 