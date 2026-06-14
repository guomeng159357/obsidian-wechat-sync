import type { TextContent, SourceInfo, InboxRecord } from "@obsidian-wechat-sync/shared";
import { writeRecord } from "../record-writer.js";
import { v4 as uuidv4 } from "uuid";

/** 从文本中提取 URL */
function extractUrls(text: string): Array<{ url: string; title?: string }> {
  const urlRegex = /https?:\/\/[^\s]+/g;
  const matches = text.match(urlRegex);
  if (!matches) return [];
  return matches.map((url) => ({ url }));
}

export async function sendText(
  inboxPath: string,
  text: string,
  options: {
    sender?: string;
    tags?: string;
  }
): Promise<void> {
  const links = extractUrls(text);
  const now = new Date().toISOString();

  const content: TextContent = {
    text,
    links: links.length > 0 ? links : undefined,
  };

  const source: SourceInfo = {
    platform: "wechat",
    sender: options.sender,
    chatType: "private",
    receivedAt: now,
  };

  const record: InboxRecord = {
    id: uuidv4(),
    version: "1.0",
    type: "text",
    timestamp: now,
    source,
    status: "pending",
    content,
  };

  const filePath = await writeRecord(inboxPath, record);
  console.log(`文字记录已写入: ${filePath}`);
}
