
import React from 'react';

const Header: React.FC = () => {
  return (
    <header className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-slate-800 px-6 py-4 flex items-center justify-between">
      <div className="flex items-center space-x-2">
        <div className="bg-red-600 text-white font-black px-3 py-1 rounded text-sm tracking-widest shadow-lg shadow-red-900/20">UTokyo</div>
        <h1 className="text-xl font-black text-slate-100 tracking-tight">英語リスニング模試 <span className="text-blue-500 italic">GenAI</span></h1>
      </div>
      <div className="text-[10px] text-slate-500 font-bold hidden md:block uppercase tracking-widest">
        YouTube Powered • 2x Playback • AI Analytics
      </div>
    </header>
  );
};

export default Header;
