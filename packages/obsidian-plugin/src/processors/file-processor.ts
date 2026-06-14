import type { InboxRecord, FileContent } from "@obsidian-wechat-sync/shared";
import type { ContentProcessor } from "./base-processor";
import type { VaultWriter } from "../services/vault-writer";
import type { MarkdownBuilder, TemplateVars } from "../services/markdown-builder";
import type { AttachmentCopier } from "../services/attachment-copier";
import { formatDateFolder } from "@obsidian-wechat-sync/shared";

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml", "image/bmp"];

/**
 * 图片/文件内容处理器
 */
export class FileProcessor implements ContentProcessor {
  readonly supportedType = "file";

  constructor(
    private vaultWriter: VaultWriter,
    private markdownBuilder: MarkdownBuilder,
    private attachmentCopier: AttachmentCopier,
    private outputFolder: string,
    private attachmentsFolder: string,
    private defaultTags: string[],
    private template: string
  ) {}

  async process(record: InboxRecord): Promise<string[]> {
    const content = record.content as FileContent;
    const files: string[] = [];

    // 复制文件到 vault
    const dateFolder = formatDateFolder(new Date(record.timestamp));
    const attachFolder = `${this.attachmentsFolder}/${dateFolder}`;
    const vaultAttachmentPath = await this.attachmentCopier.copyToVault(content.sourcePath, attachFolder);
    files.push(vaultAttachmentPath);

    const isImage = IMAGE_TYPES.includes(content.fileType);
    const attachFileName = vaultAttachmentPath.split("/").pop() || content.fileName;

    // 构建正文
    let body = isImage ? `![[${attachFileName}]]` : `[${content.fileName}](${attachFileName})`;
    if (content.description) {
      body += `\n\n${content.description}`;
    }

    const title = content.description || content.fileName;

    const vars: TemplateVars = {
      title,
      date: new Date(record.timestamp).toISOString().slice(0, 10),
      content: body,
      sender: record.source.sender || "",
      tags: this.defaultTags.join(", "),
      fileType: content.fileType,
      fileSize: String(content.fileSize),
      fileName: content.fileName,
    };

    const noteContent = this.markdownBuilder.buildNote(this.template, vars);
    const file = await this.vaultWriter.createDatedNote(
      this.outputFolder,
      title,
      noteContent,
      new Date(record.timestamp)
    );

    files.unshift(file.path);
    return files;
  }
}
