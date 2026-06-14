import type { InboxRecord, ArticleContent } from "@obsidian-wechat-sync/shared";
import type { ContentProcessor } from "./base-processor";
import type { VaultWriter } from "../services/vault-writer";
import type { MarkdownBuilder, TemplateVars } from "../services/markdown-builder";
import type { HtmlConverter } from "../services/html-converter";
import type { AttachmentCopier } from "../services/attachment-copier";
import type { ArticleFetcher } from "../services/article-fetcher";
import { formatDateFolder } from "@obsidian-wechat-sync/shared";

/**
 * 公众号文章内容处理器
 */
export class ArticleProcessor implements ContentProcessor {
  readonly supportedType = "article";

  constructor(
    private vaultWriter: VaultWriter,
    private markdownBuilder: MarkdownBuilder,
    private htmlConverter: HtmlConverter,
    private attachmentCopier: AttachmentCopier,
    private articleFetcher: ArticleFetcher,
    private outputFolder: string,
    private attachmentsFolder: string,
    private defaultTags: string[],
    private template: string
  ) {}

  async process(record: InboxRecord): Promise<string[]> {
    const content = record.content as ArticleContent;
    const files: string[] = [];

    let htmlContent = content.htmlContent || "";
    let title = content.title || "";
    let author = content.author || "";
    let publishDate = content.publishDate || "";

    // 没有预抓取内容但有 URL，抓取
    if (!htmlContent && content.url) {
      try {
        const fetched = await this.articleFetcher.fetch(content.url);
        htmlContent = fetched.content;
        title = title || fetched.title;
        author = author || fetched.author;
        publishDate = publishDate || fetched.publishDate;
      } catch (error) {
        console.error("抓取文章失败:", error);
        const errMsg = error instanceof Error ? error.message : String(error);
        return this.createLinkFallback(record, errMsg);
      }
    }

    // HTML 转 Markdown
    let markdown = htmlContent ? this.htmlConverter.convert(htmlContent) : `> 原文链接: [${title || content.url}](${content.url})`;

    // 从 Markdown 中提取远程图片并下载，替换为本地嵌入
    const dateFolder = formatDateFolder(new Date(record.timestamp));
    const imageFolder = `${this.attachmentsFolder}/${dateFolder}`;
    const remoteImages = this.extractMarkdownImages(markdown);

    if (remoteImages.length > 0) {
      const downloads = remoteImages.map(async ({ fullMatch, remoteUrl }) => {
        try {
          const localPath = await this.attachmentCopier.downloadImage(remoteUrl, imageFolder);
          const fileName = localPath.split("/").pop() || "";
          // 替换为 Obsidian 嵌入格式（![[文件名]]）
          markdown = markdown.split(fullMatch).join(`![[${fileName}]]`);
          files.push(localPath);
        } catch (error) {
          console.error(`下载图片失败 ${remoteUrl}:`, error);
        }
      });
      await Promise.all(downloads);
    }

    const vars: TemplateVars = {
      title: title || "未命名文章",
      date: new Date(record.timestamp).toISOString().slice(0, 10),
      content: markdown,
      sender: record.source.sender || "",
      tags: this.defaultTags.join(", "),
      url: content.url,
      author,
      publishDate,
    };

    const noteContent = this.markdownBuilder.buildNote(this.template, vars);
    const file = await this.vaultWriter.createDatedNote(
      this.outputFolder,
      title || "未命名文章",
      noteContent,
      new Date(record.timestamp)
    );

    files.unshift(file.path);
    return files;
  }

  /**
   * 从 Markdown 中提取所有远程图片引用
   */
  private extractMarkdownImages(markdown: string): Array<{ fullMatch: string; remoteUrl: string }> {
    const results: Array<{ fullMatch: string; remoteUrl: string }> = [];
    const imgRe = /!\[([^\]]*)\]\((https?:\/\/[^)]+)\)/g;
    let match;
    while ((match = imgRe.exec(markdown)) !== null) {
      const remoteUrl = match[2];
      // 过滤 SVG 占位图
      if (!remoteUrl.includes("wx_fmt=svg")) {
        results.push({ fullMatch: match[0], remoteUrl });
      }
    }
    return results;
  }

  private async createLinkFallback(record: InboxRecord, errorMsg?: string): Promise<string[]> {
    const content = record.content as ArticleContent;
    const title = content.title || "未命名文章";
    const errorNote = errorMsg ? `\n\n> 错误信息: ${errorMsg}` : "";

    const vars: TemplateVars = {
      title,
      date: new Date().toISOString().slice(0, 10),
      content: `> 原文链接: [${title}](${content.url})\n\n文章内容抓取失败，请手动查看原文。${errorNote}`,
      sender: record.source.sender || "",
      tags: this.defaultTags.join(", "),
      url: content.url,
    };

    const noteContent = this.markdownBuilder.buildNote(this.template, vars);
    const file = await this.vaultWriter.createDatedNote(
      this.outputFolder,
      title,
      noteContent,
      new Date(record.timestamp)
    );

    return [file.path];
  }
}
