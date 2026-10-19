import React from 'react';
import { Camera, Volume2, VolumeX, Music, Pause, Zap, ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react';
import type { CameraMode } from '../game/engine';

interface HUDProps {
  score: number;
  highScore: number;
  combo: number;
  comboMultiplier: number;
  comboTimeRemainingRatio: number;
  stamina: number; // 0 to 100
  isBoosting: boolean;
  level: number;
  cameraMode: CameraMode;
  isMuted: boolean;
  isMusicEnabled: boolean;
  onToggleMute: () => void;
  onToggleMusic: () => void;
  onCycleCamera: () => void;
  onPause: () => void;
  onSteerDirection: (dir: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT') => void;
  onSteerRelative: (turn: 'LEFT' | 'RIGHT') => void;
  onStartBoost: () => void;
  onStopBoost: () => void;
}

export const HUD: React.FC<HUDProps> = ({
  score,
  highScore,
  combo,
  comboMultiplier,
  comboTimeRemainingRatio,
  stamina,
  isBoosting,
  level,
  cameraMode,
  isMuted,
  isMusicEnabled,
  onToggleMute,
  onToggleMusic,
  onCycleCamera,
  onPause,
  onSteerDirection,
  onSteerRelative,
  onStartBoost,
  onStopBoost,
}) => {
  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-2 sm:p-4 md:p-6 select-none z-10">
      {/* Top HUD Bar */}
      <header className="flex items-center justify-between gap-1.5 sm:gap-4 w-full max-w-6xl mx-auto">
        {/* Brand / Title & Level */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 bg-slate-950/85 border border-cyan-500/30 rounded-xl px-2.5 sm:px-4 py-1.5 sm:py-2 shadow-lg shadow-cyan-950/40 pointer-events-auto shrink-0">
          <div className="w-2 h-2 rounded-full bg-cyan-400" />
          <h1 className="font-['Orbitron'] font-black tracking-wider text-xs sm:text-base text-cyan-300">
            <span className="hidden xs:inline">CYBER </span>SERPENT
          </h1>
          <span className="text-slate-600 font-mono text-xs">/</span>
          <span className="text-[11px] sm:text-xs font-mono font-semibold tracking-wide text-slate-300">
            L{level}
          </span>
        </div>

        {/* Center: Score & Combo Meter */}
        <div className="flex flex-col items-center shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-5 bg-slate-950/90 border border-white/10 rounded-xl px-3 sm:px-5 py-1 sm:py-1.5 shadow-2xl pointer-events-auto">
            <div className="flex flex-col items-center">
              <span className="text-[9px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Score
              </span>
              <span className="font-['Orbitron'] text-sm sm:text-xl font-bold text-white tabular-nums">
                {score.toLocaleString()}
              </span>
            </div>

            <div className="w-px h-6 sm:h-8 bg-slate-800" />

            <div className="flex flex-col items-center">
              <span className="text-[9px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Best
              </span>
              <span className="font-['Orbitron'] text-xs sm:text-base font-semibold text-amber-400 tabular-nums">
                {highScore.toLocaleString()}
              </span>
            </div>

            {/* Dynamic Combo Badge */}
            {comboMultiplier > 1 && (
              <>
                <div className="w-px h-6 sm:h-8 bg-slate-800" />
                <div className="flex flex-col items-center">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-cyan-400">
                    Combo
                  </span>
                  <span className="font-['Orbitron'] text-xs sm:text-base font-black text-cyan-300">
                    x{comboMultiplier}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Combo Timer Bar */}
          {comboMultiplier > 1 && (
            <div className="w-32 sm:w-44 h-1 bg-slate-900/90 rounded-full mt-1 overflow-hidden border border-cyan-500/20">
              <div
                className="h-full bg-gradient-to-r from-cyan-400 to-amber-400 transition-all duration-75"
                style={{ width: `${Math.max(0, Math.min(100, comboTimeRemainingRatio * 100))}%` }}
              />
            </div>
          )}
        </div>

        {/* Right: Quick Action Controls */}
        <div className="flex items-center gap-1 sm:gap-2 bg-slate-950/85 border border-white/10 rounded-xl p-1 sm:p-1.5 shadow-lg pointer-events-auto shrink-0">
          {/* Camera View Toggle */}
          <button
            onClick={onCycleCamera}
            className="flex items-center gap-1 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors"
            title="Switch Camera View [C]"
            aria-label={`Switch camera view, currently ${cameraMode}`}
          >
            <Camera className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-400" />
            <span className="hidden sm:inline font-mono">
              {cameraMode === 'ISOMETRIC' ? 'ISO' : cameraMode === 'CHASE' ? 'CHASE' : 'TAC'}
            </span>
          </button>

          {/* Music Toggle */}
          <button
            onClick={onToggleMusic}
            className={`p-1.5 sm:p-2 rounded-lg text-xs transition-colors ${
              isMusicEnabled ? 'text-cyan-400 hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-800'
            }`}
            title="Toggle Ambient Synth Music"
            aria-label="Toggle ambient synth music"
          >
            <Music className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>

          {/* SFX Mute */}
          <button
            onClick={onToggleMute}
            className={`p-1.5 sm:p-2 rounded-lg text-xs transition-colors ${
              !isMuted ? 'text-cyan-400 hover:bg-slate-800' : 'text-rose-400 hover:bg-slate-800'
            }`}
            title="Mute Sound Effects"
            aria-label="Mute sound effects"
          >
            {isMuted ? (
              <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            ) : (
              <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            )}
          </button>

          {/* Pause Button */}
          <button
            onClick={onPause}
            className="p-1.5 sm:p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            title="Pause Game [ESC / P]"
            aria-label="Pause game"
          >
            <Pause className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        </div>
      </header>

      {/* Bottom Center: Boost Stamina Gauge & Controls Helper */}
      <footer className="w-full max-w-xl mx-auto flex flex-col items-center gap-2 mb-2 pointer-events-auto">
        {/* Boost Stamina Bar */}
        <div className="w-full max-w-sm bg-slate-950/80 border border-white/10 rounded-xl px-4 py-2 flex items-center gap-3 shadow-xl">
          <Zap
            className={`w-4 h-4 transition-colors ${
              isBoosting ? 'text-amber-400 animate-bounce' : stamina > 20 ? 'text-cyan-400' : 'text-slate-600'
            }`}
          />
          <div className="flex-1">
            <div className="flex justify-between text-[10px] font-mono mb-1">
              <span className="text-slate-400 uppercase font-semibold">Hyper-Boost [Space/Shift]</span>
              <span className={`tabular-nums ${stamina < 20 ? 'text-rose-400' : 'text-cyan-300'}`}>
                {Math.round(stamina)}%
              </span>
            </div>
            <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden border border-white/5">
              <div
                className={`h-full transition-all duration-75 ${
                  stamina > 40
                    ? 'bg-gradient-to-r from-cyan-500 to-teal-400'
                    : 'bg-gradient-to-r from-amber-500 to-rose-500'
                }`}
                style={{ width: `${Math.max(0, Math.min(100, stamina))}%` }}
              />
            </div>
          </div>
        </div>

        {/* Micro-Keyboard Help (Desktop) */}
        <div className="hidden md:flex items-center gap-3 text-[11px] text-slate-400 bg-slate-950/60 rounded-lg px-3 py-1 font-mono">
          <span>WASD / Arrows: Steer</span>
          <span>·</span>
          <span>Hold Space: Boost</span>
          <span>·</span>
          <span>C: Camera</span>
          <span>·</span>
          <span>ESC: Pause</span>
        </div>

        {/* Mobile On-Screen D-Pad & Boost (visible on small/touch screens) */}
        <div className="flex md:hidden items-center justify-between w-full max-w-sm mt-1 px-2 pointer-events-auto">
          {cameraMode === 'CHASE' ? (
            /* Relative Left/Right Turn Buttons in Chase Cam */
            <div className="flex items-center gap-3">
              <button
                onClick={() => onSteerRelative('LEFT')}
                className="w-14 h-12 bg-slate-900/90 border border-cyan-500/30 rounded-xl flex items-center justify-center text-cyan-300 active:bg-cyan-950"
                aria-label="Turn Left"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <button
                onClick={() => onSteerRelative('RIGHT')}
                className="w-14 h-12 bg-slate-900/90 border border-cyan-500/30 rounded-xl flex items-center justify-center text-cyan-300 active:bg-cyan-950"
                aria-label="Turn Right"
              >
                <ArrowRight className="w-6 h-6" />
              </button>
            </div>
          ) : (
            /* 4-way D-pad in Isometric / Tactical View */
            <div className="grid grid-cols-3 gap-1.5 w-36 h-28">
              <div />
              <button
                onClick={() => onSteerDirection('UP')}
                className="bg-slate-900/90 border border-cyan-500/30 rounded-lg flex items-center justify-center text-cyan-300 active:bg-cyan-950"
                aria-label="Steer Up"
              >
                <ArrowUp className="w-5 h-5" />
              </button>
              <div />
              <button
                onClick={() => onSteerDirection('LEFT')}
                className="bg-slate-900/90 border border-cyan-500/30 rounded-lg flex items-center justify-center text-cyan-300 active:bg-cyan-950"
                aria-label="Steer Left"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => onSteerDirection('DOWN')}
                className="bg-slate-900/90 border border-cyan-500/30 rounded-lg flex items-center justify-center text-cyan-300 active:bg-cyan-950"
                aria-label="Steer Down"
              >
                <ArrowDown className="w-5 h-5" />
              </button>
              <button
                onClick={() => onSteerDirection('RIGHT')}
                className="bg-slate-900/90 border border-cyan-500/30 rounded-lg flex items-center justify-center text-cyan-300 active:bg-cyan-950"
                aria-label="Steer Right"
              >
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* Mobile Boost Touch Button */}
          <button
            onTouchStart={onStartBoost}
            onTouchEnd={onStopBoost}
            onMouseDown={onStartBoost}
            onMouseUp={onStopBoost}
            className={`w-16 h-16 rounded-2xl flex flex-col items-center justify-center border font-['Orbitron'] text-[10px] font-black transition-all ${
              isBoosting
                ? 'bg-amber-500 text-slate-950 border-amber-300 shadow-lg shadow-amber-500/40'
                : stamina > 20
                ? 'bg-cyan-950/80 text-cyan-300 border-cyan-400/40 active:bg-cyan-900'
                : 'bg-slate-900/60 text-slate-600 border-white/5'
            }`}
            aria-label="Boost button"
          >
            <Zap className="w-5 h-5 mb-0.5" />
            BOOST
          </button>
        </div>
      </footer>
    </div>
  );
};
