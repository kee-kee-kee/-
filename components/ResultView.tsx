
import React from 'react';
import { ExamData, UserAnswer } from '../types';

interface ResultViewProps {
  data: ExamData;
  answers: UserAnswer[];
  onRestart: () => void;
  groundingSources?: any[];
}

const ResultView: React.FC<ResultViewProps> = ({ data, answers, onRestart, groundingSources }) => {
  const calculateScore = () => {
    let score = 0;
    data.sections.forEach(section => {
      section.questions.forEach(q => {
        const userAns = answers.find(a => a.partLabel === section.partLabel && a.questionId === q.question_id);
        if (userAns?.selectedChoice === q.correct_answer) {
          score += q.score;
        }
      });
    });
    return score;
  };

  const totalPossible = data.sections.reduce((acc, s) => acc + s.questions.reduce((qa, q) => qa + q.score, 0), 0);
  const userScore = calculateScore();
  const percentage = (userScore / totalPossible) * 100;

  return (
    <div className="max-w-5xl mx-auto px-4 py-16 animate-in fade-in duration-1000">
      <div className="bg-slate-900/50 backdrop-blur-2xl rounded-[5rem] shadow-[0_50px_100px_rgba(0,0,0,0.5)] overflow-hidden mb-16 border border-slate-800/50">
        <div className="bg-slate-950 px-10 py-24 text-center text-white relative overflow-hidden">
          <div className="absolute top-0 left-0 w-[40rem] h-[40rem] bg-blue-600/10 rounded-full -ml-80 -mt-80 blur-[120px] animate-pulse"></div>
          <div className="absolute bottom-0 right-0 w-[30rem] h-[30rem] bg-indigo-600/5 rounded-full -mr-60 -mb-60 blur-[100px]"></div>
          
          <h2 className="text-xs font-black mb-10 uppercase tracking-[0.5em] text-slate-600">Final Assessment Matrix</h2>
          <div className="text-[12rem] leading-none font-black mb-10 tabular-nums tracking-tighter italic drop-shadow-[0_20px_50px_rgba(0,0,0,1)]">
            {userScore}
            <span className="text-3xl font-medium text-slate-800 ml-6 tracking-normal not-italic">/ {totalPossible}</span>
          </div>
          <div className="inline-flex items-center px-12 py-5 bg-slate-900/80 rounded-full text-lg font-black backdrop-blur-xl border border-white/5 shadow-2xl">
            <span className="mr-6 text-blue-500 uppercase tracking-widest text-xs">Achievement Rate</span>
            <span className="text-3xl tabular-nums italic">{percentage.toFixed(1)}%</span>
          </div>
        </div>

        <div className="p-10 md:p-24 space-y-32">
          {data.sections.map(section => (
            <div key={section.partLabel} className="animate-in fade-in slide-in-from-bottom-8 duration-1000">
              <div className="flex items-center space-x-8 mb-12">
                <div className="bg-white text-slate-950 font-black px-8 py-3 rounded-2xl text-[10px] uppercase tracking-[0.3em] shadow-[0_10px_30px_rgba(255,255,255,0.1)]">PART {section.partLabel}</div>
                <h3 className="text-5xl font-black text-white tracking-tighter leading-none italic">{section.type === 'lecture' ? 'Academic' : 'Interaction'}</h3>
              </div>
              
              <div className="bg-slate-950/50 rounded-[3rem] p-12 mb-16 border border-slate-800/50 relative group">
                <h4 className="text-[10px] font-black text-slate-600 uppercase tracking-[0.4em] mb-6 flex items-center">
                  <span className="w-2 h-2 bg-blue-600 rounded-full mr-4 shadow-[0_0_10px_rgba(37,99,235,1)]"></span> Content Intelligence
                </h4>
                <p className="text-slate-400 leading-relaxed text-xl font-medium italic relative z-10 selection:bg-white/10">
                  "{section.transcript}"
                </p>
              </div>

              <div className="space-y-12">
                {section.questions.map((q, idx) => {
                  const userAns = answers.find(a => a.partLabel === section.partLabel && a.questionId === q.question_id);
                  const isCorrect = userAns?.selectedChoice === q.correct_answer;
                  return (
                    <div key={idx} className={`rounded-[4rem] p-12 border-2 transition-all duration-700 ${isCorrect ? 'bg-slate-900/30 border-green-900/30 shadow-[0_20px_50px_rgba(0,0,0,0.3)]' : 'bg-slate-900/30 border-red-900/30 shadow-[0_20px_50px_rgba(0,0,0,0.3)]'}`}>
                      <div className="flex items-center justify-between mb-12">
                        <div className="font-black text-slate-700 uppercase text-[12px] tracking-[0.4em]">Question Module {idx + 1}</div>
                        <div className={`flex items-center px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-[0.3em] ${isCorrect ? 'bg-green-600/10 text-green-500 border border-green-500/20' : 'bg-red-600/10 text-red-500 border border-red-500/20'}`}>
                          {isCorrect ? 'VALID ✅' : 'INVALID ❌'}
                        </div>
                      </div>
                      <p className="text-3xl font-black text-white mb-16 leading-tight tracking-tighter italic">{q.question_text}</p>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-14">
                        <div className={`p-10 rounded-[3rem] border-2 flex flex-col justify-center transition-all ${isCorrect ? 'bg-green-600/5 border-green-500/10 text-green-100' : 'bg-red-600/5 border-red-500/10 text-red-100'}`}>
                          <div className="text-[10px] font-black uppercase opacity-30 mb-4 tracking-[0.3em]">Your Signal</div>
                          <div className="font-bold text-xl leading-tight italic">{userAns?.selectedChoice || 'SILENCE'}</div>
                        </div>
                        {!isCorrect && (
                          <div className="p-10 rounded-[3rem] border-2 bg-green-600/5 border-green-500/10 text-green-400 flex flex-col justify-center">
                            <div className="text-[10px] font-black uppercase opacity-30 mb-4 tracking-[0.3em]">Correct Frequency</div>
                            <div className="font-bold text-xl leading-tight italic">{q.correct_answer}</div>
                          </div>
                        )}
                      </div>

                      <div className="bg-slate-950 p-10 rounded-[3rem] border border-slate-800 shadow-inner">
                        <h4 className="font-black text-slate-600 text-[10px] mb-5 flex items-center uppercase tracking-[0.4em]">
                           Reasoning Logic
                        </h4>
                        <p className="text-slate-400 leading-relaxed text-base font-medium">
                          {q.listening_point}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {groundingSources && groundingSources.length > 0 && (
            <div className="border-t border-slate-800 pt-24 text-center">
              <h3 className="text-[10px] font-black text-slate-700 uppercase tracking-[0.5em] mb-12 flex items-center justify-center">
                Knowledge Source Grounding
              </h3>
              <div className="flex flex-wrap justify-center gap-4">
                {groundingSources.map((chunk: any, i: number) => (
                  chunk.web && (
                    <a key={i} href={chunk.web.uri} target="_blank" rel="noopener noreferrer" className="text-[10px] font-black bg-slate-950 hover:bg-white hover:text-slate-950 transition-all text-slate-500 px-8 py-3 rounded-full border border-slate-800 shadow-2xl">
                      {chunk.web.title || 'Verification Node ' + (i+1)}
                    </a>
                  )
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-center pb-32">
        <button onClick={onRestart} className="px-20 py-7 bg-white text-slate-950 rounded-[2.5rem] font-black text-2xl shadow-[0_30px_80px_rgba(255,255,255,0.1)] hover:scale-105 active:scale-95 transition-all duration-500">
          GENERATE NEW TEST
        </button>
      </div>
    </div>
  );
};

export default ResultView;
