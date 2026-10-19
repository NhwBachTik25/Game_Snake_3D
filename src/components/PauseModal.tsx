import React from 'react';
import { Play, RotateCcw, Volume2, VolumeX, Music, Home } from 'lucide-react';

interface PauseModalProps {
  onResume: () => void;
  onRestart: () => void;
  onMainMenu: () => void;
  isMuted: boolean;
  isMusicEnabled: boolean;
  onToggleMute: () => void;
  onToggleMusic: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  onResume,
  onRestart,
  onMainMenu,
  isMuted,
  isMusicEnabled,
  onToggleMute,
  onToggleMusic,
}) => {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-slate-950/90 border border-cyan-500/30 rounded-2xl p-6 shadow-2xl flex flex-col items-center text-center">
        <h2 className="font-['Orbitron'] text-2xl font-black text-cyan-300 tracking-wider mb-1">
          SIMULATION PAUSED
        </h2>
        <p className="text-xs text-slate-400 font-mono mb-6">Press [ESC] or [P] to Resume</p>

        <div className="w-full flex flex-col gap-2.5 mb-6">
          <button
            onClick={onResume}
            className="w-full py-2.5 px-4 rounded-xl font-['Orbitron'] font-bold text-xs uppercase tracking-wider text-slate-950 bg-cyan-400 hover:bg-cyan-300 transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <Play className="w-4 h-4 fill-slate-950" />
            Resume
          </button>

          <button
            onClick={onRestart}
            className="w-full py-2.5 px-4 rounded-xl font-['Orbitron'] font-bold text-xs uppercase tracking-wider text-slate-200 bg-slate-900 hover:bg-slate-800 border border-white/10 transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4 text-cyan-400" />
            Restart Mission
          </button>

          <button
            onClick={onMainMenu}
            className="w-full py-2.5 px-4 rounded-xl font-['Orbitron'] font-bold text-xs uppercase tracking-wider text-slate-400 hover:text-white bg-transparent hover:bg-slate-900 border border-transparent hover:border-white/5 transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <Home className="w-4 h-4" />
            Main Menu
          </button>
        </div>

        {/* Audio Toggles in Pause */}
        <div className="flex items-center gap-4 text-xs font-mono text-slate-400 border-t border-white/10 pt-4 w-full justify-center">
          <button
            onClick={onToggleMusic}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-colors ${
              isMusicEnabled
                ? 'border-cyan-500/30 text-cyan-300 bg-cyan-950/40'
                : 'border-white/5 text-slate-500'
            }`}
          >
            <Music className="w-3.5 h-3.5" />
            <span>Music: {isMusicEnabled ? 'ON' : 'OFF'}</span>
          </button>

          <button
            onClick={onToggleMute}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-colors ${
              !isMuted
                ? 'border-cyan-500/30 text-cyan-300 bg-cyan-950/40'
                : 'border-rose-500/30 text-rose-400 bg-rose-950/40'
            }`}
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            <span>SFX: {!isMuted ? 'ON' : 'MUTED'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
