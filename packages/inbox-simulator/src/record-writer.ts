import { writeFile, mkdir, rename, copyFile, stat } from "node:fs/promises";
import { join, dirname, basename } from "node:path";
import { v4 as uuidv4 } from "uuid";
import { formatRecordFileName, TMP_SUFFIX } from "@obsidian-wechat-sync/shared";
import type { InboxRecord } from "@obsidian-wechat-sync/shared";

/**
 * 原子写入收件箱记录
 * 先写 .tmp 再 rename 为 .json，确保 watcher 只看到完整文件
 */
export async function writeRecord(inboxPath: string, record: InboxRecord): Promise<string> {
  const pendingDir = join(inboxPath, "pending");
  await mkdir(pendingDir, { recursive: true });

  const fileName = formatRecordFileName(record.timestamp, record.id);
  const tmpPath = join(pendingDir, `${fileName}${TMP_SUFFIX}`);
  const finalPath = join(pendingDir, fileName);

  const content = JSON.stringify(record, null, 2);
  await writeFile(tmpPath, content, "utf-8");
  await rename(tmpPath, finalPath);

  return finalPath;
}

/**
 * 复制文件到收件箱附件目录
 */
export async function copyAttachment(inboxPath: string, sourceFile: string): Promise<{
  destPath: string;
  fileSize: number;
}> {
  const attachmentsDir = join(inboxPath, "attachments");
  await mkdir(attachmentsDir, { recursive: true });

  const fileName = basename(sourceFile);
  const destPath = join(attachmentsDir, fileName);

  await copyFile(sourceFile, destPath);

  const fileStat = await stat(destPath);

  return { destPath, fileSize: fileStat.size };
}
