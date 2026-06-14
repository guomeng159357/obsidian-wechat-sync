import type { InboxRecord, TextContent } from "@obsidian-wechat-sync/shared";
import type { ContentProcessor } from "./base-processor";
import type { VaultWriter } from "../services/vault-writer";
import type { MarkdownBuilder, TemplateVars } from "../services/markdown-builder";

/**
 * 文字/链接内容处理器
 */
export class TextProcessor implements ContentProcessor {
  readonly supportedType = "text";

  constructor(
    private vaultWriter: VaultWriter,
    private markdownBuilder: MarkdownBuilder,
    private outputFolder: string,
    private defaultTags: string[],
    private template: string
  ) {}

  async process(record: InboxRecord): Promise<string[]> {
    const content = record.content as TextContent;

    const title = this.markdownBuilder.extractTitle(content.text);

    // 构建正文：文字内容 + 链接
    let body = content.text;
    if (content.links && content.links.length > 0) {
      body += "\n\n## 链接\n";
      for (const link of content.links) {
        const linkTitle = link.title || link.url;
        body += `- [${linkTitle}](${link.url})\n`;
      }
    }

    const vars: TemplateVars = {
      title,
      date: new Date(record.timestamp).toISOString().slice(0, 10),
      content: body,
      sender: record.source.sender || "",
      tags: this.defaultTags.join(", "),
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
