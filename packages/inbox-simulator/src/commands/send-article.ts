import type { ArticleContent, SourceInfo, InboxRecord } from "@obsidian-wechat-sync/shared";
import { writeRecord } from "../record-writer.js";
import { v4 as uuidv4 } from "uuid";

/**
 * 提取指定 ID 的 div 内容，正确处理嵌套
 */
function extractNestedDiv(html: string, targetId: string): string | null {
  const startPattern = new RegExp(`<div[^>]*id="${targetId}"[^>]*>`);
  const startMatch = html.match(startPattern);
  if (!startMatch || startMatch.index === undefined) return null;
  const startPos = startMatch.index + startMatch[0].length;
  let depth = 1;
  let pos = startPos;
  const divOpenRe = /<div[\s>]/gi;
  const divCloseRe = /<\/div>/gi;
  while (depth > 0 && pos < html.length) {
    divOpenRe.lastIndex = pos;
    divCloseRe.lastIndex = pos;
    const openMatch = divOpenRe.exec(html);
    const closeMatch = divCloseRe.exec(html);
    if (!closeMatch) break;
    if (openMatch && openMatch.index < closeMatch.index) {
      depth++;
      pos = html.indexOf(">", openMatch.index) + 1;
    } else {
      depth--;
      if (depth === 0) return html.slice(startPos, closeMatch.index).trim();
      pos = closeMatch.index + closeMatch[0].length;
    }
  }
  return null;
}

/**
 * 抓取文章内容（简化版，用于模拟器）
 */
async function fetchArticle(url: string): Promise<{
  title: string;
  htmlContent: string;
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
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();

    // 提取标题（优先微信 JS 变量）
    let title = "未命名文章";
    const msgTitle = html.match(/var\s+msg_title\s*=\s*'([^']*)'/);
    if (msgTitle) {
      title = msgTitle[1];
    } else {
      const ogTitle = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]*)"/i);
      if (ogTitle) title = ogTitle[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');
      else {
        const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
        if (titleMatch) title = titleMatch[1].trim();
      }
    }

    // 提取作者
    let author = "";
    const authorMatch = html.match(/var\s+nickname\s*=\s*htmlDecode\("([^"]*)"\)/i) || html.match(/nickname\s*=\s*htmlDecode\("([^"]*)"\)/i);
    if (authorMatch) author = authorMatch[1];

    // 提取发布日期
    let publishDate = new Date().toISOString().slice(0, 10);
    const createTime = html.match(/var\s+createTime\s*=\s*'([^']*)'/i);
    if (createTime) {
      const dt = new Date(createTime[1]);
      if (!isNaN(dt.getTime())) publishDate = dt.toISOString().slice(0, 10);
    } else {
      const dateMatch = html.match(/var\s+createTime\s*=\s*'(\d+)'/i);
      if (dateMatch) {
        const ts = parseInt(dateMatch[1], 10) * 1000;
        publishDate = new Date(ts).toISOString().slice(0, 10);
      }
    }

    // 提取正文（正确处理嵌套 div）
    let content = html;
    const wxContent = extractNestedDiv(html, "js_content");
    if (wxContent) {
      content = wxContent;
    } else {
      const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
      if (articleMatch) content = articleMatch[1];
    }

    return { title, htmlContent: content, author, publishDate };
  } catch (error) {
    throw new Error(`抓取文章失败: ${error instanceof Error ? error.message : "未知错误"}`);
  }
}

export async function sendArticle(
  inboxPath: string,
  url: string,
  options: {
    sender?: string;
    tags?: string;
    fetch?: boolean;
  }
): Promise<void> {
  const now = new Date().toISOString();

  let articleData: {
    title: string;
    htmlContent: string;
    author: string;
    publishDate: string;
  } | null = null;

  if (options.fetch !== false) {
    console.log(`正在抓取文章: ${url}`);
    try {
      articleData = await fetchArticle(url);
      console.log(`文章抓取成功: ${articleData.title}`);
    } catch (error) {
      console.warn(`文章抓取失败，仅保存链接: ${error}`);
    }
  }

  const content: ArticleContent = {
    url,
    title: articleData?.title,
    author: articleData?.author,
    publishDate: articleData?.publishDate,
    htmlContent: articleData?.htmlContent,
  };

  const source: SourceInfo = {
    platform: "wechat",
    sender: options.sender,
    chatType: "private",
    receivedAt: now,
  };

  const record: InboxRecord = {
    id: uuidv4(),
    version: "1.0",
    type: "article",
    timestamp: now,
    source,
    status: "pending",
    content,
  };

  const filePath = await writeRecord(inboxPath, record);
  console.log(`文章记录已写入: ${filePath}`);
}
