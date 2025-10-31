/**
 * テスト用：スコア表示機能
 * 開発環境でAIKA18号の反応をテストするための関数
 */

import { displayAikaReaction, applyAikaImageAnimation } from './aika-animations.js'

/**
 * テスト用スコア表示（開発環境のみ）
 */
export function testAikaReactions() {
  const scoreArea = document.getElementById('aika-score-display')
  if (!scoreArea) return
  
  // テスト用ボタンを作成
  const testButtons = document.createElement('div')
  testButtons.style.cssText = 'margin-top: 1rem; padding: 15px; background: rgba(255,255,255,0.1); border-radius: 8px;'
  testButtons.innerHTML = `
    <h4 style="margin-bottom: 10px; font-size: 0.9rem;">🧪 テスト: AIKA18号の反応</h4>
    <div style="display: flex; gap: 10px; flex-wrap: wrap;">
      <button id="test-good-score" style="padding: 8px 16px; background: #64ff64; border: none; border-radius: 6px; color: #000; font-size: 0.85rem; cursor: pointer;">
        良いスコア
      </button>
      <button id="test-bad-score" style="padding: 8px 16px; background: #ff4444; border: none; border-radius: 6px; color: #fff; font-size: 0.85rem; cursor: pointer;">
        悪いスコア
      </button>
      <button id="test-average-score" style="padding: 8px 16px; background: #64c8ff; border: none; border-radius: 6px; color: #000; font-size: 0.85rem; cursor: pointer;">
        普通のスコア
      </button>
      <button id="test-cute-reaction" style="padding: 8px 16px; background: #ff9f9f; border: none; border-radius: 6px; color: #000; font-size: 0.85rem; cursor: pointer;">
        かわいいと言われた
      </button>
    </div>
  `
  
  const statusDiv = document.querySelector('.status')
  if (statusDiv) {
    statusDiv.appendChild(testButtons)
    
    // イベントリスナー設定
    document.getElementById('test-good-score')?.addEventListener('click', () => {
      const scores = { punch_speed: 85, guard_stability: 90, kick_height: 80, core_rotation: 75 }
      scoreArea.style.display = 'block'
      displayAikaReaction(scoreArea, scores, 'good')
      applyAikaImageAnimation('aika-blush', 5000)
    })
    
    document.getElementById('test-bad-score')?.addEventListener('click', () => {
      const scores = { punch_speed: 25, guard_stability: 30, kick_height: 20, core_rotation: 15 }
      scoreArea.style.display = 'block'
      displayAikaReaction(scoreArea, scores, 'bad')
      applyAikaImageAnimation('aika-angry', 5000)
    })
    
    document.getElementById('test-average-score')?.addEventListener('click', () => {
      const scores = { punch_speed: 55, guard_stability: 50, kick_height: 60, core_rotation: 45 }
      scoreArea.style.display = 'block'
      displayAikaReaction(scoreArea, scores, 'average')
      applyAikaImageAnimation('', 0)
    })
    
    document.getElementById('test-cute-reaction')?.addEventListener('click', () => {
      scoreArea.style.display = 'block'
      displayAikaReaction(scoreArea, null, 'cute')
      applyAikaImageAnimation('aika-shy', 5000)
    })
  }
}

