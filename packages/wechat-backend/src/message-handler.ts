import { parseStringPromise } from "xml2js";
import type { InboxRecord, SourceInfo } from "@obsidian-wechat-sync/shared";
import { writeRecord } from "./record-writer.js";

/** 解析后的微信消息 */
interface WeChatMessage {
  ToUserName: string;
  FromUserName: string;
  CreateTime: string;
  MsgType: string;
  Content?: string;   // 文本消息
  PicUrl?: string;     // 图片消息
  MediaId?: string;    // 媒体 ID
  Format?: string;     // 语音格式
  Recognition?: string; // 语音识别结果
  Title?: string;      // 链接标题
  Description?: string; // 链接描述
  Url?: string;        // 链接 URL
}

/**
 * 处理微信消息并写入收件箱
 * 返回给用户的回复文本
 */
export async function handleMessage(
  xmlBody: string,
  inboxPath: string
): Promise<string> {
  const parsed = await parseStringPromise(xmlBody, {
    explicitArray: false,
    trim: true,
  });

  const msg: WeChatMessage = parsed.xml;

  switch (msg.MsgType) {
    case "text":
      return await handleText(msg, inboxPath);
    case "link":
      return await handleLink(msg, inboxPath);
    case "image":
      return await handleImage(msg, inboxPath);
    default:
      return `收到 ${msg.MsgType} 类型消息，暂不支持`;
  }
}

/** 处理文字消息 */
async function handleText(msg: WeChatMessage, inboxPath: string): Promise<string> {
  const text = msg.Content || "";

  // 检测是否为链接
  const urlRegex = /https?:\/\/[^\s]+/g;
  const urls = text.match(urlRegex);

  if (urls && urls.length > 0) {
    // 包含链接 — 尝试识别是否为公众号文章
    const url = urls[0];
    if (url.includes("mp.weixin.qq.com")) {
      // 公众号文章
      await createRecord(inboxPath, {
        type: "article",
        senderId: msg.FromUserName,
        articleUrl: url,
      });
      return "已收到公众号文章，稍后将同步到你的 Obsidian 📝";
    } else {
      // 普通链接 — 作为文字处理
      await createRecord(inboxPath, {
        type: "text",
        senderId: msg.FromUserName,
        text,
      });
      return "已收到链接，稍后将同步到你的 Obsidian 📝";
    }
  }

  // 纯文字
  await createRecord(inboxPath, {
    type: "text",
    senderId: msg.FromUserName,
    text,
  });

  return "已收到，稍后将同步到你的 Obsidian 📝";
}

/** 处理链接消息 */
async function handleLink(msg: WeChatMessage, inboxPath: string): Promise<string> {
  const url = msg.Url || "";
  const title = msg.Title || "";

  if (url.includes("mp.weixin.qq.com")) {
    await createRecord(inboxPath, {
      type: "article",
      senderId: msg.FromUserName,
      articleUrl: url,
      title,
    });
    return "已收到公众号文章，稍后将同步到你的 Obsidian 📝";
  }

  await createRecord(inboxPath, {
    type: "text",
    senderId: msg.FromUserName,
    text: `${title}\n${url}`,
  });

  return "已收到链接，稍后将同步到你的 Obsidian 📝";
}

/** 处理图片消息 */
async function handleImage(msg: WeChatMessage, inboxPath: string): Promise<string> {
  // 图片消息暂时只记录，图片下载需要 access_token
  // TODO: 后续通过素材管理接口下载图片
  await createRecord(inboxPath, {
    type: "text",
    senderId: msg.FromUserName,
    text: `[收到一张图片] ${msg.PicUrl || ""}\n图片需要后续通过素材接口下载`,
  });

  return "收到图片，图片下载功能开发中 📷";
}

/** 创建收件箱记录 */
async function createRecord(
  inboxPath: string,
  opts: {
    type: "text" | "article";
    senderId: string;
    text?: string;
    articleUrl?: string;
    title?: string;
  }
): Promise<void> {
  const now = new Date().toISOString();

  const source: SourceInfo = {
    platform: "wechat",
    senderId: opts.senderId,
    chatType: "private",
    receivedAt: now,
  };

  let content: any;

  if (opts.type === "text") {
    content = { text: opts.text || "" };
  } else {
    content = {
      url: opts.articleUrl || "",
      title: opts.title,
    };
  }

  const record: InboxRecord = {
    id: crypto.randomUUID(),
    version: "1.0",
    type: opts.type,
    timestamp: now,
    source,
    status: "pending",
    content,
  };

  await writeRecord(inboxPath, record);
}
