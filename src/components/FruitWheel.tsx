import React from 'react';
import { BetOption, GamePhase, OPTION_WHEEL_ICONS, WHEEL_SLICES } from '../types/game';

interface FruitWheelProps {
  rotationDeg: number;
  phase: GamePhase;
  countdown: number;
  winningOption: BetOption | null;
  bonusOption: BetOption | null;
}

const SLICE_ANGLE = 360 / 9; // 40 degrees per slice

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  // 0 deg = 12 o'clock (top), increasing clockwise
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function createSlicePath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const start = polarToCartesian(cx, cy, r, endDeg);
  const end = polarToCartesian(cx, cy, r, startDeg);
  const largeArc = endDeg - startDeg <= 180 ? '0' : '1';
  return [
    `M ${cx} ${cy}`,
    `L ${end.x.toFixed(2)} ${end.y.toFixed(2)}`,
    `A ${r} ${r} 0 ${largeArc} 1 ${start.x.toFixed(2)} ${start.y.toFixed(2)}`,
    'Z',
  ].join(' ');
}

// 10 marquee bulb positions around the ornate golden rim matching Screenshot 4
const BULB_ANGLES = [22, 54, 90, 126, 152, 180, 208, 234, 270, 306, 338];

export const FruitWheel: React.FC<FruitWheelProps> = ({
  rotationDeg,
  phase,
  countdown,
  winningOption,
  bonusOption,
}) => {
  const isSpinning = phase === 'SPINNING';
  const isResult = phase === 'RESULT';
  const cx = 161;
  const cy = 161;
  const radius = 161;

  return (
    <>
      {/* Animated golden marquee light bulbs positioned along the golden wheel rim */}
      <div
        className="pointer-events-none absolute left-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{
          top: '39.51%',
          width: '63.6%',
          aspectRatio: '1 / 1',
        }}
        aria-hidden="true"
      >
        {BULB_ANGLES.map((angle, i) => {
          const rad = ((angle - 90) * Math.PI) / 180;
          const x = 50 + 47.4 * Math.cos(rad);
          const y = 50 + 47.4 * Math.sin(rad);
          const animClass = isSpinning
            ? i % 2 === 0
              ? 'wheel-bulb-fast-even'
              : 'wheel-bulb-fast-odd'
            : i % 2 === 0
              ? 'wheel-bulb-even'
              : 'wheel-bulb-odd';
          return (
            <span
              key={angle}
              className={`absolute h-[3.1%] w-[3.1%] rounded-full ${animClass}`}
              style={{
                left: `${x}%`,
                top: `${y}%`,
                background: 'radial-gradient(circle, #ffffff 0%, #fff49c 45%, #f59e0b 100%)',
                boxShadow: '0 0 8px 3px rgba(255, 235, 110, 0.92)',
              }}
            />
          );
        })}
      </div>

      {/* Main Wheel Disc Container aligned precisely inside the golden rim */}
      <div
        className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full overflow-hidden shadow-[inset_0_0_18px_rgba(0,0,0,0.6)]"
        style={{
          top: '39.51%',
          width: '56.1%',
          aspectRatio: '1 / 1',
        }}
      >
        {/* Rotating 9-Slice Wheel Layer */}
        <div
          className="relative h-full w-full will-change-transform"
          style={{
            transform: `rotate(${rotationDeg}deg)`,
          }}
        >
          <svg
            viewBox="0 0 322 322"
            className="h-full w-full block"
            role="img"
            aria-label="Lucky Fruit 9-slice wheel"
          >
            <defs>
              <radialGradient id="slice-plum-grad" cx="50%" cy="50%" r="68%">
                <stop offset="0%" stopColor="#0948B3" />
                <stop offset="62%" stopColor="#0B61D6" />
                <stop offset="100%" stopColor="#084BB5" />
              </radialGradient>
              <radialGradient id="slice-melon-grad" cx="50%" cy="50%" r="68%">
                <stop offset="0%" stopColor="#0E7AE8" />
                <stop offset="60%" stopColor="#1B9BFF" />
                <stop offset="100%" stopColor="#0F7CE8" />
              </radialGradient>
              <radialGradient id="slice-seven-grad" cx="50%" cy="50%" r="68%">
                <stop offset="0%" stopColor="#C119BA" />
                <stop offset="58%" stopColor="#EE38E4" />
                <stop offset="100%" stopColor="#C81BC1" />
              </radialGradient>
              <radialGradient id="wheel-inner-shadow" cx="50%" cy="50%" r="50%">
                <stop offset="76%" stopColor="rgba(0,0,0,0)" />
                <stop offset="94%" stopColor="rgba(0,18,64,0.28)" />
                <stop offset="100%" stopColor="rgba(0,10,45,0.62)" />
              </radialGradient>
            </defs>

            {WHEEL_SLICES.map((slice) => {
              const startDeg = slice.angleDeg - SLICE_ANGLE / 2;
              const endDeg = slice.angleDeg + SLICE_ANGLE / 2;
              const fillUrl =
                slice.option === 'seven'
                  ? 'url(#slice-seven-grad)'
                  : slice.option === 'watermelon'
                    ? 'url(#slice-melon-grad)'
                    : 'url(#slice-plum-grad)';

              return (
                <path
                  key={slice.index}
                  d={createSlicePath(cx, cy, radius, startDeg, endDeg)}
                  fill={fillUrl}
                  stroke="rgba(165, 220, 255, 0.34)"
                  strokeWidth="1.2"
                />
              );
            })}

            {/* Subtle edge depth ring */}
            <circle cx={cx} cy={cy} r={radius} fill="url(#wheel-inner-shadow)" />
          </svg>

          {/* Cropped original PNG icons placed on each of the 9 wheel slices */}
          {WHEEL_SLICES.map((slice) => {
            const rad = ((slice.angleDeg - 90) * Math.PI) / 180;
            // Radius 34.8% from center (matching screenshot fruit placement)
            const xPct = 50 + 34.8 * Math.cos(rad);
            const yPct = 50 + 34.8 * Math.sin(rad);
            const isSeven = slice.option === 'seven';
            const sizePct = isSeven ? '23.5%' : '20.5%';

            return (
              <div
                key={slice.index}
                className="pointer-events-none absolute flex items-center justify-center"
                style={{
                  left: `${xPct}%`,
                  top: `${yPct}%`,
                  width: sizePct,
                  height: sizePct,
                  transform: `translate(-50%, -50%) rotate(${slice.angleDeg}deg)`,
                }}
              >
                <img
                  src={OPTION_WHEEL_ICONS[slice.option]}
                  alt={slice.option}
                  referrerPolicy="no-referrer"
                  draggable={false}
                  className="h-full w-full object-contain drop-shadow-[0_3px_4px_rgba(0,0,0,0.45)]"
                />
              </div>
            );
          })}
        </div>

        {/* Translucent royal purple center glow halo matching Screenshot 4 */}
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            width: '41%',
            height: '41%',
            background:
              'radial-gradient(circle, rgba(22, 8, 56, 0.92) 0%, rgba(72, 22, 128, 0.64) 58%, rgba(118, 42, 185, 0.25) 84%, rgba(255,255,255,0.45) 95%, rgba(255,255,255,0) 100%)',
            boxShadow: 'inset 0 0 12px rgba(255, 220, 255, 0.35)',
          }}
        />

        {/* Stationary Golden V-Shaped 40° Pointer Wedge at 12 o'clock */}
        <svg
          viewBox="0 0 322 322"
          className="pointer-events-none absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="pointer-gold" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFF5A8" />
              <stop offset="45%" stopColor="#F5BD2F" />
              <stop offset="100%" stopColor="#B86B0A" />
            </linearGradient>
            <linearGradient id="pointer-glow-fill" x1="50%" y1="0%" x2="50%" y2="100%">
              <stop offset="0%" stopColor={isResult ? 'rgba(255, 240, 120, 0.42)' : 'rgba(255, 245, 190, 0.14)'} />
              <stop offset="100%" stopColor="rgba(255, 230, 110, 0.02)" />
            </linearGradient>
          </defs>

          {/* Highlighted top slice wedge */}
          <path
            d={createSlicePath(cx, cy, radius - 1, -20, 20)}
            fill="url(#pointer-glow-fill)"
            className={isResult ? 'animate-pulse' : ''}
          />

          {/* Left & right golden V-bars from outer top rim down to center hub */}
          {(() => {
            const leftOuter = polarToCartesian(cx, cy, radius, -20);
            const rightOuter = polarToCartesian(cx, cy, radius, 20);
            const leftInner = polarToCartesian(cx, cy, 31, -20);
            const rightInner = polarToCartesian(cx, cy, 31, 20);
            return (
              <g filter="drop-shadow(0 2px 3px rgba(0,0,0,0.65))">
                <line
                  x1={leftInner.x}
                  y1={leftInner.y}
                  x2={leftOuter.x}
                  y2={leftOuter.y}
                  stroke="#6A3400"
                  strokeWidth="7.5"
                  strokeLinecap="round"
                />
                <line
                  x1={leftInner.x}
                  y1={leftInner.y}
                  x2={leftOuter.x}
                  y2={leftOuter.y}
                  stroke="url(#pointer-gold)"
                  strokeWidth="4.6"
                  strokeLinecap="round"
                />
                <line
                  x1={rightInner.x}
                  y1={rightInner.y}
                  x2={rightOuter.x}
                  y2={rightOuter.y}
                  stroke="#6A3400"
                  strokeWidth="7.5"
                  strokeLinecap="round"
                />
                <line
                  x1={rightInner.x}
                  y1={rightInner.y}
                  x2={rightOuter.x}
                  y2={rightOuter.y}
                  stroke="url(#pointer-gold)"
                  strokeWidth="4.6"
                  strokeLinecap="round"
                />
              </g>
            );
          })()}
        </svg>

        {/* Stationary Center Countdown Hub matching Screenshot 4 */}
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center rounded-full"
          style={{
            width: '19.5%',
            height: '19.5%',
            background: 'linear-gradient(180deg, #ffe98a 0%, #f1b122 50%, #9b5405 100%)',
            padding: '2.2%',
            boxShadow: '0 4px 12px rgba(0,0,0,0.72), 0 0 10px rgba(255, 205, 65, 0.45)',
          }}
        >
          <div
            className="flex h-full w-full items-center justify-center rounded-full"
            style={{
              background: 'radial-gradient(circle at 50% 35%, #372357 0%, #1c1033 70%, #110822 100%)',
              boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.85)',
            }}
          >
            {phase === 'BETTING' && (
              <span
                className={`font-display tabular-nums font-extrabold leading-none transition-transform duration-150 ${
                  countdown <= 3 ? 'text-[#ffec64] scale-110' : 'text-white'
                }`}
                style={{ fontSize: 'clamp(16px, 4.4vw, 30px)' }}
              >
                {countdown}
              </span>
            )}
            {phase === 'SPINNING' && (
              <span
                className="font-display font-black tracking-tight text-[#ffd94a] animate-pulse"
                style={{ fontSize: 'clamp(11px, 2.5vw, 17px)' }}
              >
                GO
              </span>
            )}
            {phase === 'RESULT' && winningOption && (
              <span
                className="font-display font-black leading-none text-[#ffe24f] drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
                style={{ fontSize: 'clamp(13px, 3.2vw, 22px)' }}
              >
                {winningOption === 'seven' ? 'x8' : 'x2'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Lucky 77 Multi-Award Banner Pill Overlay during RESULT if Bonus Triggered */}
      {isResult && winningOption === 'seven' && (
        <div
          className="pointer-events-none absolute left-1/2 -translate-x-1/2 z-20 px-3 py-1 rounded-lg border border-yellow-300 bg-gradient-to-r from-fuchsia-700 via-purple-700 to-fuchsia-700 shadow-[0_0_20px_rgba(255,215,0,0.85)]"
          style={{ top: '20.5%' }}
        >
          <p className="font-display text-xs sm:text-sm font-extrabold tracking-wide text-yellow-200 whitespace-nowrap">
            {bonusOption
              ? `LUCKY 77 + ${bonusOption.toUpperCase()} DOUBLE AWARD!`
              : 'LUCKY 77 JACKPOT x8!'}
          </p>
        </div>
      )}
    </>
  );
};
