export const DEFAULT_ROYAL_PORTRAIT =
  '/src/assets/images/player_avatar_portrait_1793947877320.jpg';

export interface AnimatedAvatarPreset {
  id: string;
  name: string;
  subtitle: string;
  dataUrl: string;
}

function svgToDataUrl(svgString: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svgString.trim())}`;
}

export const ANIMATED_AVATAR_PRESETS: AnimatedAvatarPreset[] = [
  {
    id: 'anim_sovereign_crown',
    name: 'Sovereign Mukuta',
    subtitle: 'Animated Golden Crown',
    dataUrl: svgToDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
        <defs>
          <radialGradient id="bg1" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#451A03"/>
            <stop offset="100%" stop-color="#0F141C"/>
          </radialGradient>
          <linearGradient id="gold1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#FDE68A"/>
            <stop offset="50%" stop-color="#F59E0B"/>
            <stop offset="100%" stop-color="#B45309"/>
          </linearGradient>
        </defs>
        <rect width="120" height="120" rx="24" fill="url(#bg1)"/>
        <circle cx="60" cy="60" r="46" fill="none" stroke="#F59E0B" stroke-width="2" stroke-dasharray="8 6" opacity="0.55">
          <animateTransform attributeName="transform" type="rotate" from="0 60 60" to="360 60 60" dur="10s" repeatCount="indefinite"/>
        </circle>
        <g>
          <animateTransform attributeName="transform" type="translate" values="0,0; 0,-5; 0,0" dur="2.4s" repeatCount="indefinite"/>
          <path d="M28 78 L34 44 L48 58 L60 32 L72 58 L86 44 L92 78 Z" fill="url(#gold1)" stroke="#FEF3C7" stroke-width="2"/>
          <rect x="28" y="81" width="64" height="8" rx="4" fill="#F59E0B"/>
          <circle cx="60" cy="30" r="4.5" fill="#FEF08A">
            <animate attributeName="r" values="3.5;6;3.5" dur="1.5s" repeatCount="indefinite"/>
          </circle>
          <circle cx="34" cy="42" r="3.5" fill="#34D399"/>
          <circle cx="86" cy="42" r="3.5" fill="#F43F5E"/>
        </g>
      </svg>
    `),
  },
  {
    id: 'anim_chakra_spin',
    name: 'Sudarshana Chakra',
    subtitle: 'Spinning Celestial Disc',
    dataUrl: svgToDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
        <defs>
          <radialGradient id="bg2" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#0C4A6E"/>
            <stop offset="100%" stop-color="#090D16"/>
          </radialGradient>
        </defs>
        <rect width="120" height="120" rx="24" fill="url(#bg2)"/>
        <g>
          <animateTransform attributeName="transform" type="rotate" from="0 60 60" to="360 60 60" dur="6s" repeatCount="indefinite"/>
          <circle cx="60" cy="60" r="42" fill="none" stroke="#38BDF8" stroke-width="3" stroke-dasharray="6 4"/>
          <polygon points="60,12 66,28 54,28" fill="#FDE047"/>
          <polygon points="60,108 66,92 54,92" fill="#FDE047"/>
          <polygon points="12,60 28,66 28,54" fill="#FDE047"/>
          <polygon points="108,60 92,66 92,54" fill="#FDE047"/>
          <polygon points="26,26 40,32 32,40" fill="#38BDF8"/>
          <polygon points="94,94 80,88 88,80" fill="#38BDF8"/>
          <polygon points="94,26 88,40 80,32" fill="#38BDF8"/>
          <polygon points="26,94 32,80 40,88" fill="#38BDF8"/>
        </g>
        <circle cx="60" cy="60" r="18" fill="#0EA5E9" stroke="#E0F2FE" stroke-width="2.5">
          <animate attributeName="r" values="16;20;16" dur="2s" repeatCount="indefinite"/>
        </circle>
        <circle cx="60" cy="60" r="7" fill="#FEF9C3"/>
      </svg>
    `),
  },
  {
    id: 'anim_ivory_pasa',
    name: 'Mystic Ivory Pasa',
    subtitle: 'Tumbling Royal Dice',
    dataUrl: svgToDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
        <defs>
          <radialGradient id="bg3" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#064E3B"/>
            <stop offset="100%" stop-color="#0F141C"/>
          </radialGradient>
        </defs>
        <rect width="120" height="120" rx="24" fill="url(#bg3)"/>
        <circle cx="60" cy="60" r="45" fill="none" stroke="#10B981" stroke-width="1.5" opacity="0.5">
          <animate attributeName="r" values="40;47;40" dur="2.5s" repeatCount="indefinite"/>
        </circle>
        <g>
          <animateTransform attributeName="transform" type="rotate" values="-8 60 60; 8 60 60; -8 60 60" dur="2.2s" repeatCount="indefinite"/>
          <rect x="26" y="36" width="68" height="18" rx="5" fill="#FAF3E0" stroke="#F59E0B" stroke-width="2"/>
          <circle cx="42" cy="45" r="3.5" fill="#9F1239"/>
          <circle cx="60" cy="45" r="3.5" fill="#9F1239"/>
          <circle cx="78" cy="45" r="3.5" fill="#9F1239"/>
          <rect x="26" y="64" width="68" height="18" rx="5" fill="#FAF3E0" stroke="#F59E0B" stroke-width="2"/>
          <circle cx="42" cy="73" r="3.5" fill="#9F1239"/>
          <circle cx="60" cy="73" r="3.5" fill="#9F1239"/>
          <circle cx="78" cy="73" r="3.5" fill="#9F1239"/>
        </g>
      </svg>
    `),
  },
  {
    id: 'anim_crimson_agni',
    name: 'Agni Garuda Crest',
    subtitle: 'Pulsing Crimson Flame',
    dataUrl: svgToDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
        <defs>
          <radialGradient id="bg4" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#881337"/>
            <stop offset="100%" stop-color="#110C14"/>
          </radialGradient>
        </defs>
        <rect width="120" height="120" rx="24" fill="url(#bg4)"/>
        <circle cx="60" cy="60" r="44" fill="none" stroke="#F43F5E" stroke-width="2" stroke-dasharray="10 5">
          <animateTransform attributeName="transform" type="rotate" from="360 60 60" to="0 60 60" dur="8s" repeatCount="indefinite"/>
        </circle>
        <g>
          <animateTransform attributeName="transform" type="scale" values="1;1.08;1" additive="sum" dur="1.8s" repeatCount="indefinite"/>
          <path d="M60 22 C75 42 90 52 82 76 C76 92 44 92 38 76 C30 52 45 42 60 22 Z" fill="#E11D48" stroke="#FDA4AF" stroke-width="2"/>
          <path d="M60 40 C68 52 75 60 70 76 C66 85 54 85 50 76 C45 60 52 52 60 40 Z" fill="#FBBF24"/>
        </g>
      </svg>
    `),
  },
  {
    id: 'anim_golden_lotus',
    name: 'Padma Mandala',
    subtitle: 'Blooming Palace Lotus',
    dataUrl: svgToDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
        <defs>
          <radialGradient id="bg5" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#581C87"/>
            <stop offset="100%" stop-color="#0F141C"/>
          </radialGradient>
        </defs>
        <rect width="120" height="120" rx="24" fill="url(#bg5)"/>
        <g>
          <animateTransform attributeName="transform" type="rotate" from="0 60 60" to="360 60 60" dur="14s" repeatCount="indefinite"/>
          <ellipse cx="60" cy="60" rx="14" ry="42" fill="#EC4899" opacity="0.75"/>
          <ellipse cx="60" cy="60" rx="42" ry="14" fill="#EC4899" opacity="0.75"/>
          <ellipse cx="60" cy="60" rx="14" ry="42" transform="rotate(45 60 60)" fill="#F472B6" opacity="0.8"/>
          <ellipse cx="60" cy="60" rx="14" ry="42" transform="rotate(-45 60 60)" fill="#F472B6" opacity="0.8"/>
        </g>
        <circle cx="60" cy="60" r="14" fill="#FDE047" stroke="#FEF9C3" stroke-width="2">
          <animate attributeName="r" values="12;16;12" dur="2.2s" repeatCount="indefinite"/>
        </circle>
      </svg>
    `),
  },
  {
    id: 'anim_emerald_archer',
    name: 'Gandiva Star',
    subtitle: 'Radiant Emerald Astras',
    dataUrl: svgToDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
        <rect width="120" height="120" rx="24" fill="#052E16"/>
        <g>
          <animateTransform attributeName="transform" type="rotate" from="0 60 60" to="360 60 60" dur="9s" repeatCount="indefinite"/>
          <polygon points="60,14 73,46 106,60 73,74 60,106 47,74 14,60 47,46" fill="#10B981" stroke="#A7F3D0" stroke-width="2"/>
        </g>
        <circle cx="60" cy="60" r="15" fill="#F59E0B" stroke="#FEF3C7" stroke-width="2">
          <animate attributeName="opacity" values="0.75;1;0.75" dur="1.6s" repeatCount="indefinite"/>
        </circle>
      </svg>
    `),
  },
];

/**
 * Resolves the active profile picture URL according to the user's priority rules:
 * 1. If the user explicitly selected an animated avatar or uploaded a local photo (`customPlayerAvatar`), use it.
 * 2. Otherwise, if the user is signed in via Google Gmail or Apple ID and has an account `photoUrl`, use it by default.
 * 3. Otherwise, fall back to the Royal Challenger portrait.
 */
export function resolvePlayerAvatar(
  customPlayerAvatar?: string | null,
  accountPhotoUrl?: string | null
): string {
  if (customPlayerAvatar && customPlayerAvatar.trim().length > 0) {
    return customPlayerAvatar;
  }
  if (accountPhotoUrl && accountPhotoUrl.trim().length > 0) {
    return accountPhotoUrl;
  }
  return DEFAULT_ROYAL_PORTRAIT;
}

/**
 * Reads a user-imported image file from local storage/disk and resizes it to a clean 160x160 Data URL
 * so it renders crisp across all views and persists reliably in localStorage.
 */
export function compressImageFileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read selected image file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image format.'));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const size = 160;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(reader.result));
          return;
        }
        // Center-crop square
        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2;
        const sy = (img.height - minSide) / 2;
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
        resolve(canvas.toDataURL('image/jpeg', 0.86));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
