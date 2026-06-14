# 微信内容同步助手 - 交接文档

> 最后更新：2026-06-14

## 一、项目概述

从微信同步内容到 Obsidian vault 的工具链。用户在微信里发送文字、链接、公众号文章到指定微信公众号，内容自动同步到 Obsidian，生成带 frontmatter 的 Markdown 笔记。

### 核心链路

```
微信公众号 ──▶ 后端服务(Express) ──▶ 本地收件箱(JSON) ──▶ Obsidian 插件 ──▶ Vault Markdown
                  ▲                        ▲
            cloudflared 隧道          文件系统监听/轮询
```

### 仓库地址

https://github.com/guomeng159357/obsidian-wechat-sync

---

## 二、本地路径速查表

| 用途 | 路径 |
|------|------|
| 项目根目录 | `/Users/ammon/Desktop/项目/Obsidian内容同步助手` |
| Obsidian vault | `/Users/ammon/Library/CloudStorage/坚果云-guomeng159357@outlook.com/我的坚果云/Obsidian仓库` |
| 插件安装位置 | `.../Obsidian仓库/.obsidian/plugins/wechat-inbox-sync/` |
| 本地收件箱 | `.../Obsidian内容同步助手/sample-inbox` |
| 输出笔记 | `.../Obsidian仓库/WeChat/YYYY-MM-DD/` |
| 附件目录 | `.../Obsidian仓库/WeChat/attachments/` |

---

## 三、项目结构

```
packages/
├── shared/src/              # 共享类型和工具
│   ├── types.ts             # InboxRecord、ContentType 等类型定义
│   └── schemas.ts           # JSON Schema 校验、文件命名规范
│
├── obsidian-plugin/         # Obsidian 插件（核心模块）
│   ├── esbuild.config.mjs   # 构建配置（charset: utf8 必须！）
│   ├── manifest.json        # 插件清单（已中文化）
│   ├── styles.css
│   └── src/
│       ├── main.ts          # 插件入口、生命周期、命令注册
│       ├── settings.ts      # 设置面板 UI
│       ├── inbox-watcher.ts # 文件监听 + 轮询 + 主流程编排
│       ├── record-reader.ts # 读取/校验/归档 JSON 记录
│       ├── error-handler.ts # 统一错误处理
│       ├── processors/      # 内容处理器（策略模式）
│       │   ├── base-processor.ts
│       │   ├── processor-registry.ts
│       │   ├── text-processor.ts     # 文字/链接 → Markdown
│       │   ├── article-processor.ts  # 公众号文章 → Markdown
│       │   └── file-processor.ts     # 图片/文件 → 笔记+附件
│       └── services/        # 基础服务
│           ├── vault-writer.ts       # Vault 文件写入（按日期归档）
│           ├── markdown-builder.ts   # {{变量}} 模板渲染
│           ├── html-converter.ts     # HTML→Markdown（turndown）
│           ├── attachment-copier.ts  # 附件复制/下载到 vault
│           └── article-fetcher.ts    # 微信文章内容抓取
│
├── inbox-simulator/         # 本地模拟器 CLI（开发测试用）
│   └── src/
│       ├── cli.ts           # Commander 入口
│       ├── record-writer.ts # 原子写入（.tmp → .json）
│       └── commands/        # text / article / file 三条命令
│
└── wechat-backend/          # 微信公众号后端服务
    └── src/
        ├── server.ts        # Express 服务入口
        ├── wechat.ts        # 微信签名校验 + XML 模板
        ├── message-handler.ts # 消息解析 + 写入收件箱
        └── record-writer.ts # 原子写入（与模拟器同协议）

sample-inbox/                # 开发用收件箱
├── pending/                 # 待处理
├── processing/              # 处理中
├── done/                    # 已完成
├── failed/                  # 失败
└── attachments/             # 附件暂存
```

---

## 四、三种内容处理流程

### 4.1 文字/链接（text-processor.ts）

