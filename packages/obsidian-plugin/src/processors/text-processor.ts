import type { InboxRecord, TextContent } from "@obsidian-wechat-sync/shared";
import type { ContentProcessor } from "./base-processor";
import type { VaultWriter } from "../services/vault-writer";
import type { MarkdownBuilder, TemplateVars } from "../services/markdown-builder";

/** 中文数字（一到九十九） */
const CN_NUMS = "一二三四五六七八九十";
const CN_NUM_RE = new RegExp(
  `^(?:[${CN_NUMS}]+|[${CN_NUMS}]十[${CN_NUMS}]?|十[${CN_NUMS}]?|[${CN_NUMS}]十)`
);

/** 各类序号正则 */
const HEADING_PATTERNS = [
  // 一、xxx  二、xxx  十一、xxx
  new RegExp(`^(${CN_NUM_RE.source})[、，,.。]\\s*(.+)`),
  // 第一、xxx  第二，xxx  第三.xxx
  /^(第[一二三四五六七八九十\d]+)[、，,.。\s]+(.+)/,
  // 1. xxx  2. xxx  3. xxx → Markdown 有序列表
  /^(\d+)[.、，,]\s+(.+)/,
  // 1）xxx  2）xxx → Markdown 有序列表
  /^(\d+)[）)]\s*(.+)/,
];

/** 微信文章转载时混入的元数据关键词行 */
const NOISE_RE = /^(原创|付费|星标|关注|分享|点赞|在看|阅读|赞|赞赏|喜欢|收藏|转发|举报|投诉|取消|发送|消息|发布|置顶|设为星标|作者|声明|版权所有|本文|轻触阅读|关闭|继续阅读|VIP|会员|付费阅读|解锁|剩余|试读|来自|发表于|修改于|阅读全文|微信扫一扫|关注该公众号|收录于合集)\s*$/;

/** 微信文章元数据格式：如 "2026年6月2日 15:49" "TechPM" 等 */
const META_DATE_RE = /^\d{4}年\d{1,2}月\d{1,2}日\s*\d{1,2}:\d{2}/;
const META_LOCATION_RE = /^[^\s]{1,6}\s*\d+人?$/;

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

    const formatted = this.formatText(content.text);
    const title = this.extractCleanTitle(formatted);

    let body = formatted;
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

  /**
   * 将文本转为 Markdown 格式：
   * - 中文序号（一、第一、第1）→ ## 二级标题
   * - 阿拉伯数字序号（1. 1、1）→ Markdown 有序列表
   * - 自然段首行缩进（两个全角空格）
   * - 过滤微信转载元数据行
   */
  private formatText(text: string): string {
    const lines = text.split("\n");
    const result: string[] = [];
    let prevEmpty = false;

    for (const rawLine of lines) {
      const line = rawLine.trim();

      // 跳过微信噪音行和元数据
      if (this.isNoiseLine(line)) continue;

      // 空行：保留一个
      if (line === "") {
        if (!prevEmpty && result.length > 0) {
          result.push("");
          prevEmpty = true;
        }
        continue;
      }
      prevEmpty = false;

      // 尝试匹配各类序号 → 二级标题
      const heading = this.toHeading(line);
      if (heading) {
        result.push(heading);
        continue;
      }

      // 普通段落：首行缩进
      result.push(`　　${line}`);
    }

    return result.join("\n").trim();
  }

  /** 判断是否为需要过滤的噪音行 */
  private isNoiseLine(line: string): boolean {
    if (!line) return false;
    if (NOISE_RE.test(line)) return true;
    if (/^\d+人?$/.test(line)) return true;
    if (META_DATE_RE.test(line)) return true;
    if (META_LOCATION_RE.test(line)) return true;
    // "TechPM"、"TechPM工具箱" 这类作者/公众号名（2-20个英文字母/数字，不含空格和中文字）
    if (/^[A-Za-z0-9_\-\s]{2,20}$/.test(line) && !/[一-鿿]/.test(line)) return true;
    return false;
  }

  /** 将序号行转为 Markdown 标题或列表 */
  private toHeading(line: string): string | null {
    // 一、xxx / 二、xxx / 十一、xxx → ## 标题
    const cnMatch = line.match(
      new RegExp(`^(${CN_NUM_RE.source})[、，,.。]\\s*(.+)`)
    );
    if (cnMatch) {
      return `## ${cnMatch[1]}、${cnMatch[2]}`;
    }

    // 第一 xxx / 第2、xxx → ## 标题
    const diMatch = line.match(/^(第[一二三四五六七八九十\d]+)[、，,.。\s]+(.+)/);
    if (diMatch) {
      return `## ${diMatch[1]}、${diMatch[2]}`;
    }

    // 1. xxx / 2、xxx → Markdown 有序列表
    const numMatch = line.match(/^(\d+)[.、，,]\s+(.+)/);
    if (numMatch) {
      return `${numMatch[1]}. ${numMatch[2]}`;
    }

    // 第1）xxx / 第2) xxx → ## 标题
    const diParenMatch = line.match(/^(第[一二三四五六七八九十\d]+)[）)]\s*(.+)/);
    if (diParenMatch) {
      return `## ${diParenMatch[1]}、${diParenMatch[2]}`;
    }

    // 1）xxx / 2) xxx → Markdown 有序列表
    const parenMatch = line.match(/^(\d+)[）)]\s*(.+)/);
    if (parenMatch) {
      return `${parenMatch[1]}. ${parenMatch[2]}`;
    }

    return null;
  }

  /** 从格式化后的文本中提取干净的标题 */
  private extractCleanTitle(text: string): string {
    const lines = text.split("\n");

    // 优先从第一个 ## 标题中提取
    for (const line of lines) {
      const hMatch = line.match(/^##\s+(.+)/);
      if (hMatch) {
        // 去掉中文数字序号前缀（一、、第一、、1. 等），取后面的内容
        const title = hMatch[1].replace(/^(?:[一二三四五六七八九十]+|第[一二三四五六七八九十\d]+|\d+)[、，,.。)）]\s*/, "");
        if (title && title.length > 1) {
          return title.length <= 60 ? title : title.slice(0, 57) + "...";
        }
      }
    }

    // 无标题时，取第一个非空、非缩进、非列表行
    for (const line of lines) {
      const cleaned = line.replace(/^(#+\s*|　　|\d+\.\s+)/, "").trim();
      if (cleaned && cleaned.length > 2) {
        return cleaned.length <= 60 ? cleaned : cleaned.slice(0, 57) + "...";
      }
    }
    return "未命名笔记";
  }
}
