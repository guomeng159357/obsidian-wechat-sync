import type { InboxRecord } from "@obsidian-wechat-sync/shared";

/**
 * 内容处理器接口 — 策略模式基类
 */
export interface ContentProcessor {
  /** 支持的内容类型 */
  readonly supportedType: string;
  /** 处理一条记录，返回生成的 vault 文件路径列表 */
  process(record: InboxRecord): Promise<string[]>;
}
