#!/usr/bin/env node
/**
 * コード面の重大リスク・不整合検査
 * 10年以上経験のあるエンジニアが国外大手企業で行うレベルのデバッグ観点
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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

const issues = [];

/**
 * ディレクトリを再帰的に探索
 */
function findFiles(dir, extensions, ignoreDirs = []) {
    const files = [];
    
    function walk(currentPath) {
        const entries = fs.readdirSync(currentPath, { withFileTypes: true });
        
        for (const entry of entries) {
            const fullPath = path.join(currentPath, entry.name);
            
            // 無視するディレクトリをスキップ
            if (entry.isDirectory()) {
                if (!ignoreDirs.includes(entry.name) && !entry.name.startsWith('.')) {
                    walk(fullPath);
                }
            } else if (entry.isFile()) {
                const ext = path.extname(entry.name);
                if (extensions.includes(ext)) {
                    files.push(fullPath);
                }
            }
        }
    }
    
    walk(dir);
    return files;
}

/**
 * ファイルを読み込んでパターンを検索
 */
function searchPattern(filePath, patterns, description) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const matches = [];
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (const pattern of patterns) {
            if (pattern.test(line)) {
                matches.push({
                    line: i + 1,
                    content: line.trim(),
                    pattern: pattern.toString()
                });
            }
        }
    }
    
    if (matches.length > 0) {
        issues.push({
            file: filePath,
            description,
            matches
        });
    }
    
    return matches;
}

/**
 * 3a. クライアント/サーバー境界の破りチェック
 */
