# 🚀 Netlify再デプロイガイド

## ✅ 推奨方法: Netlify Consoleから再デプロイ

環境変数を更新した後、**Netlify Consoleから再デプロイ**するのが最も簡単です。

### ステップ1: Netlify Consoleにアクセス

1. https://app.netlify.com/ にアクセス
2. サイト「aika18」を選択

### ステップ2: 再デプロイを実行

1. **「Deploys」タブを開く**
   - 左側のメニューから「Deploys」をクリック

2. **「Trigger deploy」ボタンをクリック**
   - ページ右上にある「Trigger deploy」ボタン

3. **「Deploy site」を選択**
   - ドロップダウンメニューから「Deploy site」を選択

4. **デプロイ完了を待つ**
   - 約2-3分で完了します
   - 「Published」と表示されたら完了

### ステップ3: 動作確認

デプロイ完了後：
1. シークレットモードで開く: `https://aika18.netlify.app?dev=true`
2. F12でコンソールを確認

---

## 🔄 代替方法: Gitから再デプロイ

コードを変更した場合や、Gitから再デプロイしたい場合：

```bash
# 空のコミットを作成（環境変数の反映のみ）
git commit --allow-empty -m "環境変数反映のための再デプロイ"

# GitHubにpush
git push
```

**注意**: この方法でも自動デプロイが実行されますが、Netlify Consoleからの方が簡単です。

---

## 💻 方法3: Netlify CLI（通常は不要）

もしターミナルから直接デプロイしたい場合：

```bash
# Netlify CLIをインストール（初回のみ）
npm install -g netlify-cli

# ログイン
netlify login

# デプロイ
netlify deploy --prod
```

**注意**: このプロジェクトはGitHub連携しているため、通常はこの方法は不要です。

---

## 📋 どの方法を選ぶべき？

| 状況 | 推奨方法 |
|------|----------|
| 環境変数を更新しただけ | ✅ Netlify Consoleから再デプロイ |
| コードを変更した | Git commit → push |
| CLIから直接デプロイしたい | Netlify CLI（通常は不要） |

---

**最終更新:** 2025-01-XX  
**状態:** ✅ デプロイ方法説明済み

