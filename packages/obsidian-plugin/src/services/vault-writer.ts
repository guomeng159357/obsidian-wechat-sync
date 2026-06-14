import { normalizePath, type Vault, type TFile } from "obsidian";
import { formatDateFolder, sanitizeFileName } from "@obsidian-wechat-sync/shared";

/**
 * Vault 写入服务 — 封装所有 Obsidian vault 文件操作
 */
export class VaultWriter {
  constructor(private vault: Vault) {}

  /**
   * 确保 vault 内目录存在（递归创建）
   */
  async ensureFolder(folderPath: string): Promise<void> {
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

  /**
   * 创建 Markdown 笔记
   */
  async createNote(folder: string, fileName: string, content: string): Promise<TFile> {
    const folderPath = normalizePath(folder);
    await this.ensureFolder(folderPath);

    const safeName = sanitizeFileName(fileName);
    let finalPath = normalizePath(`${folderPath}/${safeName}.md`);

    // 处理重名：追加序号
    if (await this.vault.adapter.exists(finalPath)) {
      let counter = 1;
      let altPath: string;
      do {
        altPath = normalizePath(`${folderPath}/${safeName} (${counter}).md`);
        counter++;
      } while (await this.vault.adapter.exists(altPath));
      finalPath = altPath;
    }

    return this.vault.create(finalPath, content);
  }

  /**
   * 创建二进制文件（图片、附件等）
   */
  async createBinaryFile(folder: string, fileName: string, data: ArrayBuffer): Promise<TFile> {
    const folderPath = normalizePath(folder);
    await this.ensureFolder(folderPath);

    const safeName = sanitizeFileName(fileName);
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

    return this.vault.createBinary(finalPath, data);
  }

  /**
   * 按日期文件夹写入笔记（输出到 outputFolder/YYYY-MM-DD/ 下）
   */
  async createDatedNote(
    outputFolder: string,
    fileName: string,
    content: string,
    date: Date = new Date()
  ): Promise<TFile> {
    const datedFolder = normalizePath(`${outputFolder}/${formatDateFolder(date)}`);
    return this.createNote(datedFolder, fileName, content);
  }
}
