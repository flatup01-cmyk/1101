// functions/initAdmin.js 【ESM完全対応版】
import admin from 'firebase-admin';

// 既に初期化されているかを確認し、されていなければ初期化する
if (!admin.apps.length) {
  admin.initializeApp();
}

// 初期化済みのadminインスタンスをエクスポートする
export { admin };