```
原始文本
  ├── 噪音行过滤（微信元数据、公众号名、日期等）
  ├── 中文序号 → ## 二级标题（一、第一、第1）、第N等）
  ├── 阿拉伯数字 → Markdown 有序列表（1. 2、3）等）
  ├── 普通段落 → 　　（两个全角空格首行缩进）
  └── 提取第一个 ## 标题作为笔记文件名
       ↓
  {{template}} 渲染 → Vault Markdown 文件
```

### 4.2 公众号文章（article-processor.ts）

```
收件箱记录
  ├── 有 htmlContent → 直接使用
  └── 仅有 URL → article-fetcher.ts 抓取
       ↓
      HTML 内容
       ├── 优先从 JS 变量提取元数据（msg_title、nickname、createTime）
       ├── 深度追踪解析 #js_content 嵌套 div
       └── html-converter.ts 转 Markdown（data-src 优先于 src）
       ↓
      Markdown 正文
       ├── 提取远程图片 URL → 下载到 vault → 替换为 ![[本地文件名]]
       └── {{template}} 渲染 → Vault Markdown 文件
```

### 4.3 图片/文件（file-processor.ts）

```
收件箱记录
  ├── 图片 → 复制到 vault attachments → 生成 ![[文件名]] 笔记
  └── 其他文件 → 复制到 vault attachments → 生成文件链接笔记
```

---

## 五、文本格式化规则详解

| 输入格式 | 匹配模式 | 输出格式 | 说明 |
|----------|----------|----------|------|
| `一、项目管理` | 中文数字 + 、 | `## 一、项目管理` | 支持一到九十九 |
| `十一、内容` | 中文数字 + 、 | `## 十一、内容` | 十位组合 |
| `第一、需求` | 第+中文数字 + 、 | `## 第一、需求` | 序数标题 |
| `第2、设计` | 第+阿拉伯数字 + 、 | `## 第2、设计` | 混合序号标题 |
| `第1）范围` | 第+数字 + ） | `## 第1、范围` | 括号序号标题 |
| `1. 目标` | 数字 + . | `1. 目标` | Markdown 有序列表 |
| `2、指标` | 数字 + 、 | `2. 指标` | 统一为点号分隔 |
| `3）风险` | 数字 + ） | `3. 风险` | 括号转点号 |
| 普通段落 | 无匹配 | `　　段落内容...` | 全角空格缩进 |
| `原创`/`TechPM`/`2026年...` | 噪音匹配 | (删除) | 微信元数据行 |

### 噪音行过滤清单

以下类型的行会被自动删除：
- **关键词**：原创、付费、星标、关注、分享、点赞、在看、阅读、赞、赞赏、喜欢、收藏、转发、举报、投诉、取消、发送、消息、发布、置顶、设为星标、作者、声明、版权所有、本文、轻触阅读、关闭、继续阅读、VIP、会员、付费阅读、解锁、剩余、试读、来自、发表于、修改于、阅读全文、微信扫一扫、关注该公众号、收录于合集
- **日期行**：`2026年6月14日 15:49` 格式
- **位置行**：`广东 285人` 格式
- **纯英文短串**：2-20 个字符的纯英文/数字组合（如 `TechPM`）

---

## 六、收件箱协议

### 文件名格式

```
YYYYMMDDTHHmmss-uuid.json
示例: 20260614T141828-a2843480-00de-4122-8245-9f83d8fc7b4f.json
```

### 原子写入协议

```
1. 写入 .tmp 临时文件
2. fs.rename(.tmp → .json)
3. 插件只监听 .json 文件，忽略 .tmp
```

### 状态流转

```
pending/ ──▶ processing/ ──▶ done/    (成功)
                    │
                    └──▶ failed/       (失败，含错误信息)
```

通过文件移动实现，是原子操作。

---

## 七、启动指南

### 7.1 仅本地测试（不用微信）

**只需插件 + 模拟器，最快验证流程：**

