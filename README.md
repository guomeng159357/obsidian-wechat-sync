# Obsidian 微信内容同步助手

从微信同步内容到 Obsidian vault 的完整工具链。

## 项目概述

用户在微信里发送文字、链接、公众号文章到指定微信公众号，内容自动同步到本地 Obsidian vault，生成带 frontmatter 的 Markdown 笔记。

### 核心链路

```
微信公众号 ──▶ 后端服务(Express) ──▶ 本地收件箱(JSON) ──▶ Obsidian 插件 ──▶ Vault Markdown
                  ▲                        ▲
            cloudflared 隧道          文件系统监听/轮询
```

## 安装指南

### 1. 克隆仓库

```bash
git clone https://github.com/guomeng159357/obsidian-wechat-sync.git
cd obsidian-wechat-sync
npm install
```

### 2. 构建 Obsidian 插件

```bash
cd packages/obsidian-plugin
node esbuild.config.mjs production
```

### 3. 安装插件到 Obsidian

将以下三个文件复制到你的 Obsidian vault 插件目录：

```bash
# macOS
cp main.js manifest.json styles.css \
  "/Users/你的用户名/Library/CloudStorage/坚果云-xxx/我的坚果云/Obsidian仓库/.obsidian/plugins/wechat-inbox-sync/"

# Windows
copy main.js manifest.json styles.css \
  "C:\Users\你的用户名\Documents\Obsidian\你的仓库\.obsidian\plugins\wechat-inbox-sync\"
```

### 4. 在 Obsidian 中启用

1. 打开 Obsidian → 设置 → 第三方插件
2. 关闭"安全模式"
3. 找到"微信内容同步助手"，点击启用
4. 进入插件设置，配置**收件箱路径**（见下方说明）

### 5. 配置收件箱路径

插件需要一个本地文件夹作为收件箱。开发调试可直接使用项目自带的 `sample-inbox`：

| 配置项 | 推荐值 |
|--------|--------|
| 收件箱路径 | `/你的路径/obsidian-wechat-sync/sample-inbox` |
| 输出文件夹 | `WeChat` |
| 附件文件夹 | `WeChat/attachments` |
| 默认标签 | `wechat` |

### 6. （可选）接入微信公众号

