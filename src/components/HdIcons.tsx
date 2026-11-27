import React from 'react';
import { formatCoins } from '../engine/teenPatti';

interface SilverChipSvgProps {
  value: number;
  className?: string;
}

/**
 * Ultra-crisp vector silver metallic betting chip replicating the exact screenshot chips
 * while supporting dynamic custom denominations from the Admin Dashboard.
 */
export const SilverChipSvg: React.FC<SilverChipSvgProps> = ({
  value,
  className = 'w-full h-full',
}) => {
  const label = value === 1000 ? '1000' : value === 100000 ? '100K' : formatCoins(value);
  const fontSize = label.length >= 4 ? 22 : label.length === 3 ? 25 : 27;
  const uid = `chip-${value}`;

  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      role="img"
      aria-label={`${label} coin chip`}
    >
      <defs>
        <linearGradient id={`${uid}-outer`} x1="15%" y1="10%" x2="85%" y2="90%">
          <stop offset="0%" stopColor="#f9fafb" />
          <stop offset="35%" stopColor="#d1d5db" />
          <stop offset="70%" stopColor="#9ca3af" />
          <stop offset="100%" stopColor="#e5e7eb" />
        </linearGradient>
        <linearGradient id={`${uid}-inner`} x1="20%" y1="15%" x2="80%" y2="85%">
          <stop offset="0%" stopColor="#e5e7eb" />
          <stop offset="50%" stopColor="#cbd5e1" />
          <stop offset="100%" stopColor="#94a3b8" />
        </linearGradient>
        <radialGradient id={`${uid}-gloss`} cx="35%" cy="25%" r="65%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.65" />
          <stop offset="55%" stopColor="#ffffff" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.12" />
        </radialGradient>
      </defs>

      {/* Soft outer shadow ring */}
      <circle cx="50" cy="50" r="47" fill={`url(#${uid}-outer)`} stroke="#8f98a6" strokeWidth="2.5" />

      {/* Embossed metallic inner recess */}
      <circle cx="50" cy="50" r="39" fill={`url(#${uid}-inner)`} stroke="#f3f4f6" strokeWidth="2" />
      <circle cx="50" cy="50" r="36.5" fill="none" stroke="#8b95a5" strokeWidth="1.2" opacity="0.7" />

      {/* Subtle specular gloss */}
      <circle cx="50" cy="50" r="38" fill={`url(#${uid}-gloss)`} />

      {/* Engraved metallic denomination */}
      <text
        x="50"
        y="52"
        textAnchor="middle"
        dominantBaseline="central"
        fill="#525d6d"
        fontFamily="'Plus Jakarta Sans', 'Outfit', sans-serif"
        fontWeight="800"
        fontSize={fontSize}
        letterSpacing="-0.5"
      >
        {label}
      </text>
      <text
        x="50"
        y="51"
        textAnchor="middle"
        dominantBaseline="central"
        fill="#475569"
        fontFamily="'Plus Jakarta Sans', 'Outfit', sans-serif"
        fontWeight="800"
        fontSize={fontSize}
        letterSpacing="-0.5"
      >
        {label}
      </text>
    </svg>
  );
};

interface HistoryClockSvgProps {
  className?: string;
}

/**
 * Ultra-crisp vector coral-red History Clock button replicating the exact bottom-right icon.
 */
export const HistoryClockSvg: React.FC<HistoryClockSvgProps> = ({
  className = 'w-full h-full',
}) => {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      role="img"
      aria-label="Game History"
    >
      <defs>
        <linearGradient id="hist-ring" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ef7467" />
          <stop offset="50%" stopColor="#de5959" />
          <stop offset="100%" stopColor="#c9434b" />
        </linearGradient>
        <radialGradient id="hist-face" cx="40%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#f3f4f6" />
        </radialGradient>
      </defs>

      {/* Main white clock face */}
      <circle cx="52" cy="52" r="37" fill="url(#hist-face)" />

      {/* Coral-red circular arrow ring */}
      <path
        d="M 22 33 A 37 37 0 1 1 18 56"
        fill="none"
        stroke="url(#hist-ring)"
        strokeWidth="9.5"
        strokeLinecap="round"
      />

      {/* Curved top-left return arrowhead */}
      <path
        d="M 14 23 L 34 24 L 22 41 Z"
        fill="#e5625a"
        stroke="#e5625a"
        strokeWidth="2"
        strokeLinejoin="round"
      />

      {/* Crisp clock hands matching the screenshot (< shape at ~1:25 / 5:00) */}
      <path
        d="M 60 32 L 48 52 L 62 65"
        fill="none"
        stroke="#5b6472"
        strokeWidth="6.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};
