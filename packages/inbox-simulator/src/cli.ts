#!/usr/bin/env node

import { Command } from "commander";
import { sendText } from "./commands/send-text.js";
import { sendArticle } from "./commands/send-article.js";
import { sendFile } from "./commands/send-file.js";

const program = new Command();

program.name("wechat-sync").description("微信内容同步收件箱模拟器").version("1.0.0");

const inboxOption = (cmd: Command) =>
  cmd.option("--inbox <path>", "收件箱路径", process.env.WECHAT_SYNC_INBOX || "./sample-inbox");

const senderOption = (cmd: Command) =>
  cmd.option("--sender <name>", "发送者昵称", "模拟用户");

// 发送文字/链接
const textCmd = new Command("text")
  .description("发送文字内容到收件箱")
  .argument("<text>", "文字内容")
  .action(async (text: string, options: { inbox?: string; sender?: string }) => {
    if (!options.inbox) {
      console.error("错误: 需要指定 --inbox 或设置 WECHAT_SYNC_INBOX 环境变量");
      process.exit(1);
    }
    await sendText(options.inbox, text, { sender: options.sender });
  });

inboxOption(textCmd);
senderOption(textCmd);

// 发送文章
const articleCmd = new Command("article")
  .description("发送公众号文章到收件箱（自动抓取内容）")
  .argument("<url>", "文章 URL")
  .option("--no-fetch", "跳过内容抓取，仅保存链接")
  .action(async (url: string, options: { inbox?: string; sender?: string; fetch?: boolean }) => {
    if (!options.inbox) {
      console.error("错误: 需要指定 --inbox 或设置 WECHAT_SYNC_INBOX 环境变量");
      process.exit(1);
    }
    await sendArticle(options.inbox, url, { sender: options.sender, fetch: options.fetch });
  });

inboxOption(articleCmd);
senderOption(articleCmd);

// 发送文件/图片
const fileCmd = new Command("file")
  .description("发送文件或图片到收件箱")
  .argument("<filePath>", "文件路径")
  .option("--desc <description>", "文件描述")
  .action(async (filePath: string, options: { inbox?: string; sender?: string; desc?: string }) => {
    if (!options.inbox) {
      console.error("错误: 需要指定 --inbox 或设置 WECHAT_SYNC_INBOX 环境变量");
      process.exit(1);
    }
    await sendFile(options.inbox, filePath, { sender: options.sender, description: options.desc });
  });

inboxOption(fileCmd);
senderOption(fileCmd);

// 注册子命令
program.addCommand(textCmd);
program.addCommand(articleCmd);
program.addCommand(fileCmd);

// 解析命令行
program.parse();