function checkClientServerBoundary() {
    logInfo('3a. クライアント/サーバー境界の破りをチェック...');
    
    const srcDir = path.join(process.cwd(), 'src');
    if (!fs.existsSync(srcDir)) {
        logWarning('srcディレクトリが見つかりません');
        return;
    }
    
    const clientFiles = findFiles(srcDir, ['.ts', '.tsx', '.js', '.jsx'], ['node_modules']);
    
    // firebase-adminのクライアント側インポートをチェック
    const firebaseAdminPatterns = [
        /import.*firebase-admin/,
        /require\(['"]firebase-admin['"]\)/,
        /from ['"]firebase-admin['"]/
    ];
    
    let foundFirebaseAdmin = false;
    for (const file of clientFiles) {
        const matches = searchPattern(file, firebaseAdminPatterns, 'firebase-adminがクライアント側コードからインポートされています');
        if (matches.length > 0) {
            foundFirebaseAdmin = true;
        }
    }
    
    if (!foundFirebaseAdmin) {
        logSuccess('firebase-adminのクライアント側インポートは見つかりませんでした');
    } else {
        logError('firebase-adminがクライアント側コードからインポートされています！');
    }
    
    // @google-cloudパッケージのクライアント側インポートをチェック
    const googleCloudPatterns = [
        /import.*@google-cloud/,
        /require\(['"]@google-cloud/,
        /from ['"]@google-cloud/
    ];
    
    let foundGoogleCloud = false;
    for (const file of clientFiles) {
        const matches = searchPattern(file, googleCloudPatterns, '@google-cloudパッケージがクライアント側コードからインポートされています');
        if (matches.length > 0) {
            foundGoogleCloud = true;
        }
    }
    
    if (!foundGoogleCloud) {
        logSuccess('@google-cloudパッケージのクライアント側インポートは見つかりませんでした');
    } else {
        logError('@google-cloudパッケージがクライアント側コードからインポートされています！');
    }
}

/**
 * 3b. 認証・鍵取り扱いのチェック
 */
function checkAuthAndKeys() {
    logInfo('3b. 認証・鍵取り扱いをチェック...');
    
    const allFiles = findFiles(process.cwd(), ['.ts', '.tsx', '.js', '.jsx', '.py'], ['node_modules', '.git', 'dist', '.next']);
    
    // サービスアカウントJSONのログ出力をチェック
    const credentialLogPatterns = [
        /console\.log.*GOOGLE_APPLICATION_CREDENTIALS_JSON/,
        /console\.log.*credentials/,
        /logger\.(info|debug|error).*GOOGLE_APPLICATION_CREDENTIALS_JSON/,
        /print.*GOOGLE_APPLICATION_CREDENTIALS_JSON/
    ];
    
    let foundCredentialLog = false;
    for (const file of allFiles) {
        const matches = searchPattern(file, credentialLogPatterns, 'サービスアカウントJSONがログに出力される可能性があります');
        if (matches.length > 0) {
            foundCredentialLog = true;
        }
    }
    
    if (!foundCredentialLog) {
        logSuccess('サービスアカウントJSONのログ出力は見つかりませんでした');
    } else {
        logError('サービスアカウントJSONがログに出力される可能性があります！');
    }
    
    // assertEnvの実装をチェック（ビルド時に落ちるようなチェックがないか）
    const assertEnvPatterns = [
        /assertEnv.*process\.env/,
        /if\s*\(!process\.env\./
    ];
    
    let foundAssertEnv = false;
    for (const file of allFiles) {
        const matches = searchPattern(file, assertEnvPatterns, 'assertEnvの実装を確認してください');
        if (matches.length > 0) {
            foundAssertEnv = true;
        }
    }
    
    if (foundAssertEnv) {
        logWarning('assertEnvの実装を確認してください（ビルド時に落ちるようなチェックがないか）');
    }
}

/**
 * 3c. 非推奨APIの排除チェック
 */
function checkDeprecatedAPI() {
    logInfo('3c. 非推奨APIの使用をチェック...');
    
    const allFiles = findFiles(process.cwd(), ['.ts', '.tsx', '.js', '.jsx', '.py'], ['node_modules', '.git', 'dist', '.next']);
    
    // VideoIntelligenceServiceClientの初期化パターンをチェック
    const videoIntelligencePatterns = [
        /VideoIntelligenceServiceClient\s*\(\s*\{/,
        /VideoIntelligenceServiceClient\s*\(\s*\{[^}]*credentials\s*:/
    ];
    
    let foundVideoIntelligence = false;
    for (const file of allFiles) {
        const matches = searchPattern(file, videoIntelligencePatterns, 'VideoIntelligenceServiceClientの初期化を確認してください');
        if (matches.length > 0) {
            foundVideoIntelligence = true;
        }
    }
    
    if (foundVideoIntelligence) {
        logWarning('VideoIntelligenceServiceClientの初期化を確認してください（GoogleAuthを使用する必要があります）');
    }
    
    // StorageClientの初期化パターンをチェック
    const storagePatterns = [
        /StorageClient\s*\(\s*\{/,
        /StorageClient\s*\(\s*\{[^}]*credentials\s*:/
    ];
    
    let foundStorage = false;
    for (const file of allFiles) {
        const matches = searchPattern(file, storagePatterns, 'StorageClientの初期化を確認してください');
        if (matches.length > 0) {
            foundStorage = true;
        }
    }
    
    if (foundStorage) {
        logWarning('StorageClientの初期化を確認してください（GoogleAuthを使用する必要があります）');
    }
}

/**
 * 3d. 型定義・ビルドの健全性
 */
function checkTypeSafety() {
    logInfo('3d. 型定義・ビルドの健全性を確認...');
    
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
        logWarning('package.jsonが見つかりません');
        return;
    }
    
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    
    if (packageJson.scripts && packageJson.scripts['type-check']) {
        logInfo('type-checkスクリプトを実行...');
        try {
            execSync('npm run type-check', { stdio: 'inherit', cwd: process.cwd() });
            logSuccess('型チェックが成功しました');
        } catch (error) {
            logError('型チェックでエラーが発生しました');
        }
    } else {
        logWarning('type-checkスクリプトが見つかりません');
    }
}

/**
 * メイン実行
 */
function main() {
    log('\n========================================');
    log('コード面の重大リスク・不整合検査');
    log('========================================\n');
    
    checkClientServerBoundary();
    checkAuthAndKeys();
    checkDeprecatedAPI();
    checkTypeSafety();
    
    // 問題のサマリー
    if (issues.length > 0) {
        log('\n========================================');
        log('発見された問題のサマリー');
        log('========================================\n');
        
        for (const issue of issues) {
            logError(`${issue.file}: ${issue.description}`);
            for (const match of issue.matches) {
                log(`  Line ${match.line}: ${match.content}`);
            }
            log('');
        }
    } else {
        logSuccess('重大な問題は見つかりませんでした');
    }
}

main();

