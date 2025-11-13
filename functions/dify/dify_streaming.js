import { analyzeVideoBlocking } from './dify.js';

/**
 * Streamingモードの解析が利用できない場合のフォールバック実装。
 * 現時点ではblockingモードと同じ処理を呼び出す。
 *
 * @param {{videoUrl: string, userId: string, conversationId?: string | null}} params
 * @returns {Promise<{answer: string, meta: Record<string, any>, conversation_id: string | null}>}
 */
export async function analyzeVideoStreaming(params) {
  console.warn('analyzeVideoStreaming: streaming未実装のためblockingモードにフォールバックします。');
  return analyzeVideoBlocking(params);
}

