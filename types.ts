
export type QuestionType = 'factual_multiple_choice' | 'opinion_multiple_choice' | 'main_idea_multiple_choice';

export interface Question {
  question_id: number;
  type: QuestionType;
  question_text: string;
  choices: string[];
  correct_answer: string;
  listening_point: string;
  score: number;
}

export type VideoSourceType = 'youtube' | 'vimeo' | 'local' | 'other';

export interface VideoSource {
  type: VideoSourceType;
  url: string;
  originalName?: string;
}

export interface ExamSection {
  partLabel: string; // "A", "B", "C" etc.
  type: 'lecture' | 'discussion';
  narration: string;
  videoSource: VideoSource;
  start_time: number;
  end_time: number;
  transcript: string;
  questions: Question[];
}

export interface ExamData {
  exam_id: string;
  title: string;
  sections: ExamSection[];
}

export type AppMode = 'setup' | 'processing' | 'exam' | 'results';

export interface UserAnswer {
  partLabel: string;
  questionId: number;
  selectedChoice: string;
}

export type AppErrorType = 'INVALID_URL' | 'NETWORK_ERROR' | 'API_ERROR' | 'TIMEOUT_ERROR' | 'PARSING_ERROR' | 'VIDEO_PLAYBACK_ERROR' | 'UNKNOWN_ERROR';

export interface AppError {
  type: AppErrorType;
  message: string;
  detail?: string;
  partLabel?: string;
  step?: 'extract' | 'api' | 'parse' | 'playback';
  timestamp?: string;
  originalError?: unknown;
}
