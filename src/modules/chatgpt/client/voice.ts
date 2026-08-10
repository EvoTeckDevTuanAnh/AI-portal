type RecognitionEvent = { results: ArrayLike<ArrayLike<{ transcript: string }>> };

type Recognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

type RecognitionConstructor = new () => Recognition;

function getRecognitionConstructor(): RecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const scope = window as Window & { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
}

export function listenVietnamese(onListening?: (active: boolean) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const Constructor = getRecognitionConstructor();
    if (!Constructor) {
      reject(new Error("Trình duyệt không hỗ trợ nhận diện giọng nói tiếng Việt"));
      return;
    }
    const recognition = new Constructor();
    recognition.lang = "vi-VN";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    onListening?.(true);
    recognition.onresult = (event) => resolve(String(event.results[0]?.[0]?.transcript || "").trim());
    recognition.onerror = (event) => reject(new Error(event.error === "not-allowed" ? "Bạn chưa cấp quyền microphone" : "Không nhận diện được giọng nói"));
    recognition.onend = () => onListening?.(false);
    recognition.start();
  });
}

function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (typeof window === "undefined") return Promise.resolve([]);
  const existing = window.speechSynthesis.getVoices();
  if (existing.length) return Promise.resolve(existing);
  return new Promise((resolve) => {
    const onVoicesChanged = () => {
      window.speechSynthesis.removeEventListener("voiceschanged", onVoicesChanged);
      resolve(window.speechSynthesis.getVoices());
    };
    window.speechSynthesis.addEventListener("voiceschanged", onVoicesChanged);
    window.setTimeout(() => {
      window.speechSynthesis.removeEventListener("voiceschanged", onVoicesChanged);
      resolve(window.speechSynthesis.getVoices());
    }, 1000);
  });
}

export async function speakVietnamese(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const voices = await loadVoices();
  const vietnameseVoice = voices.find((voice) => /^vi(-|_)/i.test(voice.lang))
    ?? voices.find((voice) => /vietnam|tiếng việt|viet/i.test(`${voice.name} ${voice.lang}`));
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "vi-VN";
  if (vietnameseVoice) utterance.voice = vietnameseVoice;
  utterance.rate = 0.95;
  utterance.pitch = 1;
  window.speechSynthesis.speak(utterance);
}
