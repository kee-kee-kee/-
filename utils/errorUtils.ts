
import { AppError, AppErrorType } from '../types';

export function normalizeError(error: any, partLabel?: string, step?: 'extract' | 'api' | 'parse' | 'playback'): AppError {
  const rawMessage = error?.message || String(error);
  const message = rawMessage.toLowerCase();
  
  let type: AppErrorType = 'UNKNOWN_ERROR';
  let userMsg = '予期せぬエラーが発生しました。';

  // 1. Check for timeout first, explicitly
  if (message.includes('timeout') || message.includes('deadline')) {
    type = 'TIMEOUT_ERROR';
    userMsg = 'AIの処理がタイムアウトしました。動画が長すぎるか、サーバーが混雑しています。別の動画を試すか、数分後に再試行してください。';
  } 
  // 2. Resource exhaustion
  else if (message.includes('429') || message.includes('quota') || message.includes('exhausted')) {
    type = 'API_ERROR';
    userMsg = 'AIの利用制限に達しました。数分待ってから再度お試しください。';
  } 
  // 3. Parsing logic
  else if (message.includes('json') || message.includes('parse') || message.includes('unexpected token')) {
    type = 'PARSING_ERROR';
    userMsg = 'AIからの回答データの解析に失敗しました。AIが正しくJSONを生成できなかった可能性があります。';
  } 
  // 4. URL/ID specific errors - only if not already a timeout
  else if (message.includes('invalid') && (message.includes('url') || message.includes('id'))) {
    type = 'INVALID_URL';
    userMsg = 'YouTubeのURLまたはIDが正しくありません。入力内容を確認してください。';
  } 
  // 5. General Network
  else if (message.includes('fetch') || message.includes('network') || message.includes('connection')) {
    type = 'NETWORK_ERROR';
    userMsg = 'ネットワーク接続エラーが発生しました。インターネット接続を確認してください。';
  }

  return {
    type,
    message: userMsg,
    detail: rawMessage,
    partLabel,
    step,
    timestamp: new Date().toISOString(),
    originalError: error
  };
}

export function logError(appError: AppError) {
  console.group(`❌ Error [${appError.type}] at Part ${appError.partLabel || 'N/A'}`);
  console.error('User Message:', appError.message);
  console.error('Detail:', appError.detail);
  console.error('Step:', appError.step);
  console.error('Timestamp:', appError.timestamp);
  console.groupEnd();
}

export function copyErrorToClipboard(error: AppError) {
  const text = `
Error Type: ${error.type}
Message: ${error.message}
Detail: ${error.detail}
Part: ${error.partLabel}
Step: ${error.step}
Timestamp: ${error.timestamp}
  `.trim();
  navigator.clipboard.writeText(text).then(() => {
    alert("エラー詳細をクリップボードにコピーしました。");
  }).catch(err => {
    console.error('Failed to copy error:', err);
  });
}
