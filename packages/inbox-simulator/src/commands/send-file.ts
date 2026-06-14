import { readFile, mkdir } from "node:fs/promises";
import { join, basename, extname } from "node:path";
import type { FileContent, SourceInfo, InboxRecord } from "@obsidian-wechat-sync/shared";
import { writeRecord, copyAttachment } from "../record-writer.js";
import { v4 as uuidv4 } from "uuid";

/** 常见 MIME 类型映射 */
function getMimeType(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  const mimeMap: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".bmp": "image/bmp",
    ".pdf": "application/pdf",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".txt": "text/plain",
    ".md": "text/markdown",
    ".mp3": "audio/mpeg",
    ".mp4": "video/mp4",
    ".mov": "video/quicktime",
    ".zip": "application/zip",
  };
  return mimeMap[ext] || "application/octet-stream";
}

export async function sendFile(
  inboxPath: string,
  filePath: string,
  options: {
    sender?: string;
    description?: string;
  }
): Promise<void> {
  const now = new Date().toISOString();

  // 复制文件到收件箱附件目录
  const { destPath, fileSize } = await copyAttachment(inboxPath, filePath);

  // 构建附件相对路径
  const relativePath = destPath;

  const content: FileContent = {
    fileName: basename(filePath),
    fileType: getMimeType(filePath),
    fileSize,
    sourcePath: relativePath,
    description: options.description,
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
    type: "file",
    timestamp: now,
    source,
    status: "pending",
    content,
  };

  const resultPath = await writeRecord(inboxPath, record);
  console.log(`文件记录已写入: ${resultPath}`);
  console.log(`附件已复制到: ${destPath}`);
}
