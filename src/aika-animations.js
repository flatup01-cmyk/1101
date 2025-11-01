/**
 * AIKA18号のツンデレアニメーション制御
 * ドラゴンボール18号風の表情豊かな反応を実装
 */

/**
 * スコアからAIKA18号の反応タイプを判定
 * @param {Object} scores - 解析スコア
 * @returns {string} - 'good', 'bad', 'average'
 */
export function getAikaReactionType(scores) {
  if (!scores) return 'average'
  
  const { punch_speed = 0, guard_stability = 0, kick_height = 0, core_rotation = 0 } = scores
  
  // 平均スコアを計算
  const avgScore = (punch_speed + guard_stability + kick_height + core_rotation) / 4
  
  // スコア判定
  if (avgScore >= 70) return 'good'      // 良いスコア
  if (avgScore < 40) return 'bad'       // 悪いスコア
  return 'average'                       // 普通のスコア
}

/**
 * スコアに応じたAIKA18号のセリフを取得
 * @param {string} reactionType - 反応タイプ
 * @param {Object} scores - 解析スコア
 * @returns {Object} - { message, animationClass, emotion }
 */
export function getAikaReaction(reactionType, scores = {}) {
  const reactions = {
    good: {
      message: "…別に、悪くはないんじゃない？まぁ、このくらいできて当たり前だけどね。…勘違いしないでよね！",
      animationClass: 'aika-blush',
      emotion: '照れ',
      color: '#ff6b9d',
      borderColor: 'rgba(255, 107, 157, 0.5)'
    },
    bad: {
      message: "はぁ！？何やってんのアンタ！こんなんじゃ話にならないわよ！もっと真面目にやりなさい！このバカチンが！",
      animationClass: 'aika-angry',
      emotion: '怒り',
      color: '#ff4444',
      borderColor: 'rgba(255, 68, 68, 0.5)'
    },
    average: {
      message: "…まあ、普通ね。まだまだ頑張りなさい。期待してあげるわよ。…別に、期待してるわけじゃないけどね。",
      animationClass: '',
      emotion: '冷静',
      color: '#64c8ff',
      borderColor: 'rgba(100, 200, 255, 0.5)'
    },
    cute: {
      message: "…な、何言ってんのよ…別に、可愛くなんかないし…",
      animationClass: 'aika-shy',
      emotion: '照れ',
      color: '#ff9f9f',
      borderColor: 'rgba(255, 159, 159, 0.5)'
    }
  }
  
  return reactions[reactionType] || reactions.average
}

/**
 * AIKA18号の反応を表示（アニメーション付き）
 * @param {HTMLElement} container - 表示するコンテナ
 * @param {Object} scores - 解析スコア
 * @param {string} customReaction - カスタム反応タイプ（オプション）
 */
export function displayAikaReaction(container, scores = null, customReaction = null) {
  const reactionType = customReaction || (scores ? getAikaReactionType(scores) : 'average')
  const reaction = getAikaReaction(reactionType, scores)
  
  // スコア表示の生成
  let scoreDisplay = ''
  if (scores) {
    const avgScore = Math.round((scores.punch_speed + scores.guard_stability + scores.kick_height + scores.core_rotation) / 4)
    scoreDisplay = `
      <div class="score-display" style="margin-bottom: 15px; padding: 12px; background: rgba(0, 0, 0, 0.3); border-radius: 6px; border: 1px solid ${reaction.borderColor}; font-family: 'Courier New', monospace;">
        <div style="font-size: 0.75rem; color: ${reaction.color}; margin-bottom: 5px; text-align: left;">
          ▸ ANALYSIS COMPLETE
        </div>
        <div style="font-size: 1.2rem; color: ${reaction.color}; font-weight: bold; text-align: center; margin: 10px 0;">
          POWER LEVEL: ${avgScore}
        </div>
        <div style="font-size: 0.7rem; color: #aaa; text-align: left; margin-top: 8px;">
          ▸ Punch: ${scores.punch_speed?.toFixed(1) || '0'} | Guard: ${scores.guard_stability?.toFixed(1) || '0'}<br>
          ▸ Kick: ${scores.kick_height?.toFixed(1) || '0'} | Rotation: ${scores.core_rotation?.toFixed(1) || '0'}
        </div>
      </div>
    `
  }
  
  const html = `
    <div class="aika-message ${reaction.animationClass}" style="padding: 20px; background: rgba(0, 0, 0, 0.4); border-radius: 10px; border: 2px solid ${reaction.borderColor}; font-family: 'Courier New', monospace; position: relative;">
      ${scoreDisplay}
      <div style="font-size: 0.75rem; color: ${reaction.color}; margin-bottom: 10px; text-align: left;">
        ▸ EMOTION: ${reaction.emotion.toUpperCase()}
      </div>
      <div style="font-size: 0.95rem; color: #fff; line-height: 1.8; margin-top: 15px; padding-top: 15px; border-top: 1px solid ${reaction.borderColor};">
        "${reaction.message}"
      </div>
      ${reaction.animationClass === 'aika-blush' ? '<div style="position: absolute; top: 10px; right: 10px; font-size: 1.2rem;">😊</div>' : ''}
      ${reaction.animationClass === 'aika-angry' ? '<div style="position: absolute; top: 10px; right: 10px; font-size: 1.2rem;">💢</div>' : ''}
      ${reaction.animationClass === 'aika-shy' ? '<div style="position: absolute; top: 10px; right: 10px; font-size: 1.2rem;">🥺</div>' : ''}
    </div>
  `
  
  container.innerHTML = html
}

/**
 * AIKA画像にアニメーションクラスを適用
 * @param {string} animationClass - アニメーションクラス名
 * @param {number} duration - アニメーション継続時間（ms）
 */
export function applyAikaImageAnimation(animationClass, duration = 3000) {
  const aikaImage = document.querySelector('.aika-image')
  if (!aikaImage) return
  
  // 既存のアニメーションクラスを削除
  aikaImage.classList.remove('aika-blush', 'aika-angry', 'aika-shy')
  
  // 新しいアニメーションクラスを追加
  if (animationClass) {
    aikaImage.classList.add(animationClass)
    
    // 指定時間後にアニメーションを解除
    if (duration > 0) {
      setTimeout(() => {
        aikaImage.classList.remove(animationClass)
      }, duration)
    }
  }
}

/**
 * スコア結果表示エリアを作成
 */
export function createScoreDisplayArea() {
  const container = document.querySelector('.status')
  if (!container) return null
  
  const scoreArea = document.createElement('div')
  scoreArea.id = 'aika-score-display'
  scoreArea.style.cssText = 'margin-top: 2rem; display: none;'
  container.appendChild(scoreArea)
  
  return scoreArea
}


