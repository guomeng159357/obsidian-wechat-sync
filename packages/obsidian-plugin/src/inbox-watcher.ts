import { RECORD_FILE_PATTERN, TMP_SUFFIX } from "@obsidian-wechat-sync/shared";
import type { InboxRecord } from "@obsidian-wechat-sync/shared";
import type { RecordReader } from "./record-reader";
import type { ProcessorRegistry } from "./processors/processor-registry";
import type { ErrorHandler } from "./error-handler";

/**
 * 收件箱文件监听器 — 监听 pending/ 目录的新文件并分发给处理器
 */
export class InboxWatcher {
  private watcher: any = null;
  private pollingTimer: ReturnType<typeof setInterval> | null = null;
  private isProcessing = false;

  constructor(
    private inboxPath: string,
    private recordReader: RecordReader,
    private processorRegistry: ProcessorRegistry,
    private pollingIntervalMs: number,
    private errorHandler: ErrorHandler,
    private onSyncStart?: () => void,
    private onSyncEnd?: () => void
  ) {}

  /**
   * 启动监听（优先使用原生文件监听，不可用时回退到轮询）
   */
  async start(): Promise<void> {
    try {
      const _require = typeof require !== "undefined" ? require : (globalThis as any).require;
      const chokidar = _require("chokidar");

      const pendingDir = `${this.inboxPath}/pending`;

      this.watcher = chokidar.watch(pendingDir, {
        ignored: (path: string) => path.endsWith(TMP_SUFFIX),
        persistent: true,
        ignoreInitial: true,
        depth: 0,
      });

      this.watcher.on("add", (filePath: string) => {
        if (RECORD_FILE_PATTERN.test(filePath.split("/").pop() || "")) {
          this.processRecord(filePath);
        }
      });

      console.log("收件箱文件监听已启动:", pendingDir);
      this.errorHandler.notify("收件箱监听已启动");

      // 启动后扫描已有待处理记录
      await this.scanExisting();
    } catch (e) {
      console.log("文件监听不可用，使用轮询模式:", e);
      this.startPolling();
    }
  }

  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
  }

  private startPolling(): void {
    this.errorHandler.notify("使用轮询模式监听收件箱");
    this.pollingTimer = setInterval(() => {
      this.scanExisting();
    }, this.pollingIntervalMs);
    this.scanExisting();
  }

  /**
   * 扫描 pending/ 目录中的现有记录并处理
   */
  async scanExisting(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      this.onSyncStart?.();
      console.log("扫描待处理记录...");

      const pendingDir = `${this.inboxPath}/pending`;

      // 使用 Node.js fs 列出 pending 目录下的文件
      const _require = typeof require !== "undefined" ? require : (globalThis as any).require;
      const fs = _require("fs");
      const path = _require("path");

      // 确保目录存在
      if (!fs.existsSync(pendingDir)) {
        fs.mkdirSync(pendingDir, { recursive: true });
      }

      const files = fs.readdirSync(pendingDir);
      let processedCount = 0;

      for (const file of files) {
        if (file.endsWith(TMP_SUFFIX)) continue; // 跳过临时文件
        if (!RECORD_FILE_PATTERN.test(file)) continue;

        const filePath = path.join(pendingDir, file);
        await this.processRecord(filePath);
        processedCount++;
      }

      if (processedCount > 0) {
        console.log(`扫描完成: 处理了 ${processedCount} 条记录`);
        this.errorHandler.notify(`同步完成: ${processedCount} 条记录`);
      }
    } catch (error) {
      console.error("扫描收件箱失败:", error);
      this.errorHandler.notify(`扫描失败: ${error instanceof Error ? error.message : "未知错误"}`);
    } finally {
      this.isProcessing = false;
      this.onSyncEnd?.();
    }
  }

  /**
   * 处理单条记录
   */
  async processRecord(filePath: string): Promise<void> {
    try {
      const record = await this.recordReader.readAndValidate(filePath);
      if (!record) {
        console.warn("跳过无效记录:", filePath);
        return;
      }

      // 标记为处理中并移动到 processing 目录
      const processingPath = await this.recordReader.moveToStatus(filePath, record, "processing");

      // 分发给对应处理器
      const files = await this.processorRegistry.process(record);

      // 标记为完成 （使用 processingPath 作为当前文件位置）
      await this.recordReader.moveToStatus(processingPath, record, "done");
      console.log(`记录处理完成: ${record.type} → ${files.join(", ")}`);

      // 通知用户有新笔记
      const typeNames: Record<string, string> = { text: "文字", article: "文章", file: "文件" };
      this.errorHandler.notify(`已同步: ${typeNames[record.type] || record.type}`);
    } catch (error) {
      console.error(`处理记录失败 ${filePath}:`, error);
      this.errorHandler.logError(filePath, error instanceof Error ? error : new Error(String(error)));

      // 尝试标记为失败
      try {
        const failedDir = `${this.inboxPath}/failed`;
        const _require = typeof require !== "undefined" ? require : (globalThis as any).require;
        const fs = _require("fs");
        const path = _require("path");

        if (!fs.existsSync(failedDir)) {
          fs.mkdirSync(failedDir, { recursive: true });
        }

        const fileName = path.basename(filePath);
        const failedPath = path.join(failedDir, fileName);
        if (fs.existsSync(filePath)) {
          fs.renameSync(filePath, failedPath);
        }
      } catch (moveError) {
        console.error("无法移动失败记录:", moveError);
      }
    }
  }

  async syncNow(): Promise<void> {
    await this.scanExisting();
  }
}
