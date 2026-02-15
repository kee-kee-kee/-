
export const speak = (text: string): Promise<void> => {
  return new Promise((resolve) => {
    if (!window.speechSynthesis) {
      console.warn("Speech Synthesis not supported");
      resolve();
      return;
    }

    // 既存の読み上げをキャンセル
    window.speechSynthesis.cancel();

    if (!text || text.trim().length === 0) {
      resolve();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ja-JP';
    utterance.rate = 1.1;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    // ブラウザのフリーズ防止用タイムアウト（10秒）
    const timeout = setTimeout(() => {
      console.warn("Speech synthesis timeout: forcing resolve");
      window.speechSynthesis.cancel();
      resolve();
    }, 10000);

    utterance.onend = () => {
      clearTimeout(timeout);
      resolve();
    };

    utterance.onerror = (e) => {
      console.error("Speech synthesis error:", e);
      clearTimeout(timeout);
      resolve();
    };

    window.speechSynthesis.speak(utterance);
    
    // 一部のブラウザで必要な手動再開
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }
  });
};
