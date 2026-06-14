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
        return this.createLinkFallback(record);
      }
    }

    // HTML 转 Markdown
    let markdown = htmlContent ? this.htmlConverter.convert(htmlContent) : `> 原文链接: [${title || content.url}](${content.url})`;

    // 下载文章内图片
    if (content.images && content.images.length > 0) {
      const dateFolder = formatDateFolder(new Date(record.timestamp));
      const imageFolder = `${this.attachmentsFolder}/${dateFolder}`;
      for (const img of content.images) {
        try {
          const localPath = await this.attachmentCopier.downloadImage(img.originalUrl, imageFolder);
          const fileName = localPath.split("/").pop() || "";
          markdown = markdown.replace(
            new RegExp(`!\\[.*?\\]\\(${this.escapeRegex(img.originalUrl)}\\)`, "g"),
            `![[${fileName}]]`
          );
          files.push(localPath);
        } catch (error) {
          console.error(`下载图片失败 ${img.originalUrl}:`, error);
        }
      }
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

  private async createLinkFallback(record: InboxRecord): Promise<string[]> {
    const content = record.content as ArticleContent;
    const title = content.title || "未命名文章";

    const vars: TemplateVars = {
      title,
      date: new Date().toISOString().slice(0, 10),
      content: `> 原文链接: [${title}](${content.url})\n\n文章内容抓取失败，请手动查看原文。`,
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

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
}
