import type { InboxRecord } from "@obsidian-wechat-sync/shared";
import type { ContentProcessor } from "./base-processor";

/**
 * 处理器注册表 — 管理和路由内容处理器
 */
export class ProcessorRegistry {
  private processors = new Map<string, ContentProcessor>();

  /** 注册处理器 */
  register(processor: ContentProcessor): void {
    this.processors.set(processor.supportedType, processor);
  }

  /** 获取处理器 */
  getProcessor(type: string): ContentProcessor | undefined {
    return this.processors.get(type);
  }

  /** 处理记录，自动路由到对应处理器 */
  async process(record: InboxRecord): Promise<string[]> {
    const processor = this.getProcessor(record.type);
    if (!processor) {
      throw new Error(`不支持的内容类型: ${record.type}`);
    }
    return processor.process(record);
  }
}
