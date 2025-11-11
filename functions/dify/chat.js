// functions/dify/chat.js
// Dify APIを使用したテキスト会話処理

import fetch from 'node-fetch';
import admin from 'firebase-admin';
import { requireEnv } from './util.js';

if (!admin.apps.length) {
  admin.initializeApp();
}

const firestore = admin.firestore();

/**
 * Dify APIを使用してテキストメッセージを処理し、AIKA19号の返信を生成
 * 
 * @param {Object} params
 * @param {string} params.userId LINE user ID
 * @param {string} params.userMessage ユーザーのメッセージ
 * @param {string|null} [params.conversationId] 既存の会話ID（会話の継続用）
 * @param {string} [params.userGender] ユーザーの性別（男性/女性/unknown）
 * @returns {Promise<Object>} { answer: string, conversation_id: string }
 */
export async function handleTextChat({
  userId,
  userMessage,
  conversationId = null,
  userGender = 'unknown',
}) {
  if (!userId || !userMessage) {
    throw new Error('userId and userMessage are required');
  }

  const difyApiKey = requireEnv('DIFY_API_KEY');
  const userConversationsRef = firestore.collection('user_conversations').doc(userId);

  // Firestoreから会話IDとユーザー情報を取得（会話の継続性を保つため）
  const userConversationsDoc = await userConversationsRef.get();
  let effectiveConversationId = conversationId;
  let effectiveUserGender = userGender;

  if (userConversationsDoc.exists) {
    const data = userConversationsDoc.data();
    if (!effectiveConversationId) {
      effectiveConversationId = data.conversationId || null;
    }
    if (effectiveUserGender === 'unknown') {
      effectiveUserGender = data.gender || 'unknown';
    }
  }

  // ユーザープロファイルから性別を取得（存在する場合）
  const userProfileRef = firestore.collection('user_profiles').doc(userId);
  const userProfileDoc = await userProfileRef.get();
  if (userProfileDoc.exists && effectiveUserGender === 'unknown') {
    effectiveUserGender = userProfileDoc.data().gender || 'unknown';
  }

  // Dify APIのチャットメッセージエンドポイントを呼び出し
  const difyResponse = await fetch('https://api.dify.ai/v1/chat-messages', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${difyApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: userMessage,
      user: userId,
      response_mode: 'blocking',
      conversation_id: effectiveConversationId, // 会話IDを使用（空の場合は新規会話）
      inputs: {
        user_gender: effectiveUserGender, // 性別情報を追加（男性/女性/unknown）
      },
    }),
  });

  if (!difyResponse.ok) {
    const errorText = await difyResponse.text();
    throw new Error(`Dify API error ${difyResponse.status}: ${errorText}`);
  }

  const difyResult = await difyResponse.json();
  const answer = difyResult.answer || difyResult.text || '...別に、何か用？';
  const newConversationId = difyResult.conversation_id || effectiveConversationId;

  // Firestoreに会話IDを保存（会話の継続性を保つため）
  if (newConversationId) {
    await userConversationsRef.set({
      conversationId: newConversationId,
      gender: effectiveUserGender,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  }

  return {
    answer,
    conversation_id: newConversationId,
    meta: difyResult.meta || {},
  };
}

