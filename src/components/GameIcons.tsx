import React from 'react';
import { ChipValue } from '../types/game';

interface CasinoChipProps {
  value: ChipValue;
  className?: string;
}

const CHIP_PALETTES: Record<
  ChipValue,
  {
    outerDark: string;
    outerMid: string;
    centerLight: string;
    centerMid: string;
    centerDark: string;
    ringStroke: string;
    label: string;
    fontSize: number;
  }
> = {
  100: {
    outerDark: '#47159E',
    outerMid: '#7330E0',
    centerLight: '#9F66FF',
    centerMid: '#6E2EE0',
    centerDark: '#46159C',
    ringStroke: '#D9C2FF',
    label: '100',
    fontSize: 28,
  },
  1000: {
    outerDark: '#A84705',
    outerMid: '#E36C12',
    centerLight: '#FFB547',
    centerMid: '#EA7B16',
    centerDark: '#B34C06',
    ringStroke: '#FFE0A3',
    label: '1K',
    fontSize: 30,
  },
  10000: {
    outerDark: '#557310',
    outerMid: '#86AE1C',
    centerLight: '#C8E64C',
    centerMid: '#8FB522',
    centerDark: '#5D7D11',
    ringStroke: '#EAF8B0',
    label: '10K',
    fontSize: 26,
  },
  100000: {
    outerDark: '#0C3E9E',
    outerMid: '#1966E0',
    centerLight: '#4CA4FF',
    centerMid: '#1C6CE6',
    centerDark: '#0D41A6',
    ringStroke: '#C2E2FF',
    label: '100K',
    fontSize: 22,
  },
};

/**
 * Ultra-HD 3D glossy casino chip matching Screenshot 4's exact 100 / 1K / 10K / 100K chips.
 */
export const CasinoChipIcon: React.FC<CasinoChipProps> = ({ value, className = 'h-full w-full' }) => {
  const p = CHIP_PALETTES[value];
  const uid = `chip-${value}`;

  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      role="img"
      aria-label={`${p.label} chip`}
    >
      <defs>
        <radialGradient id={`${uid}-outer`} cx="45%" cy="35%" r="65%">
          <stop offset="0%" stopColor={p.outerMid} />
          <stop offset="100%" stopColor={p.outerDark} />
        </radialGradient>
        <radialGradient id={`${uid}-center`} cx="42%" cy="30%" r="72%">
          <stop offset="0%" stopColor={p.centerLight} />
          <stop offset="52%" stopColor={p.centerMid} />
          <stop offset="100%" stopColor={p.centerDark} />
        </radialGradient>
        <linearGradient id={`${uid}-gloss`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.62)" />
          <stop offset="48%" stopColor="rgba(255,255,255,0.12)" />
          <stop offset="52%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
        <linearGradient id={`${uid}-stripe`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="55%" stopColor="#E6E9F2" />
          <stop offset="100%" stopColor="#B8C0D4" />
        </linearGradient>
        <clipPath id={`${uid}-clip`}>
          <circle cx="50" cy="50" r="47" />
        </clipPath>
      </defs>

      {/* Outer metallic edge */}
      <circle cx="50" cy="50" r="48.5" fill="#1C103A" opacity="0.45" />
      <circle cx="50" cy="50" r="47" fill={`url(#${uid}-outer)`} />

      {/* 6 Classic White Casino Edge Stripes */}
      <g clipPath={`url(#${uid}-clip)`}>
        {[0, 60, 120, 180, 240, 300].map((angle) => (
          <rect
            key={angle}
            x="41.5"
            y="0"
            width="17"
            height="18"
            rx="2"
            fill={`url(#${uid}-stripe)`}
            transform={`rotate(${angle + 30} 50 50)`}
          />
        ))}
        {/* Subtle inner rim bevel */}
        <circle cx="50" cy="50" r="47" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="2.2" />
        <circle cx="50" cy="50" r="36.5" fill="rgba(0,0,0,0.28)" />
      </g>

      {/* Inner recessed glossy medallion */}
      <circle cx="50" cy="50" r="35" fill={`url(#${uid}-center)`} />
      <circle
        cx="50"
        cy="50"
        r="32.5"
        fill="none"
        stroke={p.ringStroke}
        strokeWidth="1.6"
        strokeDasharray="6 3.5"
        opacity="0.72"
      />
      <circle cx="50" cy="50" r="35" fill="none" stroke="rgba(255,255,255,0.65)" strokeWidth="1.5" />

      {/* Top specular dome gloss */}
      <ellipse cx="50" cy="33" rx="28" ry="18" fill={`url(#${uid}-gloss)`} />

      {/* Crisp denomination text */}
      <text
        x="50"
        y="52"
        textAnchor="middle"
        dominantBaseline="central"
        fill="#FFFFFF"
        fontFamily="Outfit, Plus Jakarta Sans, sans-serif"
        fontWeight="900"
        fontSize={p.fontSize}
        letterSpacing="-0.5"
        style={{
          filter: 'drop-shadow(0 1.8px 1.2px rgba(0,0,0,0.6))',
        }}
      >
        {p.label}
      </text>
    </svg>
  );
};

