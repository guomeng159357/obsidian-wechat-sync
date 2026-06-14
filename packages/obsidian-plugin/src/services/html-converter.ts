import TurndownService from "turndown";
import { gfm } from "@joplin/turndown-plugin-gfm";

/**
 * HTML 转 Markdown 服务
 */
export class HtmlConverter {
  private turndown: TurndownService;

  constructor() {
    this.turndown = new TurndownService({
      headingStyle: "atx",
      codeBlockStyle: "fenced",
      bulletListMarker: "-",
      emDelimiter: "*",
    });

    // 启用 GFM 扩展（表格、删除线等）
    this.turndown.use(gfm);

    // 自定义规则：清理微信文章追踪参数
    this.turndown.addRule("cleanWechatUrls", {
      filter: (node) => {
        if (node.nodeName === "A") {
          const href = (node as HTMLAnchorElement).getAttribute("href");
          return !!href && (href.includes("mp.weixin.qq.com") || href.includes("?chksm="));
        }
        return false;
      },
      replacement: (content, node) => {
        const anchor = node as HTMLAnchorElement;
        const href = anchor.getAttribute("href") || "";
        const cleanUrl = href.split("?chksm=")[0].split("?scene=")[0];
        const text = content || anchor.textContent || cleanUrl;
        return `[${text}](${cleanUrl})`;
      },
    });

    // 自定义规则：处理图片
    this.turndown.addRule("obsidianImage", {
      filter: "img",
      replacement: (_content, node) => {
        const img = node as HTMLImageElement;
        const src = img.getAttribute("src") || "";
        const alt = img.getAttribute("alt") || "图片";
        return `![${alt}](${src})`;
      },
    });
  }

  /**
   * 将 HTML 转换为 Markdown
   */
  convert(html: string): string {
    if (!html || html.trim().length === 0) return "";

    // 预处理：移除常见的广告/推荐 div
    const cleaned = html
      .replace(/<div[^>]*class="[^"]*reward[^"]*"[^>]*>[\s\S]*?<\/div>/gi, "")
      .replace(/<div[^>]*class="[^"]*ad[^"]*"[^>]*>[\s\S]*?<\/div>/gi, "")
      .replace(/<mp-common-profile[^>]*>[\s\S]*?<\/mp-common-profile>/gi, "")
      .replace(/<div[^>]*id="js_pc_qr_code"[^>]*>[\s\S]*?<\/div>/gi, "");

    return this.turndown.turndown(cleaned);
  }
}
