import { App, PluginSettingTab, Setting } from "obsidian";
import type WechatSyncPlugin from "./main";

/**
 * 插件设置面板
 */
export class WechatSyncSettingTab extends PluginSettingTab {
  plugin: WechatSyncPlugin;

  constructor(app: App, plugin: WechatSyncPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "微信内容同步助手 - 设置" });

    // 收件箱路径
    new Setting(containerEl)
      .setName("收件箱路径")
      .setDesc("本地收件箱文件夹的绝对路径")
      .addText((text) =>
        text
          .setPlaceholder("/Users/xxx/sample-inbox")
          .setValue(this.plugin.settings.inboxPath)
          .onChange(async (value) => {
            this.plugin.settings.inboxPath = value;
            await this.plugin.saveSettings();
          })
      );

    // 输出文件夹
    new Setting(containerEl)
      .setName("输出文件夹")
      .setDesc("笔记在 vault 中的输出目录")
      .addText((text) =>
        text
          .setPlaceholder("WeChat")
          .setValue(this.plugin.settings.outputFolder)
          .onChange(async (value) => {
            this.plugin.settings.outputFolder = value;
            await this.plugin.saveSettings();
          })
      );

    // 附件文件夹
    new Setting(containerEl)
      .setName("附件文件夹")
      .setDesc("附件在 vault 中的存储目录")
      .addText((text) =>
        text
          .setPlaceholder("WeChat/attachments")
          .setValue(this.plugin.settings.attachmentsFolder)
          .onChange(async (value) => {
            this.plugin.settings.attachmentsFolder = value;
            await this.plugin.saveSettings();
          })
      );

    // 轮询间隔
    new Setting(containerEl)
      .setName("轮询间隔（毫秒）")
      .setDesc("文件监听不可用时的轮询间隔")
      .addSlider((slider) =>
        slider
          .setLimits(1000, 60000, 1000)
          .setValue(this.plugin.settings.pollingIntervalMs)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.pollingIntervalMs = value;
            await this.plugin.saveSettings();
          })
      );

    // 自动归档
    new Setting(containerEl)
      .setName("自动归档")
      .setDesc("处理完成后自动归档记录")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.autoArchive).onChange(async (value) => {
          this.plugin.settings.autoArchive = value;
          await this.plugin.saveSettings();
        })
      );

    // 自动同步开关
    new Setting(containerEl)
      .setName("启用自动同步")
      .setDesc("开启后按固定间隔自动扫描收件箱并同步内容")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.autoSyncEnabled).onChange(async (value) => {
          this.plugin.settings.autoSyncEnabled = value;
          await this.plugin.saveSettings();
          this.plugin.onAutoSyncChanged();
        })
      );

    // 自动同步间隔
    new Setting(containerEl)
      .setName("自动同步间隔（秒）")
      .setDesc("自动同步的间隔时间，默认 60 秒")
      .addText((text) =>
        text
          .setPlaceholder("60")
          .setValue(String(this.plugin.settings.autoSyncIntervalMs / 1000))
          .onChange(async (value) => {
            const sec = parseInt(value, 10);
            if (sec > 0) {
              this.plugin.settings.autoSyncIntervalMs = sec * 1000;
              await this.plugin.saveSettings();
              this.plugin.onAutoSyncChanged();
            }
          })
      );

    // 默认标签
    new Setting(containerEl)
      .setName("默认标签")
      .setDesc("添加到每篇笔记的默认标签，用逗号分隔")
      .addText((text) =>
        text
          .setPlaceholder("wechat")
          .setValue(this.plugin.settings.defaultTags.join(", "))
          .onChange(async (value) => {
            this.plugin.settings.defaultTags = value
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean);
            await this.plugin.saveSettings();
          })
      );

    containerEl.createEl("h3", { text: "笔记模板" });
    containerEl.createEl("p", { text: "可用变量：{{title}} {{date}} {{content}} {{sender}} {{tags}}", cls: "setting-item-description" });

    // 文字模板
    new Setting(containerEl)
      .setName("文字/链接模板")
      .setDesc("变量：{{title}} {{date}} {{content}} {{sender}} {{tags}}")
      .addTextArea((text) =>
        text
          .setValue(this.plugin.settings.templateText)
          .onChange(async (value) => {
            this.plugin.settings.templateText = value;
            await this.plugin.saveSettings();
          })
      );

    // 文章模板
    new Setting(containerEl)
      .setName("文章模板")
      .setDesc("额外变量：{{url}} {{author}} {{publishDate}}")
      .addTextArea((text) =>
        text
          .setValue(this.plugin.settings.templateArticle)
          .onChange(async (value) => {
            this.plugin.settings.templateArticle = value;
            await this.plugin.saveSettings();
          })
      );

    // 文件模板
    new Setting(containerEl)
      .setName("文件/图片模板")
      .setDesc("额外变量：{{fileType}} {{fileSize}} {{fileName}}")
      .addTextArea((text) =>
        text
          .setValue(this.plugin.settings.templateFile)
          .onChange(async (value) => {
            this.plugin.settings.templateFile = value;
            await this.plugin.saveSettings();
          })
      );
  }
}
