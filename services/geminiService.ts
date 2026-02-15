
import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import { Question, VideoSource } from "../types";

export interface GenerationResult {
  questions: Question[];
  actualTranscript: string;
  start_time: number;
  end_time: number;
  groundingSources?: any[];
}

/**
 * Robustly handles various YouTube URL formats to extract the video ID.
 */
export const extractYoutubeId = (url: string): string | null => {
  if (!url) return null;
  const trimmed = url.trim();
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|shorts\/|&v=)([^#&?]*).*/;
  const match = trimmed.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
};

/**
 * Helper to convert a Blob URL or file to a base64 string for API submission
 */
const fileToBase64 = async (url: string): Promise<{ data: string; mimeType: string }> => {
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64data = (reader.result as string).split(',')[1];
      resolve({ data: base64data, mimeType: blob.type });
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export const generateQuestionsForPart = async (
  partLabel: string,
  type: 'lecture' | 'discussion',
  videoSource: VideoSource
): Promise<GenerationResult> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      actualTranscript: {
        type: Type.STRING,
        description: "A summary of the video content in Japanese.",
      },
      start_time: {
        type: Type.INTEGER,
        description: "Start time in seconds.",
      },
      end_time: {
        type: Type.INTEGER,
        description: "End time in seconds.",
      },
      questions: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            question_id: { type: Type.INTEGER },
            type: { type: Type.STRING },
            question_text: { type: Type.STRING, description: "Question text in English." },
            choices: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Four choices in English."
            },
            correct_answer: { type: Type.STRING, description: "The correct choice text in English." },
            listening_point: { type: Type.STRING, description: "Explanation of why this is the answer in Japanese." },
            score: { type: Type.INTEGER },
          },
          required: ["question_id", "question_text", "choices", "correct_answer", "listening_point", "score", "type"],
        },
      },
    },
    required: ["actualTranscript", "start_time", "end_time", "questions"],
  };

  const systemInstruction = `あなたは東京大学の英語入試（リスニング）作成委員です。
提供されたメディアを分析し、東大第3問レベルの高度な4択問題を5問作成してください。

【出力ルール】
- 設問(question_text)と選択肢(choices, correct_answer)は必ず「英語」で作成してください。
- 実際の放送内容のまとめ(actualTranscript)と解説(listening_point)は「日本語」で作成してください。
- 単なる事実確認ではなく、話者の意図、論理的な帰結、抽象的な概念の理解を問う難易度の高い問題を含めてください。`;

  let contents: any;

  if (videoSource.type === 'local') {
    try {
      const { data, mimeType } = await fileToBase64(videoSource.url);
      contents = {
        parts: [
          {
            inlineData: {
              data,
              mimeType: mimeType.includes('video') || mimeType.includes('audio') ? mimeType : 'video/mp4'
            }
          },
          {
            text: `Analyze this media and create English listening questions for Part ${partLabel} (${type}). Ensure the output matches the JSON schema.`
          }
        ]
      };
    } catch (e) {
      console.error("Failed to read local file bytes:", e);
      throw new Error("LOCAL_FILE_READ_ERROR: ローカルファイルの読み込みに失敗しました。");
    }
  } else {
    const youtubeId = extractYoutubeId(videoSource.url);
    const sourceIdentifier = youtubeId || videoSource.url;
    
    contents = `Analyze Source: ${sourceIdentifier}
Section: Part ${partLabel} (${type})

1. Use Google Search to find the script or core summary of this video.
2. Select a challenging 120-180 second segment.
3. Generate questions in English according to the system instruction and schema.`;
  }

  const timeoutLimit = 240000;
  const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject(new Error("TIMEOUT_ERROR: Analysis took too long.")), timeoutLimit)
  );

  try {
    const apiPromise = ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: contents,
      config: {
        systemInstruction,
        tools: videoSource.type !== 'local' ? [{ googleSearch: {} }] : undefined,
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.1,
      },
    });

    const response = (await Promise.race([apiPromise, timeoutPromise])) as GenerateContentResponse;
    const text = response.text;
    
    if (!text) throw new Error("PARSING_ERROR: Empty response.");

    const result = JSON.parse(text);
    
    return {
      questions: result.questions || [],
      actualTranscript: result.actualTranscript || "",
      start_time: Math.floor(Number(result.start_time) || 0),
      end_time: Math.floor(Number(result.end_time) || 120),
      groundingSources: response.candidates?.[0]?.groundingMetadata?.groundingChunks || []
    };
  } catch (error: any) {
    console.error(`[Part ${partLabel} Failure]`, error);
    throw error;
  }
};
