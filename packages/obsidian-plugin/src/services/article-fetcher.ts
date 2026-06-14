import { requestUrl } from "obsidian";

/**
 * 文章抓取服务 — 从 URL 抓取文章内容
 * 使用 Obsidian 的 requestUrl API（兼容 Electron 环境）
 */
export class ArticleFetcher {
  /**
   * 抓取文章内容
   */
  async fetch(url: string): Promise<{
    title: string;
    content: string;
    author: string;
    publishDate: string;
  }> {
    const response = await requestUrl({
      url,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    if (response.status < 200 || response.status >= 300) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = response.text;

    const title = this.extractTitle(html);
    const author = this.extractAuthor(html);
    const publishDate = this.extractPublishDate(html);
    const content = this.extractContent(html);

    if (!content || content.trim().length === 0) {
      throw new Error("未能从页面中提取到文章正文");
    }

    return { title, content, author, publishDate };
  }

  private extractTitle(html: string): string {
    // 微信公众号 JS 变量（最可靠）
    const msgTitle = html.match(/var\s+msg_title\s*=\s*'([^']*)'/);
    if (msgTitle) return this.decodeHtml(msgTitle[1]);

    // og:title
    let match = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]*)"/i);
    if (match) return this.decodeHtml(match[1]);

    // <title>
    match = html.match(/<title>([^<]*)<\/title>/i);
    if (match) return match[1].trim();

    // <h1>
    match = html.match(/<h1[^>]*>([^<]*)<\/h1>/i);
    if (match) return match[1].trim();

    return "未命名文章";
  }

  private extractAuthor(html: string): string {
    // 微信公众号 JS 变量（最可靠）
    const wxNick = html.match(/var\s+nickname\s*=\s*htmlDecode\("([^"]*)"\)/i)
      || html.match(/nickname\s*=\s*htmlDecode\("([^"]*)"\)/i);
    if (wxNick) return wxNick[1];

    // article:author meta
    const match = html.match(/<meta[^>]+property="article:author"[^>]+content="([^"]*)"/i);
    if (match) return this.decodeHtml(match[1]);

    return "";
  }

  private extractPublishDate(html: string): string {
    // 微信公众号 JS 变量（最可靠）
    const wxTime = html.match(/var\s+createTime\s*=\s*'([^']*)'/i)
      || html.match(/createTime\s*=\s*'([^']*)'/i);
    if (wxTime) {
      // 格式: "2026-06-10 20:37"
      const dt = new Date(wxTime[1]);
      if (!isNaN(dt.getTime())) return dt.toISOString();
    }

    // createTimestamp (Unix 秒)
    const wxTs = html.match(/var\s+createTimestamp\s*=\s*'(\d+)'/i);
    if (wxTs) {
      const ts = parseInt(wxTs[1], 10) * 1000;
      return new Date(ts).toISOString();
    }

    // article:published_time meta
    const match = html.match(/<meta[^>]+property="article:published_time"[^>]+content="([^"]*)"/i);
    if (match) return match[1];

    return new Date().toISOString().slice(0, 10);
  }

  /**
   * 提取文章正文
   * 处理嵌套 div —— 不能简单用正则，需要追踪嵌套深度
   */
  private extractContent(html: string): string {
    // 微信公众号文章：js_content div（内容在 HTML 源码中但被 CSS 隐藏）
    const jsContent = this.extractNestedDiv(html, "js_content");
    if (jsContent) return jsContent;

    // 通用：article 标签
    const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
    if (articleMatch) return articleMatch[1].trim();

    // 最后退路：body
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (bodyMatch) return bodyMatch[1].trim();

    return html;
  }

  /**
   * 提取指定 ID 的 div 内容，正确处理嵌套
   */
  private extractNestedDiv(html: string, targetId: string): string | null {
    // 找到目标 div 的开始位置
    const startPattern = new RegExp(`<div[^>]*id="${targetId}"[^>]*>`);
    const startMatch = html.match(startPattern);
    if (!startMatch || startMatch.index === undefined) return null;

    const startPos = startMatch.index + startMatch[0].length;

    // 从起始位置追踪嵌套深度，找到匹配的 </div>
    let depth = 1;
    let pos = startPos;
    const divOpenRe = /<div[\s>]/gi;
    const divCloseRe = /<\/div>/gi;

    while (depth > 0 && pos < html.length) {
      divOpenRe.lastIndex = pos;
      divCloseRe.lastIndex = pos;

      const openMatch = divOpenRe.exec(html);
      const closeMatch = divCloseRe.exec(html);

      if (!closeMatch) {
        // 没有更多闭合标签，返回已找到的内容
        break;
      }

      if (openMatch && openMatch.index < closeMatch.index) {
        depth++;
        pos = openMatch.index + openMatch[0].length;
        // 跳过已匹配的 <div...>
        pos = html.indexOf(">", openMatch.index) + 1;
      } else {
        depth--;
        if (depth === 0) {
          return html.slice(startPos, closeMatch.index).trim();
        }
        pos = closeMatch.index + closeMatch[0].length;
      }
    }

    return null;
  }

  private decodeHtml(text: string): string {
    return text
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }
}
