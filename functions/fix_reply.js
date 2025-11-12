// 修正用のコードスニペット
if (event.type === 'message' && event.message.type === 'video') {
  const replyToken = event?.replyToken;
  const userId = event?.source?.userId;
  
  console.info('replyToken:', replyToken);
  console.info('userId:', userId);
  
  // すぐ返信（replyTokenがある場合のみ）
  if (replyToken) {
    await fetch('https://api.line.me/v2/bot/message/reply', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`
      },
      body: JSON.stringify({
        replyToken,
        messages: [{ type: 'text', text: '解析中です。少しお待ちください。' }]
      })
    });
    console.info("ユーザーへの受付完了メッセージの送信に成功しました。");
  }
  
  // 以降の処理（動画保存など）は続く...
}
