import crypto from "node:crypto";

/**
 * 微信公众号签名校验
 * 微信服务器会发送 GET 请求验证服务器地址
 */
export function verifySignature(
  signature: string,
  timestamp: string,
  nonce: string,
  token: string
): boolean {
  const arr = [token, timestamp, nonce].sort();
  const str = arr.join("");
  const sha1 = crypto.createHash("sha1").update(str).digest("hex");
  console.log("签名计算:", { sorted: arr, combined: str, computed: sha1, received: signature });
  return sha1 === signature;
}

/**
 * 公众号文本消息 XML 模板
 */
export const TEXT_RESPONSE_XML = `<xml>
<ToUserName><![CDATA[{toUser}]]></ToUserName>
<FromUserName><![CDATA[{fromUser}]]></FromUserName>
<CreateTime>{time}</CreateTime>
<MsgType><![CDATA[text]]></MsgType>
<Content><![CDATA[{content}]]></Content>
</xml>`;
