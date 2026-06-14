import { Plugin } from "obsidian";
import type { WechatSyncSettings } from "@obsidian-wechat-sync/shared";
import { WechatSyncSettingTab } from "./settings";
import { VaultWriter } from "./services/vault-writer";
import { MarkdownBuilder } from "./services/markdown-builder";
import { HtmlConverter } from "./services/html-converter";
import { AttachmentCopier } from "./services/attachment-copier";
import { ArticleFetcher } from "./services/article-fetcher";
import { RecordReader } from "./record-reader";
import { InboxWatcher } from "./inbox-watcher";
import { ProcessorRegistry } from "./processors/processor-registry";
import { TextProcessor } from "./processors/text-processor";
import { ArticleProcessor } from "./processors/article-processor";
import { FileProcessor } from "./processors/file-processor";
import { ErrorHandler } from "./error-handler";

const DEFAULT_TEXT_TEMPLATE = `---
date: "{{date}}"
tags: [{{tags}}]
sender: "{{sender}}"
---

# {{title}}

{{content}}`;

const DEFAULT_ARTICLE_TEMPLATE = `---
date: "{{date}}"
tags: [{{tags}}]
author: "{{author}}"
originalUrl: "{{url}}"
publishDate: "{{publishDate}}"
---

# {{title}}

{{content}}`;

const DEFAULT_FILE_TEMPLATE = `---
date: "{{date}}"
tags: [{{tags}}]
fileType: "{{fileType}}"
fileSize: {{fileSize}}
---

# {{title}}

{{content}}`;

const DEFAULT_SETTINGS: WechatSyncSettings = {
  inboxPath: "",
  outputFolder: "WeChat",
  attachmentsFolder: "WeChat/attachments",
  pollingIntervalMs: 5000,
  autoArchive: true,
  autoSyncEnabled: false,
  autoSyncIntervalMs: 60000,
  templateText: DEFAULT_TEXT_TEMPLATE,
  templateArticle: DEFAULT_ARTICLE_TEMPLATE,
  templateFile: DEFAULT_FILE_TEMPLATE,
  defaultTags: ["wechat"],
};

export default class WechatSyncPlugin extends Plugin {
  settings: WechatSyncSettings = DEFAULT_SETTINGS;
  private inboxWatcher: InboxWatcher | null = null;
  private errorHandler: ErrorHandler = new ErrorHandler();
  private statusBarEl: HTMLElement | null = null;
  private autoSyncTimer: ReturnType<typeof setInterval> | null = null;

  async onload(): Promise<void> {
    await this.loadSettings();

    // 状态栏
    this.statusBarEl = this.addStatusBarItem();
    this.statusBarEl.addClass("wechat-sync-status-bar");
    this.statusBarEl.addClass("idle");
    this.statusBarEl.setText(this.getStatusText());
    this.statusBarEl.onClickEvent(() => {
      this.syncNow();
    });

    // 命令
    this.addCommand({
      id: "sync-now",
      name: "立即同步收件箱",
      callback: () => this.syncNow(),
    });

    // 设置面板
    this.addSettingTab(new WechatSyncSettingTab(this.app, this));

    // 启动收件箱监听
    if (this.settings.inboxPath) {
      this.startWatcher();
    }

    // 如果之前开启了自动同步，恢复定时器
    if (this.settings.autoSyncEnabled && this.settings.inboxPath) {
      this.startAutoSync();
    }

    this.errorHandler.notify("微信内容同步助手已加载");
  }

  private getStatusText(): string {
    return this.settings.autoSyncEnabled ? "微信同步: 自动" : "微信同步: 就绪";
  }

  private startWatcher(): void {
    if (!this.settings.inboxPath) return;

    const recordReader = new RecordReader(this.settings.inboxPath);

    const vaultWriter = new VaultWriter(this.app.vault);
    const markdownBuilder = new MarkdownBuilder();
    const htmlConverter = new HtmlConverter();
    const attachmentCopier = new AttachmentCopier(this.app.vault);
    const articleFetcher = new ArticleFetcher();

    const processorRegistry = new ProcessorRegistry();
    processorRegistry.register(
      new TextProcessor(vaultWriter, markdownBuilder, this.settings.outputFolder, this.settings.defaultTags, this.settings.templateText)
    );
    processorRegistry.register(
      new ArticleProcessor(
        vaultWriter, markdownBuilder, htmlConverter, attachmentCopier, articleFetcher,
        this.settings.outputFolder, this.settings.attachmentsFolder, this.settings.defaultTags, this.settings.templateArticle
      )
    );
    processorRegistry.register(
      new FileProcessor(
        vaultWriter, markdownBuilder, attachmentCopier,
        this.settings.outputFolder, this.settings.attachmentsFolder, this.settings.defaultTags, this.settings.templateFile
      )
    );

    this.inboxWatcher = new InboxWatcher(
      this.settings.inboxPath,
      recordReader,
      processorRegistry,
      this.settings.pollingIntervalMs,
      this.errorHandler,
      () => this.setStatus("syncing", "微信同步: 同步中..."),
      () => this.setStatus("idle", this.getStatusText())
    );

    this.inboxWatcher.start();
  }

  /** 设置面板中更改了自动同步相关选项后调用 */
  onAutoSyncChanged(): void {
    this.stopAutoSync();
    if (this.settings.autoSyncEnabled && this.settings.inboxPath) {
      this.startAutoSync();
    }
    this.setStatus("idle", this.getStatusText());
  }

  private startAutoSync(): void {
    if (this.autoSyncTimer) return;
    this.autoSyncTimer = setInterval(() => {
      this.syncNow();
    }, this.settings.autoSyncIntervalMs);
    console.log(`自动同步已启动，间隔 ${this.settings.autoSyncIntervalMs / 1000} 秒`);
  }

  private stopAutoSync(): void {
    if (this.autoSyncTimer) {
      clearInterval(this.autoSyncTimer);
      this.autoSyncTimer = null;
      console.log("自动同步已停止");
    }
  }

  private setStatus(cls: string, text: string): void {
    if (this.statusBarEl) {
      this.statusBarEl.removeClass("idle", "syncing", "error");
      this.statusBarEl.addClass(cls);
      this.statusBarEl.setText(text);
    }
  }

  async syncNow(): Promise<void> {
    if (!this.settings.inboxPath) {
      this.errorHandler.notify("请先在设置中配置收件箱路径");
      return;
    }
    if (this.inboxWatcher) {
      await this.inboxWatcher.syncNow();
    }
  }

  async loadSettings(): Promise<void> {
    const data = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  onunload(): void {
    this.inboxWatcher?.stop();
    this.stopAutoSync();
  }
}