参照下方 [部署操作](#部署操作) 章节，启动后端服务和内网穿透，配置微信测试号即可。

## 项目目录结构

```
obsidian-wechat-sync/
├── packages/
│   ├── shared/src/                 # 共享类型和工具
│   │   ├── types.ts                # InboxRecord、ContentType 等类型定义
│   │   └── schemas.ts              # 记录校验、文件名处理、时间格式化
│   │
│   ├── obsidian-plugin/            # Obsidian 插件
│   │   ├── src/
│   │   │   ├── main.ts             # 插件入口，生命周期管理
│   │   │   ├── settings.ts         # 设置面板 UI
│   │   │   ├── inbox-watcher.ts    # 收件箱文件监听 + 轮询
│   │   │   ├── record-reader.ts    # JSON 记录读取/校验/归档
│   │   │   ├── error-handler.ts    # 统一错误处理 + 重试
│   │   │   ├── processors/         # 内容处理器（策略模式）
│   │   │   │   ├── text-processor.ts     # 文字/链接
│   │   │   │   ├── article-processor.ts  # 公众号文章
│   │   │   │   └── file-processor.ts     # 图片/文件
│   │   │   └── services/           # 基础服务
│   │   │       ├── vault-writer.ts       # Vault 写入
│   │   │       ├── markdown-builder.ts   # 模板渲染 + Markdown 生成
│   │   │       ├── html-converter.ts     # HTML → MD（turndown）
│   │   │       ├── attachment-copier.ts  # 附件复制到 vault
│   │   │       └── article-fetcher.ts    # 文章内容抓取
│   │   └── esbuild.config.mjs      # 构建配置（charset: utf8 必须）
│   │
│   ├── inbox-simulator/            # 本地模拟器 CLI
│   │   └── src/
│   │       ├── cli.ts              # Commander CLI 入口
│   │       ├── record-writer.ts    # 原子写入收件箱记录
│   │       └── commands/           # text / article / file 子命令
│   │
│   └── wechat-backend/             # 微信公众号后端服务
│       └── src/
│           ├── server.ts           # Express 服务入口
│           ├── wechat.ts           # 微信签名校验 + XML 模板
│           ├── message-handler.ts  # 消息解析 + 写入收件箱
│           └── record-writer.ts    # 原子写入（与模拟器同协议）
│
└── sample-inbox/                   # 本地收件箱（开发用）
    ├── pending/                    # 待处理
    ├── processing/                 # 处理中
    ├── done/                       # 已完成
    ├── failed/                     # 失败
    └── attachments/                # 附件暂存
```

## 收件箱协议

每个记录是一个 JSON 文件，命名格式：`YYYYMMDDTHHmmss-uuid.json`

### 写入协议（原子操作）

```
1. 先写 .tmp 临时文件
2. rename 为 .json 正式文件
3. 插件监听端只处理 .json，忽略 .tmp
```

### 状态流转

```
pending/ ──(检测到)──▶ processing/ ──(成功)──▶ done/
                          │
                          └──(失败)──▶ failed/
```

## 功能特性

### 文字/链接处理

- 微信文本自动转为 Markdown 格式
- 中文数字序号（`一、` `二、` … `十一、`）→ `##` 二级标题
- 序数标题（`第一、` `第2、` `第1）`）→ `##` 二级标题
- 阿拉伯数字（`1.` `2、` `3）`）→ Markdown 有序列表
- 自然段自动首行缩进（两个全角空格 `　　`）
- 自动过滤微信转载混入的元数据噪音行（"原创"、"星标"、日期、位置、公众号名等）
- 提取第一个标题作为笔记文件名
- 附加链接列表（如有）

### 公众号文章处理

- HTML 内容自动转为 Markdown（基于 turndown）
- 仅 URL 时自动抓取网页内容
- 文章内图片自动下载并嵌入为 `![[本地文件名]]`
- 提取作者、发布时间等元数据写入 frontmatter

### 图片/文件处理

- 附件复制到 vault 附件目录
- 图片用 Obsidian 原生 `![[文件名]]` 嵌入
- frontmatter 记录 fileType、fileSize 等元数据

### 通用特性

- 三种内容类型的**自定义笔记模板**（在插件设置中编辑）
- 按日期文件夹自动归档（如 `WeChat/2026-06-14/`）
- **手动同步**和**自动定时同步**（可开关）
- 收件箱文件监听 + 轮询 fallback
- 微信测试号接入（cloudflared 隧道）

### 模板变量

| 变量 | 说明 | 适用类型 |
|------|------|----------|
| `{{title}}` | 笔记标题 | 全部 |
| `{{date}}` | 日期 | 全部 |
| `{{content}}` | 正文内容 | 全部 |
| `{{sender}}` | 发送者 | 全部 |
| `{{tags}}` | 标签列表 | 全部 |
| `{{url}}` | 原文链接 | 文章 |
| `{{author}}` | 作者 | 文章 |
| `{{publishDate}}` | 发布时间 | 文章 |
| `{{fileType}}` | 文件 MIME 类型 | 文件 |
| `{{fileSize}}` | 文件大小(字节) | 文件 |
| `{{fileName}}` | 文件名 | 文件 |

## 开发历程

### 关键节点

1. **需求讨论**（2026-06-14）— 确定架构：微信公众号入口 + 本地文件后端 + Obsidian 插件
2. **共享类型层** — `InboxRecord` 协议定义，JSON Schema 校验
3. **Obsidian 插件核心** — 文件监听 → 记录读取 → 处理器分发 → Vault 写入
4. **收件箱模拟器 CLI** — 三条命令（text/article/file），本地验证全链路
5. **模板系统** — 从写死格式改为可配置模板，支持 `{{变量}}` 渲染
6. **esbuild 中文问题** — 漏加 `charset: "utf8"` 导致中文界面消失，已修复
7. **自动同步** — 添加可手动开关的定时同步功能
8. **微信后端服务** — Express + xml2js，支持文本/链接/文章消息
9. **内网穿透** — 尝试 ngrok → Homebrew ngrok → cloudflared（成功）
10. **端到端验证** — 微信测试号发消息 → Obsidian 出现笔记，全链路打通
11. **文章内容抓取修复** — 用深度追踪解析嵌套 div 提取正文，JS 变量提取元数据，Obsidian `requestUrl` API 替代 `fetch`
12. **图片下载嵌入** — 先 HTML→MD 再提取远程图片 URL 下载替换为 `![[本地名]]`
13. **文本格式化** — 中文序号→标题、微信噪音过滤、段落缩进

### 踩过的坑

1. **esbuild 默认 charset=ascii** — 中文设置面板文字消失，需显式 `charset: "utf8"`
2. **环境变量作用域** — `INLINE=xxx cmd` 只在命令作用域有效，`export` 后子进程才能继承
3. **ngrok npm 包兼容性** — macOS Node 24 有 spawn 错误，改用 Homebrew；免费版截断微信请求，最终用 cloudflared
4. **Obsidian 文件系统访问** — 用 `require("fs")` 而非 `vault.adapter`（后者仅限 vault 内部）
5. **微信文章嵌套 div 解析** — 非贪婪正则 `([\s\S]*?)` 在嵌套结构中提前终止，改用深度追踪算法
6. **微信图片懒加载** — 图片 URL 在 `data-src` 属性而非 `src`，HTML→MD 转换需优先检查
7. **图片替换 URL 不匹配** — HTML 属性值经过 HTML 实体解码后与 Markdown 输出不一致，改为从 MD 中提取 URL
8. **中文序号捕获组嵌套** — CN_NUM_RE 内部捕获组导致 `cnMatch[2]` 取到序号而非内容，改为非捕获组 `(?:…)`

## 部署操作

### 前置条件

- Node.js >= 18
- Obsidian 桌面版
- cloudflared（内网穿透）
- 微信公众号测试号（[申请地址](https://mp.weixin.qq.com/debug/cgi-bin/sandbox?t=sandbox/login)）

### 启动步骤

#### 1. 安装依赖

```bash
cd obsidian-wechat-sync
npm install
```

#### 2. 构建 Obsidian 插件

```bash
cd packages/obsidian-plugin
node esbuild.config.mjs production
# 将 main.js、manifest.json、styles.css 复制到 vault 插件目录
```

#### 3. 启动后端服务（终端 1）

```bash
cd packages/wechat-backend
export WECHAT_TOKEN=你的token
export INBOX_PATH=../../sample-inbox
npx tsx src/server.ts
```

#### 4. 启动内网穿透（终端 2）

```bash
cloudflared tunnel --url http://localhost:3000
```

记下输出的 `https://xxxx.trycloudflare.com` 地址。

#### 5. 配置微信测试号

- 打开测试号页面，微信扫码登录
- 接口配置信息：
  - URL：`https://xxxx.trycloudflare.com/wechat`
  - Token：与步骤 3 中 `WECHAT_TOKEN` 一致
- 点击提交，验证通过后显示"配置成功"

#### 6. 配置 Obsidian 插件

- 打开 Obsidian → 设置 → 第三方插件 → 微信内容同步助手
- **收件箱路径**：`/你的路径/obsidian-wechat-sync/sample-inbox`
- **启用自动同步**：按需开启
- **自动同步间隔**：默认 60 秒
- **笔记模板**：三个编辑器可按需修改

### 开发测试（不使用微信）

```bash
# 跳过微信，用模拟器直接发送内容到收件箱
cd obsidian-wechat-sync

# 发送文字
npx tsx packages/inbox-simulator/src/cli.ts text "测试内容" --sender "张三"

# 发送文章
npx tsx packages/inbox-simulator/src/cli.ts article "https://mp.weixin.qq.com/s/xxx"

# 发送文件
npx tsx packages/inbox-simulator/src/cli.ts file ~/photo.png --desc "截图"
```

然后在 Obsidian 中执行 `Cmd+P` → "立即同步收件箱"。

### cloudflared 重启后 URL 变更

cloudflared 每次重启会生成新的 `trycloudflare.com` 地址，需要：
1. 记下新地址
2. 去微信测试号页面更新"接口配置信息"的 URL
3. 无需重启后端服务

## 后续计划

- [ ] 微信图片自动下载（需要 access_token + 素材管理接口）
- [ ] 云端部署（不再依赖本地电脑常开）
- [ ] 语音转文字支持
- [ ] 反向同步（Obsidian → 微信公众号草稿箱）
- [ ] Obsidian 社区插件市场上架

## 许可证

MIT
