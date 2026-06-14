import { Notice } from "obsidian";

/** 最大重试次数 */
const MAX_RETRIES = 3;

/**
 * 可重试错误类型
 */
function isRetryable(error: Error): boolean {
  const message = error.message.toLowerCase();
  return (
    message.includes("timeout") ||
    message.includes("network") ||
    message.includes("econnrefused") ||
    message.includes("econnreset") ||
    message.includes("etimedout") ||
    message.includes("429") ||
    message.includes("503")
  );
}

/**
 * 统一错误处理器
 */
export class ErrorHandler {
  private errorLog: Array<{ time: string; recordId: string; error: string }> = [];

  /**
   * 处理单条记录的失败
   * @returns 是否应该重试
   */
  shouldRetry(error: Error, retryCount: number): boolean {
    if (retryCount >= MAX_RETRIES) return false;
    return isRetryable(error);
  }

  /**
   * 计算重试延迟（指数退避）
   */
  getRetryDelay(retryCount: number): number {
    return Math.min(1000 * Math.pow(2, retryCount), 30000);
  }

  /**
   * 记录错误
   */
  logError(recordId: string, error: Error): void {
    const entry = {
      time: new Date().toISOString(),
      recordId,
      error: error.message,
    };
    this.errorLog.push(entry);

    // 保留最近 100 条错误
    if (this.errorLog.length > 100) {
      this.errorLog.shift();
    }

    console.error(`[WeChat Sync] 记录 ${recordId} 处理失败:`, error);
  }

  /**
   * 通知用户
   */
  notify(message: string, duration = 5000): void {
    new Notice(`微信同步: ${message}`, duration);
  }

  /**
   * 获取错误日志
   */
  getErrorLog(): ReadonlyArray<{ time: string; recordId: string; error: string }> {
    return this.errorLog;
  }

  /**
   * 清空错误日志
   */
  clearErrorLog(): void {
    this.errorLog = [];
  }
}