```bash
# 第一步：构建插件并复制到 vault
cd /Users/ammon/Desktop/项目/Obsidian内容同步助手/packages/obsidian-plugin
node esbuild.config.mjs production
cp main.js manifest.json styles.css \
  "/Users/ammon/Library/CloudStorage/坚果云-guomeng159357@outlook.com/我的坚果云/Obsidian仓库/.obsidian/plugins/wechat-inbox-sync/"

# 第二步：在 Obsidian 中重载插件
# Cmd+P → 输入"重新加载" → 回车

# 第三步：用模拟器发送测试内容
cd /Users/ammon/Desktop/项目/Obsidian内容同步助手/packages/inbox-simulator

# 发文字
npx tsx src/cli.ts text \
  --inbox "/Users/ammon/Desktop/项目/Obsidian内容同步助手/sample-inbox" \
  --sender "测试用户" \
  "你的文字内容"

# 发公众号文章（会自动抓取正文和图片）
npx tsx src/cli.ts article \
  --inbox "/Users/ammon/Desktop/项目/Obsidian内容同步助手/sample-inbox" \
  "https://mp.weixin.qq.com/s/xxxxx"

# 发图片/文件
npx tsx src/cli.ts file \
  --inbox "/Users/ammon/Desktop/项目/Obsidian内容同步助手/sample-inbox" \
  ~/Desktop/photo.png
```

### 7.2 完整链路（接入微信公众号）

需要三个终端同时运行：

**终端 1 — 后端服务：**

```bash
cd /Users/ammon/Desktop/项目/Obsidian内容同步助手/packages/wechat-backend
export WECHAT_TOKEN=你的token
export INBOX_PATH=../../sample-inbox
npx tsx src/server.ts
```

**终端 2 — 内网穿透：**

```bash
cloudflared tunnel --url http://localhost:3000
# 记下输出的 https://xxxx.trycloudflare.com 地址
```

**终端 3 — 构建并加载插件：**

```bash
cd /Users/ammon/Desktop/项目/Obsidian内容同步助手/packages/obsidian-plugin
node esbuild.config.mjs production
cp main.js manifest.json styles.css \
  "/Users/ammon/Library/CloudStorage/坚果云-guomeng159357@outlook.com/我的坚果云/Obsidian仓库/.obsidian/plugins/wechat-inbox-sync/"
```

然后在微信测试号页面配置：
- URL：`https://xxxx.trycloudflare.com/wechat`
- Token：与 `WECHAT_TOKEN` 一致

### 7.3 插件设置参考

```json
{
  "inboxPath": "/Users/ammon/Desktop/项目/Obsidian内容同步助手/sample-inbox",
  "outputFolder": "WeChat",
  "attachmentsFolder": "WeChat/attachments",
  "pollingIntervalMs": 5000,
  "autoArchive": true,
  "autoSyncEnabled": false,
  "autoSyncIntervalMs": 60000,
  "defaultTags": ["wechat"],
  "templateText": "",
  "templateArticle": "",
  "templateFile": ""
}
```

---

## 八、开发工作流

### 修改代码后的标准操作

```bash
# 一键：构建 + 复制到 vault
cd /Users/ammon/Desktop/项目/Obsidian内容同步助手/packages/obsidian-plugin && \
  node esbuild.config.mjs production && \
  cp main.js manifest.json styles.css \
  "/Users/ammon/Library/CloudStorage/坚果云-guomeng159357@outlook.com/我的坚果云/Obsidian仓库/.obsidian/plugins/wechat-inbox-sync/"

# Obsidian 中重载插件: Cmd+P → "重新加载"

# 发测试内容验证
cd /Users/ammon/Desktop/项目/Obsidian内容同步助手/packages/inbox-simulator && \
  npx tsx src/cli.ts text \
  --inbox "/Users/ammon/Desktop/项目/Obsidian内容同步助手/sample-inbox" \
  --sender "测试" \
  "一、测试标题

这是测试内容段落。

1. 列表项一
2. 列表项二"

# 查看生成的笔记
# Obsidian vault → WeChat/YYYY-MM-DD/ 文件夹
```

### 查看日志

在 Obsidian 中 `Cmd+Opt+I` 打开开发者工具 → Console 面板，可以看到插件日志。

---

## 九、构建注意事项

