/**
 * 文章抓取服务 — 从 URL 抓取文章内容
 * 使用 Obsidian 的 requestUrl API
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
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();

      // 提取标题
      const title = this.extractTitle(html);

      // 提取作者
      const author = this.extractAuthor(html);

      // 提取发布日期
      const publishDate = this.extractPublishDate(html);

      // 提取正文
      const content = this.extractContent(html);

      return { title, content, author, publishDate };
    } catch (error) {
      throw new Error(`抓取文章失败: ${error instanceof Error ? error.message : "未知错误"}`);
    }
  }

  private extractTitle(html: string): string {
    // 尝试 og:title
    let match = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]*)"/i);
    if (match) return this.decodeHtml(match[1]);

    // 尝试 <title>
    match = html.match(/<title>([^<]*)<\/title>/i);
    if (match) return match[1].trim();

    // 尝试 <h1>
    match = html.match(/<h1[^>]*>([^<]*)<\/h1>/i);
    if (match) return match[1].trim();

    return "未命名文章";
  }

  private extractAuthor(html: string): string {
    const match = html.match(/<meta[^>]+property="article:author"[^>]+content="([^"]*)"/i);
    if (match) return this.decodeHtml(match[1]);

    const wxMatch = html.match(/var\s+nickname\s*=\s*"([^"]*)"/i) || html.match(/nickname\s*=\s*"([^"]*)"/i);
    if (wxMatch) return wxMatch[1];

    return "";
  }

  private extractPublishDate(html: string): string {
    const match = html.match(/<meta[^>]+property="article:published_time"[^>]+content="([^"]*)"/i);
    if (match) return match[1];

    const wxMatch = html.match(/var\s+createTime\s*=\s*'(\d+)'/i) || html.match(/createTime\s*=\s*'(\d+)'/i);
    if (wxMatch) {
      const ts = parseInt(wxMatch[1], 10) * 1000;
      return new Date(ts).toISOString();
    }

    return new Date().toISOString().slice(0, 10);
  }

  private extractContent(html: string): string {
    // 微信公众号文章：提取 js_content 中的内容
    const wxMatch = html.match(/<div[^>]*id="js_content"[^>]*>([\s\S]*?)<\/div>/i);
    if (wxMatch) {
      return wxMatch[1].trim();
    }

    // 通用：提取 article/body 内容
    const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
    if (articleMatch) {
      return articleMatch[1].trim();
    }

    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (bodyMatch) {
      return bodyMatch[1].trim();
    }

    return html;
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
