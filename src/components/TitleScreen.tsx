import React from 'react';
import { Play, Shield, Flame, Skull, Sparkles, Clock, AlertTriangle } from 'lucide-react';

export type Difficulty = 'chill' | 'arcade' | 'hardcore';

interface TitleScreenProps {
  highScore: number;
  difficulty: Difficulty;
  onSelectDifficulty: (d: Difficulty) => void;
  onStartGame: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  highScore,
  difficulty,
  onSelectDifficulty,
  onStartGame,
}) => {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-[2px]">
      <div className="w-full max-w-xl bg-slate-950/85 border border-cyan-500/30 rounded-2xl p-6 md:p-8 shadow-2xl shadow-cyan-950/50 flex flex-col items-center text-center">
        {/* Title Lockup */}
        <div className="mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/60 border border-cyan-500/20 text-cyan-300 text-xs font-mono mb-3">
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            SYNTHWAVE 3D ARENA
          </div>
          <h1 className="font-['Orbitron'] text-4xl md:text-5xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-b from-white via-cyan-200 to-cyan-500 drop-shadow-[0_0_25px_rgba(14,240,228,0.4)]">
            CYBER SERPENT
          </h1>
          <p className="text-slate-400 text-xs md:text-sm mt-2 max-w-md font-sans">
            Navigate a holographic grid arena in deep cosmos with post-processing bloom, multi-cam chase angles, and synth soundscapes.
          </p>
        </div>

        {/* High Score Record */}
        {highScore > 0 && (
          <div className="flex items-center gap-2 text-xs font-mono text-amber-400 bg-amber-950/30 border border-amber-500/20 rounded-lg px-3 py-1 mb-6">
            <span>HIGH SCORE RECORD:</span>
            <span className="font-bold text-amber-300 tabular-nums">
              {highScore.toLocaleString()}
            </span>
          </div>
        )}

        {/* Difficulty Selection */}
        <div className="w-full mb-6 text-left">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2 font-mono text-center">
            Select Difficulty
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => onSelectDifficulty('chill')}
              className={`flex flex-col items-center p-3 rounded-xl border transition-all text-center ${
                difficulty === 'chill'
                  ? 'bg-cyan-950/60 border-cyan-400 text-cyan-300 shadow-md shadow-cyan-900/30'
                  : 'bg-slate-900/60 border-white/5 text-slate-400 hover:text-slate-200 hover:border-white/10'
              }`}
            >
              <Shield className="w-5 h-5 mb-1 text-cyan-400" />
              <span className="text-xs font-bold font-['Orbitron']">CHILL</span>
              <span className="text-[10px] text-slate-400 mt-0.5">Slow & No Hazards</span>
            </button>

            <button
              onClick={() => onSelectDifficulty('arcade')}
              className={`flex flex-col items-center p-3 rounded-xl border transition-all text-center ${
                difficulty === 'arcade'
                  ? 'bg-amber-950/60 border-amber-400 text-amber-300 shadow-md shadow-amber-900/30'
                  : 'bg-slate-900/60 border-white/5 text-slate-400 hover:text-slate-200 hover:border-white/10'
              }`}
            >
              <Flame className="w-5 h-5 mb-1 text-amber-400" />
              <span className="text-xs font-bold font-['Orbitron']">ARCADE</span>
              <span className="text-[10px] text-slate-400 mt-0.5">Classic + Laser Pylons</span>
            </button>

            <button
              onClick={() => onSelectDifficulty('hardcore')}
              className={`flex flex-col items-center p-3 rounded-xl border transition-all text-center ${
                difficulty === 'hardcore'
                  ? 'bg-rose-950/60 border-rose-400 text-rose-300 shadow-md shadow-rose-900/30'
                  : 'bg-slate-900/60 border-white/5 text-slate-400 hover:text-slate-200 hover:border-white/10'
              }`}
            >
              <Skull className="w-5 h-5 mb-1 text-rose-400" />
              <span className="text-xs font-bold font-['Orbitron']">HARDCORE</span>
              <span className="text-[10px] text-slate-400 mt-0.5">Hyper-Speed & Deadly</span>
            </button>
          </div>
        </div>

        {/* Orbs / Power-ups Guide */}
        <div className="w-full bg-slate-900/40 border border-white/5 rounded-xl p-3 mb-6 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-left">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-cyan-400 shrink-0" />
            <div>
              <div className="font-semibold text-cyan-300">Cyan Core</div>
              <div className="text-slate-400 text-[10px]">+10 pts / Grow</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-amber-400 shrink-0" />
            <div>
              <div className="font-semibold text-amber-300">Supernova</div>
              <div className="text-slate-400 text-[10px]">+50 pts / 2x Multi</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-purple-400 shrink-0" />
            <div>
              <div className="font-semibold text-purple-300">Chrono Gem</div>
              <div className="text-slate-400 text-[10px]">Slow Motion</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-rose-500 shrink-0" />
            <div>
              <div className="font-semibold text-rose-300">Plasma Pylon</div>
              <div className="text-slate-400 text-[10px]">Avoid Lasers</div>
            </div>
          </div>
        </div>

        {/* Primary Start CTA */}
        <button
          onClick={onStartGame}
          className="w-full py-3.5 px-6 rounded-xl font-['Orbitron'] font-black text-sm tracking-wider uppercase text-slate-950 bg-gradient-to-r from-cyan-400 via-teal-300 to-cyan-400 hover:from-cyan-300 hover:to-teal-200 transition-all shadow-lg shadow-cyan-500/30 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
        >
          <Play className="w-4 h-4 fill-slate-950" />
          START GAME [ENTER]
        </button>

        <div className="text-[11px] text-slate-400 mt-4 font-mono">
          Interactive AI Demo Running in Background · Press Enter to Take Control
        </div>
      </div>
    </div>
  );
};
