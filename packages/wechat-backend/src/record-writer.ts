import { writeFile, mkdir, rename } from "node:fs/promises";
import { join } from "node:path";
import { formatRecordFileName, TMP_SUFFIX } from "@obsidian-wechat-sync/shared";
import type { InboxRecord } from "@obsidian-wechat-sync/shared";

/**
 * 原子写入收件箱记录（与 inbox-simulator 使用相同协议）
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
