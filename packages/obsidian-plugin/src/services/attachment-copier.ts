import { requestUrl, type Vault } from "obsidian";
import { normalizePath } from "obsidian";
import { sanitizeFileName } from "@obsidian-wechat-sync/shared";

/**
 * 附件复制服务 — 将外部文件复制到 vault 附件目录
 */
export class AttachmentCopier {
  constructor(private vault: Vault) {}

  /**
   * 将本地文件复制到 vault
   * 返回 vault 内的相对路径
   */
  async copyToVault(sourcePath: string, attachmentsFolder: string): Promise<string> {
    const fileName = sourcePath.split("/").pop() || "attachment";
    const safeName = sanitizeFileName(fileName);

    // 读取源文件
    const data = await this.vault.adapter.readBinary(sourcePath);

    // 写入 vault
    const folderPath = normalizePath(attachmentsFolder);
    await this.ensureFolder(folderPath);

    let finalPath = normalizePath(`${folderPath}/${safeName}`);
    if (await this.vault.adapter.exists(finalPath)) {
      const ext = safeName.includes(".") ? safeName.slice(safeName.lastIndexOf(".")) : "";
      const base = safeName.slice(0, safeName.lastIndexOf("."));
      let counter = 1;
      let altPath: string;
      do {
        altPath = normalizePath(`${folderPath}/${base} (${counter})${ext}`);
        counter++;
      } while (await this.vault.adapter.exists(altPath));
      finalPath = altPath;
    }

    await this.vault.createBinary(finalPath, data);
    return finalPath;
  }

  /**
   * 下载远程图片到 vault
   */
  async downloadImage(url: string, attachmentsFolder: string): Promise<string> {
    const response = await requestUrl({ url });
    const contentType = response.headers["content-type"] || "image/png";
    const ext = contentType.split("/").pop() || "png";

    // 基于 URL hash 生成文件名
    const hash = this.shortHash(url);
    const fileName = `img-${hash}.${ext}`;

    const folderPath = normalizePath(attachmentsFolder);
    await this.ensureFolder(folderPath);

    const finalPath = normalizePath(`${folderPath}/${fileName}`);
    if (!(await this.vault.adapter.exists(finalPath))) {
      await this.vault.createBinary(finalPath, response.arrayBuffer);
    }

    return finalPath;
  }

  private async ensureFolder(folderPath: string): Promise<void> {
    const normalized = normalizePath(folderPath);
    const parts = normalized.split("/");
    let current = "";
    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      const exists = await this.vault.adapter.exists(current);
      if (!exists) {
        await this.vault.createFolder(current);
      }
    }
  }

  private shortHash(input: string): string {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const chr = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + chr;
      hash |= 0;
    }
    return Math.abs(hash).toString(16).slice(0, 8).padStart(8, "0");
  }
}
