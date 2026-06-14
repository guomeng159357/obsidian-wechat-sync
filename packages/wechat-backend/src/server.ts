import express from "express";
import { parseStringPromise } from "xml2js";
import { verifySignature, TEXT_RESPONSE_XML } from "./wechat.js";
import { handleMessage } from "./message-handler.js";

// ====== 配置 ======
const PORT = parseInt(process.env.PORT || "3000", 10);
const WECHAT_TOKEN = process.env.WECHAT_TOKEN || "your_token_here";
const INBOX_PATH = process.env.INBOX_PATH || "../sample-inbox";
const NGROK_AUTHTOKEN = process.env.NGROK_AUTHTOKEN || "";

const app = express();

// 解析微信 XML 请求体
app.use(express.text({ type: "text/xml" }));
app.use(express.text({ type: "application/xml" }));

// ====== 微信服务器验证（GET） ======
app.get("/wechat", (req, res) => {
  const { signature, timestamp, nonce, echostr } = req.query;

  console.log("收到微信验证请求:", { signature, timestamp, nonce, echostr, token: WECHAT_TOKEN });

  if (!signature || !timestamp || !nonce || !echostr) {
    res.status(400).send("缺少参数");
    return;
  }

  if (verifySignature(String(signature), String(timestamp), String(nonce), WECHAT_TOKEN)) {
    console.log("签名验证成功");
    res.send(String(echostr));
  } else {
    console.log("签名验证失败");
    res.status(403).send("签名验证失败");
  }
});

// ====== 接收微信消息（POST） ======
app.post("/wechat", async (req, res) => {
  try {
    // 解析 XML 获取发送者和接收者
    const parsed = await parseStringPromise(req.body, {
      explicitArray: false,
      trim: true,
    });
    const xml = parsed.xml;
    const toUser = xml.ToUserName || "";
    const fromUser = xml.FromUserName || "";

    // 处理消息
    const reply = await handleMessage(req.body, INBOX_PATH);

    // 构建回复
    const responseXml = TEXT_RESPONSE_XML
      .replace("{toUser}", fromUser)
      .replace("{fromUser}", toUser)
      .replace("{time}", String(Math.floor(Date.now() / 1000)))
      .replace("{content}", reply);

    res.type("application/xml").send(responseXml);
  } catch (error) {
    console.error("处理消息失败:", error);
    res.status(200).send("success");
  }
});

// ====== 启动服务 ======
app.listen(PORT, () => {
  console.log(`后端服务已启动: http://localhost:${PORT}/wechat`);
  console.log("请确保 cloudflared 隧道已启动: cloudflared tunnel --url http://localhost:3000");
  console.log(`当前 Token: ${WECHAT_TOKEN}`);
});
