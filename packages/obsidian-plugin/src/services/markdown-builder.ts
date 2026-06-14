/**
 * 模板变量
 */
export interface TemplateVars {
  title: string;
  date: string;
  content: string;
  sender: string;
  tags: string;
  url?: string;
  author?: string;
  publishDate?: string;
  fileType?: string;
  fileSize?: string;
  fileName?: string;
}

const DEFAULT_TEMPLATE = `---
date: "{{date}}"
tags: [{{tags}}]
---

# {{title}}

{{content}}`;

/**
 * Markdown 构建器 — 生成带 frontmatter 的 Markdown 笔记
 */
export class MarkdownBuilder {
  /**
   * 渲染模板，替换 {{变量}}
   */
  renderTemplate(template: string, vars: TemplateVars): string {
    let result = template;

    // 用空字符串替换可选变量
    const allVars: Record<string, string> = {
      title: vars.title,
      date: vars.date,
      content: vars.content,
      sender: vars.sender,
      tags: vars.tags,
      url: vars.url || "",
      author: vars.author || "",
      publishDate: vars.publishDate || "",
      fileType: vars.fileType || "",
      fileSize: vars.fileSize || "",
      fileName: vars.fileName || "",
    };

    for (const [key, value] of Object.entries(allVars)) {
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
    }

    // 删除空值行（可选）
    result = result.replace(/^.*\{\{.*\}\}.*$\n?/gm, "");

    return result.trim();
  }

  /**
   * 构建 Markdown 笔记（使用模板）
   */
  buildNote(template: string, vars: TemplateVars): string {
    const tpl = template || DEFAULT_TEMPLATE;
    return this.renderTemplate(tpl, vars);
  }

  /**
   * 从文本中提取标题（取前 N 个字符）
   */
  extractTitle(text: string, maxLen = 50): string {
    const firstLine = text.replace(/\n/g, " ").trim();
    if (firstLine.length <= maxLen) return firstLine;
    return firstLine.slice(0, maxLen) + "...";
  }
}
