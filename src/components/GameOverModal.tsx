import React from 'react';
import { RotateCcw, Trophy, Flame, Disc, Home } from 'lucide-react';

interface GameOverModalProps {
  score: number;
  highScore: number;
  isNewHighScore: boolean;
  maxCombo: number;
  orbsConsumed: number;
  onRestart: () => void;
  onMainMenu: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  score,
  highScore,
  isNewHighScore,
  maxCombo,
  orbsConsumed,
  onRestart,
  onMainMenu,
}) => {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md">
      <div className="w-full max-w-md bg-slate-950/95 border border-rose-500/40 rounded-2xl p-6 md:p-8 shadow-2xl shadow-rose-950/50 flex flex-col items-center text-center">
        {/* Header Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-950/60 border border-rose-500/30 text-rose-400 text-xs font-mono mb-2">
          HULL INTEGRITY COMPROMISED
        </div>

        <h2 className="font-['Orbitron'] text-3xl md:text-4xl font-black text-rose-400 tracking-wider mb-2">
          SIGNAL TERMINATED
        </h2>

        {isNewHighScore ? (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-400/50 text-amber-300 text-xs font-mono font-bold mb-6">
            <Trophy className="w-4 h-4 text-amber-400" />
            NEW RECORD ACHIEVED!
          </div>
        ) : (
          <p className="text-xs text-slate-400 font-mono mb-6">
            Mission telemetry recorded.
          </p>
        )}

        {/* Stats Grid */}
        <div className="w-full grid grid-cols-2 gap-3 mb-6">
          <div className="bg-slate-900/60 border border-white/5 rounded-xl p-3 flex flex-col items-center">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Final Score
            </span>
            <span className="font-['Orbitron'] text-2xl font-black text-white tabular-nums">
              {score.toLocaleString()}
            </span>
          </div>

          <div className="bg-slate-900/60 border border-white/5 rounded-xl p-3 flex flex-col items-center">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Best Score
            </span>
            <span className="font-['Orbitron'] text-2xl font-black text-amber-400 tabular-nums">
              {highScore.toLocaleString()}
            </span>
          </div>

          <div className="bg-slate-900/60 border border-white/5 rounded-xl p-3 flex flex-col items-center">
            <div className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              <Flame className="w-3.5 h-3.5 text-cyan-400" />
              Max Combo
            </div>
            <span className="font-['Orbitron'] text-lg font-bold text-cyan-300">
              x{maxCombo}
            </span>
          </div>

          <div className="bg-slate-900/60 border border-white/5 rounded-xl p-3 flex flex-col items-center">
            <div className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              <Disc className="w-3.5 h-3.5 text-purple-400" />
              Orbs Collected
            </div>
            <span className="font-['Orbitron'] text-lg font-bold text-purple-300 tabular-nums">
              {orbsConsumed}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="w-full flex flex-col gap-2.5">
          <button
            onClick={onRestart}
            className="w-full py-3.5 px-6 rounded-xl font-['Orbitron'] font-black text-xs md:text-sm tracking-wider uppercase text-slate-950 bg-gradient-to-r from-cyan-400 via-teal-300 to-cyan-400 hover:from-cyan-300 hover:to-teal-200 transition-all shadow-lg shadow-cyan-500/25 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
          >
            <RotateCcw className="w-4 h-4 text-slate-950" />
            PLAY AGAIN [SPACE / ENTER]
          </button>

          <button
            onClick={onMainMenu}
            className="w-full py-2.5 px-4 rounded-xl font-['Orbitron'] font-bold text-xs uppercase tracking-wider text-slate-400 hover:text-white bg-transparent hover:bg-slate-900 border border-transparent hover:border-white/5 transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <Home className="w-4 h-4" />
            Title Menu
          </button>
        </div>
      </div>
    </div>
  );
};
