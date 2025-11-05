#!/usr/bin/env node
/**
 * 環境変数の整合性を確認・修復するスクリプト
 */

const fs = require('fs');
const path = require('path');

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const RESET = '\x1b[0m';

const log = console.log;
const logInfo = (msg) => log(`${BLUE}[INFO]${RESET} ${msg}`);
const logSuccess = (msg) => log(`${GREEN}[SUCCESS]${RESET} ${msg}`);
const logWarning = (msg) => log(`${YELLOW}[WARNING]${RESET} ${msg}`);
const logError = (msg) => log(`${RED}[ERROR]${RESET} ${msg}`);

/**
 * 環境変数ファイルを読み込む
 */
function loadEnvFile(filePath) {
    if (!fs.existsSync(filePath)) {
        return null;
    }
    
    const content = fs.readFileSync(filePath, 'utf-8');
    const env = {};
    
    for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
            const match = trimmed.match(/^([^=]+)=(.*)$/);
            if (match) {
                const key = match[1].trim();
                let value = match[2].trim();
                
                // 引用符を除去
                if ((value.startsWith('"') && value.endsWith('"')) ||
                    (value.startsWith("'") && value.endsWith("'"))) {
                    value = value.slice(1, -1);
                }
                
                env[key] = value;
            }
        }
    }
    
    return env;
}

/**
 * 環境変数の値を検証
 */
function validateEnvValue(value, key) {
    if (!value || value.trim() === '') {
        return { valid: false, reason: '値が空です' };
    }
    
    // 改行文字のチェック
    if (value.includes('\n') || value.includes('\r')) {
        return { valid: false, reason: '改行文字が含まれています' };
    }
    
    // 全角文字のチェック（キー名のみ）
    if (/[^\x00-\x7F]/.test(key)) {
        return { valid: false, reason: 'キー名に全角文字が含まれています' };
    }
    
    // JSON値の検証（GOOGLE_APPLICATION_CREDENTIALS_JSONの場合）
    if (key === 'GOOGLE_APPLICATION_CREDENTIALS_JSON') {
        try {
            JSON.parse(value);
        } catch (e) {
            return { valid: false, reason: 'JSON形式が無効です' };
        }
    }
    
    return { valid: true };
}

/**
 * 環境変数の整合性を確認
 */
function checkEnvConsistency() {
    log('\n========================================');
    log('環境変数の整合性確認');
    log('========================================\n');
    
    const envLocalPath = path.join(process.cwd(), '.env.local');
    const envPath = path.join(process.cwd(), '.env');
    
    let env = {};
    
    // .env.localを優先
    if (fs.existsSync(envLocalPath)) {
        logInfo('.env.localを読み込みます...');
        env = loadEnvFile(envLocalPath);
    } else if (fs.existsSync(envPath)) {
        logInfo('.envを読み込みます...');
        env = loadEnvFile(envPath);
    } else {
        logWarning('環境変数ファイルが見つかりません');
        return false;
    }
    
    if (!env) {
        logError('環境変数ファイルの読み込みに失敗しました');
        return false;
    }
    
    // 必要な環境変数のリスト
    const requiredVars = [
        'NEXT_PUBLIC_FIREBASE_API_KEY',
        'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
        'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
        'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
        'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
        'NEXT_PUBLIC_FIREBASE_APP_ID',
    ];
    
    const optionalVars = [
        'GOOGLE_APPLICATION_CREDENTIALS_JSON',
        'GOOGLE_PROJECT_ID',
    ];
    
    let allValid = true;
    
    // 必須環境変数のチェック
    logInfo('必須環境変数の確認...');
    for (const key of requiredVars) {
        const value = env[key];
        if (!value) {
            logError(`${key} が設定されていません`);
            allValid = false;
        } else {
            const validation = validateEnvValue(value, key);
            if (validation.valid) {
                logSuccess(`${key} が設定されています`);
            } else {
                logError(`${key} に問題があります: ${validation.reason}`);
                allValid = false;
            }
        }
    }
    
    // オプション環境変数のチェック
    logInfo('\nオプション環境変数の確認...');
    for (const key of optionalVars) {
        const value = env[key];
        if (!value) {
            logWarning(`${key} が設定されていません（オプション）`);
        } else {
            const validation = validateEnvValue(value, key);
            if (validation.valid) {
                logSuccess(`${key} が設定されています`);
            } else {
                logError(`${key} に問題があります: ${validation.reason}`);
                allValid = false;
            }
        }
    }
    
    // 環境変数の読み込み検証（Node.jsでテスト）
    logInfo('\n環境変数の読み込みを検証...');
    try {
        const { execSync } = require('child_process');
        const result = execSync(
            `node --env-file=${envLocalPath} -e "console.log('NEXT_PUBLIC_FIREBASE_API_KEY:', process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? '✓' : '✗')"`,
            { encoding: 'utf-8', cwd: process.cwd() }
        );
        logSuccess('環境変数の読み込み検証が成功しました');
        log(result);
    } catch (error) {
        logWarning('環境変数の読み込み検証でエラーが発生しました（Node.js 20.6.0以上が必要）');
        logWarning(error.message);
    }
    
    return allValid;
}

/**
 * メイン実行
 */
function main() {
    const success = checkEnvConsistency();
    
    if (success) {
        logSuccess('\n✅ すべての環境変数が正常です');
        return 0;
    } else {
        logError('\n❌ 環境変数に問題があります');
        return 1;
    }
}

main();

