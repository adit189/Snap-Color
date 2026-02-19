export interface Photo {
  id: string;
  file: File;
  previewUrl: string;
  name: string;
}

export interface Lut {
  id: string;
  name: string;
  size: number;
  data: Float32Array;
}

export interface ColorMixerChannel {
  hue: number;
  saturation: number;
  luminance: number;
}

// Subset of settings available for Local Masks
export interface LocalSettings {
  exposure: number;
  contrast: number;
  highlights: number;
  shadows: number;
  texture: number;
  clarity: number;
  saturation: number;
  temperature: number;
  tint: number;
}

export interface Mask {
  id: string;
  name: string;
  type: 'color' | 'linear';
  
  // Color Mask Props
  targetColor: { h: number, s: number, l: number } | null; // Selected from image
  colorRange: number; // Tolerance 0-100
  
  // Geometry (Linear)
  x: number; // Center X (0-1)
  y: number; // Center Y (0-1)
  radius: number; // Unused for Linear, kept for type compatibility or future circular
  feather: number; // 0-100 (Width of gradient)
  rotation?: number; // Linear Gradient Angle (degrees)
  
  // AI/Bitmap properties (Unused now but keeping optional structure clean is fine, or remove)
  bitmap?: Uint8Array;
  bitmapWidth?: number;
  bitmapHeight?: number;

  invert: boolean;
  opacity: number; // 0-100

  settings: LocalSettings;
}

export interface EditSettings {
  // White Balance
  temperature: number;
  tint: number;

  // Tone
  exposure: number;
  contrast: number;
  highlights: number;
  shadows: number;

  // Presence
  texture: number;
  clarity: number;
  saturation: number; // Global

  // Mixer
  colorMixer: {
    red: ColorMixerChannel;
    orange: ColorMixerChannel;
    yellow: ColorMixerChannel;
    aqua: ColorMixerChannel;
    blue: ColorMixerChannel;
    magenta: ColorMixerChannel;
  };

  lutId: string | null;
  lutIntensity: number;

  // Masking
  masks: Mask[];

  // Legacy/Skin (Keeping for compatibility)
  skinHue: number;
  skinSaturation: number;
  skinLuminance: number;
  skinTexture: number;
  skinClarity: number;
  skinDetectionRange: number;

  crop: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
  
  isMirrored: boolean;
}

export const DEFAULT_MIXER_CHANNEL: ColorMixerChannel = { hue: 0, saturation: 0, luminance: 0 };

export const DEFAULT_LOCAL_SETTINGS: LocalSettings = {
  exposure: 0,
  contrast: 0,
  highlights: 0,
  shadows: 0,
  texture: 0,
  clarity: 0,
  saturation: 0,
  temperature: 0,
  tint: 0,
};

export const DEFAULT_SETTINGS: EditSettings = {
  temperature: 0,
  tint: 0,
  exposure: 0,
  contrast: 0,
  highlights: 0,
  shadows: 0,
  texture: 0,
  clarity: 0,
  saturation: 0,
  
  colorMixer: {
    red: { ...DEFAULT_MIXER_CHANNEL },
    orange: { ...DEFAULT_MIXER_CHANNEL },
    yellow: { ...DEFAULT_MIXER_CHANNEL },
    aqua: { ...DEFAULT_MIXER_CHANNEL },
    blue: { ...DEFAULT_MIXER_CHANNEL },
    magenta: { ...DEFAULT_MIXER_CHANNEL },
  },

  lutId: null,
  lutIntensity: 100,

  masks: [],

  skinHue: 50,
  skinSaturation: 0,
  skinLuminance: 0,
  skinTexture: 0,
  skinClarity: 0,
  skinDetectionRange: 40,
  
  crop: null,
  isMirrored: false,
};