export type HudIconType = 'back' | 'sound' | 'soundMuted' | 'profile' | 'help' | 'history';

/**
 * Ultra-HD glossy purple circular HUD buttons matching Screenshot 4's exact icons.
 */
export const HudCircleIcon: React.FC<{ type: HudIconType; className?: string }> = ({
  type,
  className = 'h-full w-full',
}) => {
  const uid = `hud-${type}`;

  return (
    <svg viewBox="0 0 80 80" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`${uid}-rim`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#F5DCFF" />
          <stop offset="45%" stopColor="#C47EEB" />
          <stop offset="100%" stopColor="#7223B0" />
        </linearGradient>
        <radialGradient id={`${uid}-bg`} cx="45%" cy="28%" r="72%">
          <stop offset="0%" stopColor="#F43BF0" />
          <stop offset="52%" stopColor="#BA16CE" />
          <stop offset="100%" stopColor="#6D0A96" />
        </radialGradient>
        <linearGradient id={`${uid}-shine`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.68)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
      </defs>

      {/* Drop shadow & metallic lavender rim */}
      <circle cx="40" cy="42" r="36" fill="rgba(16, 4, 42, 0.55)" />
      <circle cx="40" cy="40" r="36.5" fill={`url(#${uid}-rim)`} />
      <circle cx="40" cy="40" r="32.5" fill={`url(#${uid}-bg)`} />
      <circle cx="40" cy="40" r="32.5" fill="none" stroke="rgba(255,235,255,0.45)" strokeWidth="1.2" />

      {/* Glossy top dome highlight */}
      <ellipse cx="40" cy="24" rx="22" ry="12" fill={`url(#${uid}-shine)`} />

      {/* Center White Crisp Glyph */}
      <g fill="#FFFFFF" style={{ filter: 'drop-shadow(0 2px 2px rgba(68,0,94,0.65))' }}>
        {type === 'back' && (
          <path d="M36 25 L20 38.5 L36 52 L36 43.5 C46.5 43.5 53 47 57.5 55 C57.5 41 49.5 33 36 33 Z" />
        )}

        {(type === 'sound' || type === 'soundMuted') && (
          <>
            <path d="M21 33 L30 33 L42 23 L42 57 L30 47 L21 47 C19.3 47 18 45.7 18 44 L18 36 C18 34.3 19.3 33 21 33 Z" />
            {type === 'sound' ? (
              <g fill="none" stroke="#FFFFFF" strokeWidth="4.2" strokeLinecap="round">
                <path d="M49 32 C53 35.8 53 44.2 49 48" />
                <path d="M55.5 26.5 C62 33 62 47 55.5 53.5" />
              </g>
            ) : (
              <g fill="none" stroke="#FFE0E6" strokeWidth="4.5" strokeLinecap="round">
                <line x1="49" y1="31" x2="62" y2="49" />
                <line x1="62" y1="31" x2="49" y2="49" />
              </g>
            )}
          </>
        )}

        {type === 'profile' && (
          <>
            <circle cx="36" cy="30" r="9.5" />
            <path d="M20 53 C20 44.5 26.5 40.5 36 40.5 C41.5 40.5 46 42 48.5 45 L45 53 Z" />
            {/* Small clock badge at bottom-right matching Screenshot 4 */}
            <circle cx="52.5" cy="50" r="10.5" fill="#FFFFFF" stroke="#9B12B5" strokeWidth="2.2" />
            <path
              d="M52.5 44.5 L52.5 50.2 L56.5 52.5"
              fill="none"
              stroke="#9B12B5"
              strokeWidth="2.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        )}

        {type === 'help' && (
          <text
            x="40"
            y="43"
            textAnchor="middle"
            dominantBaseline="central"
            fontFamily="Outfit, Plus Jakarta Sans, sans-serif"
            fontWeight="900"
            fontSize="44"
            fill="#FFFFFF"
          >
            ?
          </text>
        )}

        {type === 'history' && (
          <>
            <rect x="23" y="21" width="28" height="36" rx="4.5" />
            <rect x="28" y="28" width="18" height="3.8" rx="1.9" fill="#9B12B5" />
            <rect x="28" y="35.5" width="14" height="3.8" rx="1.9" fill="#9B12B5" />
            <rect x="28" y="43" width="10" height="3.8" rx="1.9" fill="#9B12B5" />
            {/* Small clock badge at bottom-right matching Screenshot 4 */}
            <circle cx="52.5" cy="50" r="10.5" fill="#FFFFFF" stroke="#9B12B5" strokeWidth="2.2" />
            <path
              d="M52.5 44.5 L52.5 50.2 L56.5 52.5"
              fill="none"
              stroke="#9B12B5"
              strokeWidth="2.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        )}
      </g>
    </svg>
  );
};

/**
 * Ultra-HD Glossy Gold Coin Icon
 */
export const GoldCoinIcon: React.FC<{ className?: string }> = ({ className = 'h-5 w-5' }) => (
  <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
    <defs>
      <radialGradient id="coin-gold-outer" cx="38%" cy="28%" r="72%">
        <stop offset="0%" stopColor="#FFF7AD" />
        <stop offset="45%" stopColor="#FFD028" />
        <stop offset="85%" stopColor="#E68A00" />
        <stop offset="100%" stopColor="#A65200" />
      </radialGradient>
      <radialGradient id="coin-gold-inner" cx="35%" cy="28%" r="70%">
        <stop offset="0%" stopColor="#FFE96B" />
        <stop offset="60%" stopColor="#F5A60A" />
        <stop offset="100%" stopColor="#C46B00" />
      </radialGradient>
    </defs>
    <circle cx="24" cy="24" r="22" fill="url(#coin-gold-outer)" stroke="#8F4300" strokeWidth="1.5" />
    <circle cx="24" cy="24" r="16.5" fill="url(#coin-gold-inner)" stroke="#FFF29C" strokeWidth="1.5" />
    <path
      d="M24 13 L26.9 19.6 L34 20.3 L28.6 25 L30.2 32 L24 28.3 L17.8 32 L19.4 25 L14 20.3 L21.1 19.6 Z"
      fill="#FFF8C4"
      opacity="0.92"
    />
  </svg>
);

/**
 * Ultra-HD Glossy Golden '+' Top-Up Button
 */
export const GoldPlusIcon: React.FC<{ className?: string }> = ({ className = 'h-full w-full' }) => (
  <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
    <defs>
      <radialGradient id="plus-gold-bg" cx="40%" cy="25%" r="72%">
        <stop offset="0%" stopColor="#FFF699" />
        <stop offset="45%" stopColor="#FFC81E" />
        <stop offset="100%" stopColor="#D46E00" />
      </radialGradient>
    </defs>
    <circle cx="24" cy="24" r="22" fill="url(#plus-gold-bg)" stroke="#FFF0A6" strokeWidth="2.2" />
    <path
      d="M24 13 V35 M13 24 H35"
      stroke="#FFFFFF"
      strokeWidth="6"
      strokeLinecap="round"
      style={{ filter: 'drop-shadow(0 1.5px 1.5px rgba(135, 58, 0, 0.7))' }}
    />
  </svg>
);

/**
 * Ultra-HD Glossy 'NEW' Badge matching Screenshot 4
 */
export const NewBadgeIcon: React.FC<{ className?: string }> = ({ className = 'h-full w-auto' }) => (
  <svg viewBox="0 0 112 52" className={className} aria-label="NEW">
    <defs>
      <linearGradient id="new-gold-rim" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#FFF6A1" />
        <stop offset="50%" stopColor="#F7BA1E" />
        <stop offset="100%" stopColor="#B86404" />
      </linearGradient>
      <linearGradient id="new-purple-fill" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#DF22DB" />
        <stop offset="55%" stopColor="#9E0CA8" />
        <stop offset="100%" stopColor="#68047A" />
      </linearGradient>
    </defs>
    <g transform="rotate(-7 56 26)">
      <rect x="6" y="7" width="100" height="38" rx="19" fill="url(#new-gold-rim)" />
      <rect x="10.5" y="11" width="91" height="30" rx="15" fill="url(#new-purple-fill)" />
      <ellipse cx="56" cy="17.5" rx="34" ry="6" fill="rgba(255,255,255,0.28)" />
      <text
        x="56"
        y="27"
        textAnchor="middle"
        dominantBaseline="central"
        fill="#FFF385"
        fontFamily="Outfit, Plus Jakarta Sans, sans-serif"
        fontWeight="900"
        fontSize="21"
        letterSpacing="0.8"
        style={{ filter: 'drop-shadow(0 1.5px 1px rgba(60,0,75,0.9))' }}
      >
        NEW
      </text>
    </g>
  </svg>
);
