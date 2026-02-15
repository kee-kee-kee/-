
import React, { useState, useEffect, useRef } from 'react';
import Header from './components/Header';
import ExamPlayer from './components/ExamPlayer';
import ResultView from './components/ResultView';
import { AppMode, ExamData, UserAnswer, ExamSection, AppError, VideoSource } from './types';
import { generateQuestionsForPart } from './services/geminiService';
import { normalizeError, logError, copyErrorToClipboard } from './utils/errorUtils';
import { NARRATIONS, SAMPLE_URLS } from './constants';

type PartStatus = 'waiting' | 'analyzing' | 'completed' | 'error';

interface InputState {
  raw: string;
  source: VideoSource | null;
}

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>('setup');
  const [numParts, setNumParts] = useState(3);
  const [inputs, setInputs] = useState<InputState[]>(Array(3).fill({ raw: '', source: null }));
  const [examData, setExamData] = useState<ExamData | null>(null);
  const [userAnswers, setUserAnswers] = useState<UserAnswer[]>([]);
  const [groundingSources, setGroundingSources] = useState<any[]>([]);
  const [partErrors, setPartErrors] = useState<{ [key: number]: AppError | null }>({});
  const [partStatuses, setPartStatuses] = useState<{ [key: number]: PartStatus }>({});
  const [processingStep, setProcessingStep] = useState<string>("Initializing...");

  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (mode === 'processing') {
      const steps = [
        "Google Searchで動画情報を取得中...",
        "音源のスクリプトを深層解析中...",
        "東大レベルの難解な設問を構成中...",
        "紛らわしい選択肢を設計中...",
        "最終的な模試データを検証中..."
      ];
      let i = 0;
      const interval = setInterval(() => {
        setProcessingStep(steps[i % steps.length]);
        i++;
      }, 7000);
      return () => clearInterval(interval);
    }
  }, [mode]);

  const analyzeUrl = (url: string): VideoSource | null => {
    if (!url) return null;
    const trimmed = url.trim();
    const ytRegExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|shorts\/|&v=)([^#&?]*).*/;
    const ytMatch = trimmed.match(ytRegExp);
    if (ytMatch && ytMatch[2].length === 11) return { type: 'youtube', url: trimmed };
    
    if (trimmed.includes('vimeo.com')) return { type: 'vimeo', url: trimmed };
    
    try {
      new URL(trimmed);
      return { type: 'other', url: trimmed };
    } catch {
      return null;
    }
  };

  const handleInputChange = (idx: number, val: string) => {
    const newInputs = [...inputs];
    newInputs[idx] = { raw: val, source: analyzeUrl(val) };
    setInputs(newInputs);
  };

  const handleFileSelect = (idx: number, file: File | undefined) => {
    if (!file) return;
    const blobUrl = URL.createObjectURL(file);
    const newInputs = [...inputs];
    newInputs[idx] = { 
      raw: file.name, 
      source: { type: 'local', url: blobUrl, originalName: file.name } 
    };
    setInputs(newInputs);
  };

  const handleNumPartsChange = (n: number) => {
    setNumParts(n);
    const newInputs = [...inputs];
    if (n > inputs.length) {
      for (let i = inputs.length; i < n; i++) newInputs.push({ raw: '', source: null });
    } else {
      newInputs.length = n;
    }
    setInputs(newInputs);
  };

  const handleSetSamples = () => {
    const newInputs = inputs.map((_, i) => ({
      raw: SAMPLE_URLS[i] || SAMPLE_URLS[0],
      source: analyzeUrl(SAMPLE_URLS[i] || SAMPLE_URLS[0])
    }));
    setInputs(newInputs);
  };

  const handleStartProcessing = async () => {
    if (inputs.some(inp => !inp.source)) {
      alert("すべての入力欄に有効なソースを設定してください。");
      return;
    }

    setMode('processing');
    const initialStatuses: { [key: number]: PartStatus } = {};
    const initialErrors: { [key: number]: AppError | null } = {};
    inputs.forEach((_, i) => {
      initialStatuses[i] = 'analyzing';
      initialErrors[i] = null;
    });
    setPartStatuses(initialStatuses);
    setPartErrors(initialErrors);

    const labels = ["A", "B", "C", "D", "E"];
    const processPromises = inputs.map(async (inp, i) => {
      const label = labels[i];
      const type = (i % 2 === 0) ? 'lecture' : 'discussion';
      try {
        const res = await generateQuestionsForPart(label, type as any, inp.source!);
        setPartStatuses(prev => ({ ...prev, [i]: 'completed' }));
        return { ...res, label, type, videoSource: inp.source! };
      } catch (e) {
        setPartStatuses(prev => ({ ...prev, [i]: 'error' }));
        const normalized = normalizeError(e, label, 'api');
        setPartErrors(prev => ({ ...prev, [i]: normalized }));
        logError(normalized);
        throw e;
      }
    });

    const results = await Promise.allSettled(processPromises);
    const successfulResults = results
      .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
      .map(r => r.value);

    if (successfulResults.length === 0) {
      setTimeout(() => alert("すべてのパートで生成に失敗しました。詳細を確認してください。"), 500);
      return;
    }

    const sections: ExamSection[] = successfulResults.map(r => ({
      partLabel: r.label,
      type: r.type,
      narration: NARRATIONS.PART_GENERIC(r.label, r.type),
      videoSource: r.videoSource,
      start_time: r.start_time,
      end_time: r.end_time,
      transcript: r.actualTranscript,
      questions: r.questions
    }));

    setExamData({
      exam_id: `EXAM_${Date.now()}`,
      title: "東大英語リスニング模試",
      sections
    });
    setGroundingSources(successfulResults.flatMap(r => r.groundingSources || []));
  };

  const resetApp = () => {
    setMode('setup');
    setExamData(null);
    setPartErrors({});
    setPartStatuses({});
  };

  return (
    <div className="min-h-screen flex flex-col font-sans bg-slate-950 text-slate-100 selection:bg-blue-500/30">
      <Header />
      <main className="flex-grow">
        {mode === 'setup' && (
          <div className="max-w-4xl mx-auto px-6 py-12">
            <div className="text-center mb-16 animate-in fade-in slide-in-from-top-4 duration-700">
              <h2 className="text-6xl font-black text-white mb-6 tracking-tighter italic">UTokyo AI Listening</h2>
              <p className="text-slate-400 font-medium text-lg">YouTube & ローカル動画から「東大形式」試験を構築</p>
            </div>

            <div className="bg-slate-900/50 backdrop-blur-xl rounded-[3rem] shadow-2xl p-8 md:p-14 border border-slate-800/50 space-y-12">
              <div className="flex flex-col items-center space-y-6">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Configure Exam Complexity</span>
                <div className="flex p-1.5 bg-slate-950 rounded-[2rem] border border-slate-800">
                  {[1, 2, 3].map(n => (
                    <button
                      key={n}
                      onClick={() => handleNumPartsChange(n)}
                      className={`px-10 py-4 rounded-[1.5rem] font-black transition-all duration-300 ${numParts === n ? 'bg-blue-600 text-white shadow-[0_0_30px_rgba(37,99,235,0.3)] scale-105' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                      {n} {n === 1 ? 'Part' : 'Parts'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-8">
                {inputs.map((inp, i) => (
                  <div key={i} className="group transition-all">
                    <div className="flex items-center justify-between mb-4 px-2">
                      <div className="flex items-center space-x-3">
                        <span className="bg-white text-slate-950 text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-tighter shadow-xl">Part {String.fromCharCode(65 + i)}</span>
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{i % 2 === 0 ? 'Academic' : 'Interaction'}</span>
                      </div>
                      <div className="text-[9px] font-bold text-slate-600 uppercase">Source: {inp.source?.type || 'None'}</div>
                    </div>
                    <div className="flex space-x-3">
                      <input 
                        type="text" 
                        value={inp.raw}
                        onChange={(e) => handleInputChange(i, e.target.value)}
                        placeholder="YouTube URL or Video ID"
                        className="flex-grow px-8 py-5 bg-slate-950 border border-slate-800 rounded-[2rem] focus:ring-4 focus:ring-blue-600/20 focus:border-blue-500 outline-none font-bold text-slate-100 transition-all placeholder:text-slate-700 hover:border-slate-700"
                      />
                      <button 
                        onClick={() => fileInputRefs.current[i]?.click()}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-400 px-6 rounded-[2rem] border border-slate-700 flex items-center justify-center shadow-lg transition-all"
                        title="Local File"
                      >
                        <span className="text-xl">📁</span>
                      </button>
                      <input 
                        type="file" 
                        // Fix: Return void from ref callback to satisfy Ref<HTMLInputElement> type requirement
                        ref={el => { fileInputRefs.current[i] = el; }}
                        className="hidden" 
                        accept="video/*,audio/*"
                        onChange={(e) => handleFileSelect(i, e.target.files?.[0])}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-col space-y-6 pt-4">
                <button 
                  onClick={handleStartProcessing}
                  className="w-full py-7 bg-blue-600 text-white rounded-[2.5rem] font-black text-2xl shadow-[0_20px_60px_rgba(37,99,235,0.2)] hover:bg-blue-500 hover:scale-[1.01] active:scale-95 transition-all duration-300"
                >
                  模試を生成して試験開始
                </button>
                <button 
                  onClick={handleSetSamples}
                  className="text-xs font-black text-slate-600 hover:text-blue-400 transition-all uppercase tracking-[0.3em]"
                >
                  Load Sample YouTube
                </button>
              </div>
            </div>
          </div>
        )}

        {mode === 'processing' && (
          <div className="min-h-[80vh] flex flex-col items-center justify-center p-6">
            <div className="relative mb-16">
              <div className="w-40 h-40 border-[16px] border-slate-900 border-t-blue-600 rounded-full animate-spin shadow-2xl"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                 <div className="w-20 h-20 bg-slate-950 rounded-full flex items-center justify-center border border-slate-800 shadow-inner">
                    <span className="text-blue-500 font-black text-2xl animate-pulse italic">AI</span>
                 </div>
              </div>
            </div>
            <h2 className="text-5xl font-black text-white mb-4 tracking-tighter italic">Source Intelligence</h2>
            <p className="text-blue-400 font-bold mb-12 animate-pulse tracking-widest uppercase text-xs">{processingStep}</p>
            
            <div className="w-full max-md space-y-5">
              {inputs.map((_, i) => (
                <div key={i} className={`bg-slate-900 border rounded-[2rem] p-7 shadow-2xl transition-all duration-500 ${partStatuses[i] === 'error' ? 'border-red-900/50 bg-red-950/10' : 'border-slate-800'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-black text-slate-500 uppercase tracking-widest text-xs">PART {String.fromCharCode(65 + i)}</span>
                    <span className={`text-[10px] font-black tracking-[0.2em] px-3 py-1 rounded-full ${partStatuses[i] === 'completed' ? 'bg-green-600/20 text-green-400' : partStatuses[i] === 'error' ? 'bg-red-600/20 text-red-400' : 'bg-blue-600/20 text-blue-400 animate-pulse'}`}>
                      {partStatuses[i] === 'completed' ? 'READY' : partStatuses[i] === 'error' ? 'ERROR' : 'PROCESSING'}
                    </span>
                  </div>
                  {partErrors[i] && (
                    <div className="mt-4 p-4 bg-red-950/30 rounded-2xl border border-red-900/50 text-[10px] text-red-400 font-bold leading-relaxed">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
                          <span>{partErrors[i]?.message}</span>
                        </div>
                        <button onClick={() => copyErrorToClipboard(partErrors[i]!)} className="text-[8px] bg-red-900/30 hover:bg-red-900/50 px-2 py-1 rounded transition-all">COPY</button>
                      </div>
                      <p className="opacity-50 mt-1 font-medium pl-3.5 italic break-words">{partErrors[i]?.detail}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-16 flex flex-col items-center space-y-6">
              {examData && (
                <button onClick={() => setMode('exam')} className="px-16 py-6 bg-white text-slate-950 rounded-[2rem] font-black text-lg shadow-[0_20px_50px_rgba(255,255,255,0.1)] hover:scale-105 transition-all">
                  試験を開始する ({examData.sections.length} Sections)
                </button>
              )}
              <button onClick={resetApp} className="text-[10px] font-black text-slate-600 hover:text-slate-400 uppercase tracking-[0.4em] transition-all">
                Cancel and Restart
              </button>
            </div>
          </div>
        )}

        {mode === 'exam' && examData && (
          <ExamPlayer data={examData} onFinish={(ans) => { setUserAnswers(ans); setMode('results'); }} />
        )}

        {mode === 'results' && examData && (
          <ResultView data={examData} answers={userAnswers} onRestart={resetApp} groundingSources={groundingSources} />
        )}
      </main>
    </div>
  );
};

export default App;
