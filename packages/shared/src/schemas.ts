import type { InboxRecord } from "./types";

/** 每种子目录的状态映射 */
export const STATUS_DIR: Record<string, string> = {
  pending: "pending",
  processing: "processing",
  done: "done",
  failed: "failed",
};

/** 待处理的收件箱记录文件名模式 */
export const RECORD_FILE_PATTERN = /^\d{8}T\d{6}-[a-f0-9-]+\.json$/;

/** 临时文件后缀（原子写入） */
export const TMP_SUFFIX = ".tmp";

/**
 * 根据时间戳和 ID 生成收件箱记录文件名
 */
export function formatRecordFileName(timestamp: string, id: string): string {
  const ts = timestamp.replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "T");
  return `${ts}-${id}.json`;
}

/**
 * 生成日期文件夹名，格式 YYYY-MM-DD
 */
export function formatDateFolder(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * 清理文件名中的非法字符（Obsidian 不允许的字符）
 */
export function sanitizeFileName(name: string, maxLen = 100): string {
  let cleaned = name.replace(/[\\/:*?"<>|]/g, "-").replace(/\n/g, " ").trim();
  if (cleaned.length > maxLen) {
    cleaned = cleaned.slice(0, maxLen);
  }
  return cleaned || "未命名";
}

/**
 * 简单的 JSON Schema 校验 — 校验 InboxRecord 的基本结构
 */
export function validateInboxRecord(data: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data || typeof data !== "object") {
    return { valid: false, errors: ["记录必须是对象"] };
  }

  const r = data as Record<string, unknown>;

  if (!r.id || typeof r.id !== "string") errors.push("缺少 id");
  if (r.version !== "1.0") errors.push("version 必须为 1.0");
  if (!["text", "article", "file"].includes(r.type as string)) errors.push("type 无效");
  if (!r.timestamp || typeof r.timestamp !== "string") errors.push("缺少 timestamp");

  if (!r.source || typeof r.source !== "object") {
    errors.push("缺少 source");
  } else {
    const s = r.source as Record<string, unknown>;
    if (s.platform !== "wechat") errors.push("source.platform 必须为 wechat");
    if (!s.receivedAt || typeof s.receivedAt !== "string") errors.push("缺少 source.receivedAt");
  }

  if (!r.content || typeof r.content !== "object") {
    errors.push("缺少 content");
  } else {
    const c = r.content as Record<string, unknown>;
    switch (r.type) {
      case "text":
        if (!c.text || typeof c.text !== "string") errors.push("text 类型缺少 content.text");
        break;
      case "article":
        if (!c.url || typeof c.url !== "string") errors.push("article 类型缺少 content.url");
        break;
      case "file":
        if (!c.fileName || typeof c.fileName !== "string") errors.push("file 类型缺少 content.fileName");
        if (!c.sourcePath || typeof c.sourcePath !== "string") errors.push("file 类型缺少 content.sourcePath");
        break;
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * 类型守卫：检查 InboxRecord 的具体内容类型
 */
export function isTextContent(r: InboxRecord): r is InboxRecord & { content: import("./types").TextContent } {
  return r.type === "text";
}

export function isArticleContent(r: InboxRecord): r is InboxRecord & { content: import("./types").ArticleContent } {
  return r.type === "article";
}

export function isFileContent(r: InboxRecord): r is InboxRecord & { content: import("./types").FileContent } {
  return r.type === "file";
}
