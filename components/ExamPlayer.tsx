
import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactPlayer from 'react-player';
import { ExamData, UserAnswer } from '../types';
import { speak } from '../services/speechService';
import { NARRATIONS } from '../constants';

interface ExamPlayerProps {
  data: ExamData;
  onFinish: (answers: UserAnswer[]) => void;
}

const ExamPlayer: React.FC<ExamPlayerProps> = ({ data, onFinish }) => {
  const [currentPartIdx, setCurrentPartIdx] = useState(0);
  const [lap, setLap] = useState(1);
  const [status, setStatus] = useState<'ready' | 'narration' | 'playing' | 'waiting' | 'finishing'>('ready');
  const [waitTimer, setWaitTimer] = useState(30);
  const [userAnswers, setUserAnswers] = useState<UserAnswer[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const playerRef = useRef<ReactPlayer>(null);

  const currentSection = data.sections[currentPartIdx];

  const handleAnswer = (questionId: number, choice: string) => {
    setUserAnswers(prev => {
      const filtered = prev.filter(a => !(a.partLabel === currentSection.partLabel && a.questionId === questionId));
      return [...filtered, { partLabel: currentSection.partLabel, questionId, selectedChoice: choice }];
    });
  };

  const executePlaybackStep = useCallback(async (isFirstLap: boolean, sectionIndex: number) => {
    const targetSection = data.sections[sectionIndex];
    if (!targetSection) return;

    setStatus('narration');
    setIsPlaying(false);
    setPlayerReady(false);
    
    try {
      if (isFirstLap) {
        await speak(targetSection.narration);
      } else {
        await speak(NARRATIONS.SECOND_LAP);
      }
    } catch (e) {
      console.warn("Narration failed, skipping to audio:", e);
    }
    
    if (playerRef.current) {
      playerRef.current.seekTo(targetSection.start_time, 'seconds');
    }
    
    setStatus('playing');
    setIsPlaying(true);
    setIsPaused(false);
  }, [data.sections]);

  const finishExam = useCallback(async () => {
    setIsPlaying(false);
    setStatus('finishing');
    try {
      // 終了ナレーション（5秒タイムアウト付きで安全に実行）
      await speak(NARRATIONS.OUTRO);
    } catch (e) {
      console.warn("Outro narration failed:", e);
    } finally {
      // ナレーションの成否に関わらず必ず結果画面へ
      onFinish(userAnswers);
    }
  }, [onFinish, userAnswers]);

  const triggerNext = useCallback(() => {
    setIsPlaying(false);
    if (lap === 1) {
      setStatus('waiting');
      setWaitTimer(30);
    } else {
      if (currentPartIdx < data.sections.length - 1) {
        setCurrentPartIdx(prev => prev + 1);
        setLap(1);
      } else {
        finishExam();
      }
    }
  }, [lap, currentPartIdx, data.sections.length, finishExam]);

  const startExam = async () => {
    setStatus('narration');
    try {
      await speak("試験を開始します。"); 
      await speak(NARRATIONS.INTRO);
    } catch (e) {
      console.warn("Intro narration error:", e);
    }
    executePlaybackStep(true, 0);
  };

  useEffect(() => {
    let interval: any;
    if (status === 'waiting' && !isPaused) {
      interval = setInterval(() => {
        setWaitTimer(prev => {
          if (prev <= 1) {
            setLap(2);
            executePlaybackStep(false, currentPartIdx);
            return 30;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [status, isPaused, executePlaybackStep, currentPartIdx]);

  useEffect(() => {
    if (status !== 'ready' && status !== 'waiting' && status !== 'finishing' && lap === 1) {
      executePlaybackStep(true, currentPartIdx);
    }
  }, [currentPartIdx]);

  const handleProgress = (progress: { playedSeconds: number }) => {
    if (status !== 'playing' || isPaused) return;
    if (currentSection && currentSection.end_time > 0 && progress.playedSeconds >= currentSection.end_time) {
      setIsPlaying(false);
      triggerNext();
    }
  };

  const togglePause = () => {
    setIsPaused(prev => !prev);
    if (window.speechSynthesis) {
      if (isPaused) window.speechSynthesis.resume();
      else window.speechSynthesis.pause();
    }
  };

  const handlePlayerError = (e: any) => {
    console.error("YouTube Playback Error:", e);
    setPlayerError(`再生エラー(153)が発生しました。動画設定または通信環境を確認してください。`);
  };

  if (!currentSection) return null;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 animate-in fade-in duration-700">
      {status === 'ready' && (
        <div className="fixed inset-0 z-[60] bg-slate-950/95 backdrop-blur-xl flex items-center justify-center p-6 text-white">
          <div className="bg-slate-900 p-12 rounded-[4rem] text-center max-w-sm w-full shadow-2xl border-2 border-slate-800 ring-1 ring-white/10">
            <div className="w-28 h-28 bg-slate-800 text-blue-500 rounded-[3rem] flex items-center justify-center mx-auto mb-10 text-6xl shadow-inner animate-pulse">🎧</div>
            <h2 className="text-4xl font-black mb-6 tracking-tighter italic">Ready?</h2>
            <p className="text-slate-500 text-[10px] mb-12 font-black uppercase tracking-[0.4em]">開始すると自動で進行します</p>
            <button onClick={startExam} className="w-full py-6 bg-blue-600 text-white rounded-3xl font-black text-xl hover:bg-blue-500 transition-all shadow-[0_20px_40px_rgba(37,99,235,0.3)]">試験を開始する</button>
          </div>
        </div>
      )}

      {status === 'finishing' && (
        <div className="fixed inset-0 z-[70] bg-slate-950 flex flex-col items-center justify-center p-6 text-white">
           <div className="w-24 h-24 border-8 border-slate-800 border-t-blue-500 rounded-full animate-spin mb-8"></div>
           <h2 className="text-2xl font-black italic">試験結果を集計中...</h2>
           <p className="text-slate-500 mt-4 font-bold text-xs uppercase tracking-widest">Compiling Analytics Data</p>
        </div>
      )}

      <div className="mb-10 bg-slate-900/50 backdrop-blur-md p-8 rounded-[3rem] border border-slate-800 flex items-center justify-between shadow-2xl">
        <div className="flex items-center space-x-6">
          <div className="bg-white text-slate-950 font-black px-6 py-2 rounded-2xl text-[10px] uppercase tracking-[0.2em]">PART {currentSection.partLabel}</div>
          <div className="flex flex-col">
            <span className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">{currentSection.type === 'lecture' ? 'Academic Lecture' : 'Discussion'}</span>
            <span className="text-white font-black text-xl italic tracking-tight">{lap === 1 ? 'First Listening' : 'Second Listening'}</span>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
           {status === 'waiting' && (
             <div className="bg-blue-600/20 px-6 py-3 rounded-2xl border border-blue-500/30 flex items-center space-x-3">
               <span className="text-blue-500 text-[10px] font-black uppercase">Next Lap</span>
               <span className="text-white font-black text-xl tabular-nums italic">{waitTimer}s</span>
             </div>
           )}
           <button 
             onClick={togglePause}
             className="w-12 h-12 flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-white rounded-2xl transition-all"
           >
             {isPaused ? '▶️' : '⏸️'}
           </button>
           <button 
             onClick={finishExam}
             className="px-6 py-3 bg-red-600/20 text-red-500 border border-red-500/30 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all"
           >
             End Now
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
        <div className="space-y-8 relative">
          {/* FIX for Error 153: Player is technically visible but hidden behind the notes UI */}
          <div className="absolute inset-0 z-0 opacity-100 pointer-events-none">
            <ReactPlayer
              ref={playerRef}
              url={currentSection.videoSource.url}
              playing={isPlaying && !isPaused}
              width="100%"
              height="100%"
              onProgress={handleProgress}
              onReady={() => setPlayerReady(true)}
              onError={handlePlayerError}
              config={{
                youtube: { 
                  playerVars: { 
                    origin: window.location.origin,
                    modestbranding: 1,
                    rel: 0
                  } 
                }
              }}
            />
          </div>

          <div className="relative z-10 bg-slate-950/80 aspect-video rounded-[3rem] overflow-hidden border border-slate-800 shadow-2xl flex flex-col items-center justify-center backdrop-blur-md">
            {(!playerReady || status === 'narration') ? (
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin mb-4"></div>
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Synchronizing...</span>
              </div>
            ) : (
              <div className="text-center">
                <div className="text-8xl font-black text-white/10 italic select-none mb-4">ON AIR</div>
                <div className="text-blue-500 text-[10px] font-black uppercase tracking-[0.5em] animate-pulse">Streaming Audio Feed</div>
              </div>
            )}
            
            {playerError && (
              <div className="absolute inset-0 bg-red-950/90 backdrop-blur-md flex items-center justify-center p-8 text-center">
                <div>
                  <div className="text-4xl mb-4">⚠️</div>
                  <p className="text-white font-bold text-sm mb-6">{playerError}</p>
                  <button onClick={() => window.location.reload()} className="px-8 py-3 bg-white text-slate-950 font-black rounded-full text-xs uppercase tracking-widest shadow-xl">Reload App</button>
                </div>
              </div>
            )}
          </div>
          
          <div className="relative z-10 bg-slate-900/30 rounded-[3rem] p-10 border border-slate-800/50 shadow-inner">
             <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-[0.4em] mb-6 flex items-center">
               <span className="w-2 h-2 bg-blue-600 rounded-full mr-4 shadow-[0_0_10px_rgba(37,99,235,1)]"></span> Notes Area
             </h3>
             <textarea 
               className="w-full h-48 bg-transparent border-none focus:ring-0 text-slate-400 font-medium placeholder:text-slate-800 resize-none text-lg"
               placeholder="放送を聞きながらメモを取ってください..."
             ></textarea>
          </div>
        </div>

        <div className="space-y-8 h-[70vh] overflow-y-auto pr-4 custom-scrollbar">
          {currentSection.questions.map((q) => (
            <div key={q.question_id} className="bg-slate-900/50 backdrop-blur-xl rounded-[3rem] p-10 border border-slate-800 shadow-xl">
              <div className="text-[10px] font-black text-slate-600 uppercase tracking-[0.4em] mb-6">Question {q.question_id}</div>
              <p className="text-white font-bold text-xl mb-10 leading-snug italic">{q.question_text}</p>
              <div className="space-y-4">
                {q.choices.map((choice, cIdx) => {
                  const isSelected = userAnswers.find(a => a.partLabel === currentSection.partLabel && a.questionId === q.question_id)?.selectedChoice === choice;
                  return (
                    <button
                      key={cIdx}
                      onClick={() => handleAnswer(q.question_id, choice)}
                      className={`w-full text-left p-6 rounded-2xl font-bold transition-all border-2 ${isSelected ? 'bg-blue-600 border-blue-400 text-white shadow-lg shadow-blue-900/20 scale-[1.02]' : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:bg-slate-900'}`}
                    >
                      <div className="flex items-center">
                        <span className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] mr-4 ${isSelected ? 'bg-white text-blue-600' : 'bg-slate-800 text-slate-600'}`}>{String.fromCharCode(65 + cIdx)}</span>
                        {choice}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ExamPlayer;
