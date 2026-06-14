import { type InboxRecord, type RecordStatus, validateInboxRecord, formatRecordFileName } from "@obsidian-wechat-sync/shared";

/**
 * 记录读取器 — 使用 Node.js fs 直接操作收件箱文件
 */
export class RecordReader {
  private fs: any;
  private path: any;

  constructor(private inboxPath: string) {
    const _require = typeof require !== "undefined" ? require : (globalThis as any).require;
    this.fs = _require("fs");
    this.path = _require("path");
  }

  /**
   * 读取并校验一个 JSON 记录文件
   */
  async readAndValidate(filePath: string): Promise<InboxRecord | null> {
    try {
      if (!this.fs.existsSync(filePath)) {
        console.warn("记录文件不存在:", filePath);
        return null;
      }
      const raw = this.fs.readFileSync(filePath, "utf-8");
      const data = JSON.parse(raw);

      const result = validateInboxRecord(data);
      if (!result.valid) {
        console.error(`记录校验失败 ${filePath}: ${result.errors.join(", ")}`);
        return null;
      }

      return data as InboxRecord;
    } catch (error) {
      console.error(`读取记录失败 ${filePath}:`, error);
      return null;
    }
  }

  /**
   * 将记录移动到指定状态的子目录，返回新的文件路径
   */
  async moveToStatus(filePath: string, record: InboxRecord, status: RecordStatus, error?: string): Promise<string> {
    const statusDir = this.path.join(this.inboxPath, status);
    const fileName = formatRecordFileName(record.timestamp, record.id);
    const destPath = this.path.join(statusDir, fileName);

    // 确保目标目录存在
    if (!this.fs.existsSync(statusDir)) {
      this.fs.mkdirSync(statusDir, { recursive: true });
    }

    // 更新记录状态
    record.status = status;
    if (status === "done") {
      record.processedAt = new Date().toISOString();
    } else if (status === "failed") {
      record.error = error;
      record.retryCount = (record.retryCount || 0) + 1;
    }

    // 写入目标文件
    const content = JSON.stringify(record, null, 2);
    this.fs.writeFileSync(destPath, content, "utf-8");

    // 删除源文件（如果还存在且与目标不同）
    if (this.fs.existsSync(filePath) && this.path.resolve(filePath) !== this.path.resolve(destPath)) {
      this.fs.unlinkSync(filePath);
    }

    return destPath;
  }
}
