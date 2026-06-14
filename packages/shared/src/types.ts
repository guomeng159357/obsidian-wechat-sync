/** 记录版本号 */
export type RecordVersion = "1.0";

/** 内容类型 */
export type ContentType = "text" | "article" | "file";

/** 记录处理状态 */
export type RecordStatus = "pending" | "processing" | "done" | "failed";

/** 来源信息 */
export interface SourceInfo {
  platform: "wechat";
  sender?: string;
  senderId?: string;
  chatType?: "private" | "group";
  receivedAt: string; // ISO 8601
}

/** 链接项 */
export interface LinkItem {
  url: string;
  title?: string;
  description?: string;
}

/** 文字/链接内容 */
export interface TextContent {
  text: string;
  links?: LinkItem[];
}

/** 文章内图片 */
export interface ArticleImage {
  originalUrl: string;
  localPath?: string;
  alt?: string;
}

/** 公众号文章内容 */
export interface ArticleContent {
  url: string;
  title?: string;
  author?: string;
  publishDate?: string;
  htmlContent?: string;
  plainTextContent?: string;
  images?: ArticleImage[];
}

/** 图片/文件内容 */
export interface FileContent {
  fileName: string;
  fileType: string; // MIME 类型
  fileSize: number; // 字节数
  sourcePath: string; // inbox attachments 内相对路径
  description?: string;
}

/** 顶层收件箱记录 */
export interface InboxRecord {
  id: string;
  version: RecordVersion;
  type: ContentType;
  timestamp: string;
  source: SourceInfo;
  status: RecordStatus;
  content: TextContent | ArticleContent | FileContent;
  processedAt?: string;
  error?: string;
  retryCount?: number;
}

/** 插件设置 */
export interface WechatSyncSettings {
  inboxPath: string;
  outputFolder: string;
  attachmentsFolder: string;
  pollingIntervalMs: number;
  autoArchive: boolean;
  autoSyncEnabled: boolean;
  autoSyncIntervalMs: number;
  templateText: string;
  templateArticle: string;
  templateFile: string;
  defaultTags: string[];
}