| 事项 | 说明 |
|------|------|
| charset | 必须显式设置 `charset: "utf8"`，默认 ascii 会导致中文乱码 |
| external | `obsidian` 和 `electron` 设为 external，由运行时提供 |
| CWD | 必须在 `packages/obsidian-plugin/` 目录下执行构建 |
| 重载 | 构建后必须在 Obsidian 中重载插件才能生效 |

---

## 十、常见问题与解决方案

### 文章抓取

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| 文章内容抓取失败 | 非贪婪正则 `([\s\S]*?)` 在嵌套 div 中提前终止 | 用深度追踪算法逐层匹配 `<div>` 和 `</div>` |
| 标题/作者/日期为空 | 微信文章元数据在 JS 变量中，不在 `<meta>` 标签 | 优先提取 `var msg_title`/`nickname`/`createTime` |
| fetch 失败 | Obsidian Electron 环境限制 | 改用 Obsidian 原生 `requestUrl` API |
| 图片 URL 为空 `![]()` | 微信用 `data-src` 懒加载，非 `src` 属性 | HTML→MD 时优先取 `data-src` |
| 图片下载但未嵌入 | HTML 实体解码导致 URL 与 MD 中不一致 | 先转 MD 再从 MD 中提取 URL 替换 |

### 文本格式化

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| `## 一、一` 而非完整标题 | CN_NUM_RE 内部捕获组导致 `cnMatch[2]` 索引偏移 | 改用非捕获组 `(?:...)` |
| 标题为长段落 | 旧版从第一段取标题 | 优先从第一个 `##` 标题提取，去掉序号前缀 |
| 文件中含有"原创""TechPM" | 噪音过滤未启用 | 新版 `isNoiseLine()` 已过滤 50+ 种噪音模式 |
| 收件箱文件不处理 | 文件名不符合规范格式 | 必须用 `YYYYMMDDTHHmmss-uuid.json` |
| 段落无缩进 | 旧版直接输出原文 | 新版普通段落自动加 `　　` 缩进 |

### 构建与部署

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| 插件中文界面消失 | esbuild charset 默认 ascii | 设置 `charset: "utf8"` |
| 环境变量不生效 | npm scripts 作用域限制 | 用 `export VAR=value` 而非内联 |
| cloudflared URL 变更 | 每次重启生成新地址 | 去微信测试号页面更新接口 URL |
| git push 无权限 | HTTPS 未配置凭证 | 用 `gh auth setup-git` 后推送 |

---

## 十一、模板变量参考

### 全部类型通用

| 变量 | 说明 |
|------|------|
| `{{title}}` | 笔记标题 |
| `{{date}}` | 日期（YYYY-MM-DD） |
| `{{content}}` | 正文内容（Markdown） |
| `{{sender}}` | 发送者昵称 |
| `{{tags}}` | 标签列表（逗号分隔） |

### 文章类型额外

| 变量 | 说明 |
|------|------|
| `{{url}}` | 原文链接 |
| `{{author}}` | 作者 |
| `{{publishDate}}` | 发布时间 |

### 文件类型额外

| 变量 | 说明 |
|------|------|
| `{{fileType}}` | 文件 MIME 类型 |
| `{{fileSize}}` | 文件大小（字节） |
| `{{fileName}}` | 原始文件名 |

### 默认模板示例

```markdown
---
date: "{{date}}"
tags: [{{tags}}]
sender: "{{sender}}"
---

# {{title}}

{{content}}
```

---

## 十二、GitHub 操作

```bash
cd /Users/ammon/Desktop/项目/Obsidian内容同步助手

# 查看状态
git status

# 提交
git add <改动的文件>
git commit -m "类型: 描述"

# 推送（需要先 gh auth setup-git）
git push origin main
```

---

## 十三、后续计划

- [ ] 微信图片自动下载（需要 access_token + 素材管理接口）
- [ ] 云端部署
- [ ] 语音转文字支持
- [ ] 反向同步（Obsidian → 微信草稿箱）
- [ ] Obsidian 社区插件市场上架
