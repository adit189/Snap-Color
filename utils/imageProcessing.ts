import { EditSettings, Lut, ColorMixerChannel, LocalSettings, Mask } from '../types.ts';

const clamp = (value: number) => Math.max(0, Math.min(255, value));

export function rgbToHsl(r: number, g: number, b: number) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number) {
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const hue2rgb = (t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    r = hue2rgb(h + 1/3);
    g = hue2rgb(h);
    b = hue2rgb(h - 1/3);
  }
  return [r * 255, g * 255, b * 255];
}

const getMixerAdjustment = (hue: number, mixer: EditSettings['colorMixer']): { h: number, s: number, l: number } => {
  if (!mixer) return { h: 0, s: 0, l: 0 };
  
  const hDeg = hue * 360;
  const getWeight = (center: number, width: number) => {
    let diff = Math.abs(hDeg - center);
    if (diff > 180) diff = 360 - diff;
    return Math.max(0, 1 - diff / width);
  };

  const wRed = getWeight(0, 45) + getWeight(360, 45);
  const wOrange = getWeight(30, 30);
  const wYellow = getWeight(60, 35);
  const wAqua = getWeight(180, 50); 
  const wBlue = getWeight(240, 50);
  const wMagenta = getWeight(300, 50);

  let dh = 0, ds = 0, dl = 0;
  if (wRed > 0) { dh += mixer.red.hue * wRed; ds += mixer.red.saturation * wRed; dl += mixer.red.luminance * wRed; }
  if (wOrange > 0) { dh += mixer.orange.hue * wOrange; ds += mixer.orange.saturation * wOrange; dl += mixer.orange.luminance * wOrange; }
  if (wYellow > 0) { dh += mixer.yellow.hue * wYellow; ds += mixer.yellow.saturation * wYellow; dl += mixer.yellow.luminance * wYellow; }
  if (wAqua > 0) { dh += mixer.aqua.hue * wAqua; ds += mixer.aqua.saturation * wAqua; dl += mixer.aqua.luminance * wAqua; }
  if (wBlue > 0) { dh += mixer.blue.hue * wBlue; ds += mixer.blue.saturation * wBlue; dl += mixer.blue.luminance * wBlue; }
  if (wMagenta > 0) { dh += mixer.magenta.hue * wMagenta; ds += mixer.magenta.saturation * wMagenta; dl += mixer.magenta.luminance * wMagenta; }

  return { h: dh, s: ds, l: dl };
};

const applyAdjustments = (
  r: number, g: number, b: number, 
  settings: LocalSettings
): [number, number, number] => {
  const exposureMultiplier = Math.pow(2, settings.exposure / 50);
  const contrastFactor = (259 * (settings.contrast + 255)) / (255 * (259 - settings.contrast));
  const saturationFactor = 1 + (settings.saturation / 100);
  const tempTintR = 1 + (settings.temperature / 100) + (settings.tint / 100);
  const tempTintB = 1 - (settings.temperature / 100);
  const tempTintG = 1 - (settings.tint / 200);

  r *= tempTintR; g *= tempTintG; b *= tempTintB;
  r *= exposureMultiplier; g *= exposureMultiplier; b *= exposureMultiplier;
  
  // Contrast
  r = contrastFactor * (r - 128) + 128;
  g = contrastFactor * (g - 128) + 128;
  b = contrastFactor * (b - 128) + 128;
  
  const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  // Highlights & Shadows
  if (settings.shadows !== 0) {
    const shadowMask = Math.pow(1 - luma, 3);
    const shift = settings.shadows * shadowMask * 0.6;
    r += shift; g += shift; b += shift;
  }
  if (settings.highlights !== 0) {
    const highlightMask = Math.pow(luma, 3);
    const shift = settings.highlights * highlightMask * 0.6;
    r += shift; g += shift; b += shift;
  }

  // Clarity (Basic)
  if (settings.clarity !== 0) {
     const sigma = settings.clarity < 0 ? 0.5 : 0.2;
     const midtoneMask = Math.exp(-Math.pow(luma - 0.5, 2) / (2 * sigma * sigma));
     const clarityFactor = 1 + (settings.clarity / 150) * midtoneMask;
     r = (r - 128) * clarityFactor + 128;
     g = (g - 128) * clarityFactor + 128;
     b = (b - 128) * clarityFactor + 128;
  }

  const gray = 0.299 * r + 0.587 * g + 0.114 * b;
  r = gray + (r - gray) * saturationFactor;
  g = gray + (g - gray) * saturationFactor;
  b = gray + (b - gray) * saturationFactor;

  return [r, g, b];
};

export const calculateMaskAlpha = (
    u: number, 
    v: number, 
    width: number, 
    height: number, 
    mask: Mask, 
    hsl?: { h: number, s: number, l: number }
): number => {
    let alpha = 0;
    const feather = Math.max(0.01, mask.feather / 100);

    if (mask.type === 'linear') {
        // Linear Gradient
        // Rotation: 0 deg = bottom to top (vertical)
        // Center: mask.x, mask.y
        const angleRad = (mask.rotation || 0) * (Math.PI / 180);
        
        // We define the normal vector of the separating line
        const nx = Math.sin(angleRad);
        const ny = -Math.cos(angleRad);
        
        // Vector from center to current pixel
        // We correct aspect ratio for 'dy' to make rotation visual circular
        const aspect = width / height;
        const dx = (u - mask.x);
        const dy = (v - mask.y) * aspect;

        // Project vector onto the normal
        const dist = dx * nx + dy * ny;
        
        // Feather defines the transition zone width
        // The transition happens from -feather/2 to +feather/2 around the center line
        const f = Math.max(0.001, feather);
        
        // Normalize distance to 0..1 range inside the feather zone
        // dist < -f/2  => 1 (Full mask)
        // dist > f/2   => 0 (No mask)
        
        const norm = 0.5 - (dist / f);
        alpha = Math.max(0, Math.min(1, norm));

    } else if (mask.type === 'color' && mask.targetColor && hsl) {
        const { h, s } = hsl;
        const hueDiff = Math.abs(h - mask.targetColor.h);
        const diff = Math.min(hueDiff, 1 - hueDiff);
        const range = mask.colorRange / 100;
        const colorFeather = 0.1;

        if (diff < range) {
            alpha = 1;
        } else if (diff < range + colorFeather) {
            alpha = 1 - (diff - range) / colorFeather;
        }
        
        if (mask.targetColor.s > 0.1) {
            const satDiff = Math.abs(s - mask.targetColor.s);
            if (satDiff > 0.3) alpha *= Math.max(0, 1 - (satDiff - 0.3) * 5);
        }
    }

    if (mask.invert) alpha = 1 - alpha;
    return alpha * (mask.opacity / 100);
};

export const processImage = (
  imageData: ImageData, 
  settings: EditSettings,
  activeLut: Lut | null = null
): ImageData => {
  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;
  const output = new Uint8ClampedArray(data);

  // Pre-calculate Global Settings
  const globalLocalSettings: LocalSettings = {
      exposure: settings.exposure,
      contrast: settings.contrast,
      highlights: settings.highlights,
      shadows: settings.shadows,
      texture: settings.texture,
      clarity: settings.clarity,
      saturation: settings.saturation,
      temperature: settings.temperature,
      tint: settings.tint
  };

  const hasMasks = settings.masks && settings.masks.length > 0;
  const hasLut = activeLut && settings.lutIntensity > 0;
  const lutIntensity = hasLut ? settings.lutIntensity / 100 : 0;
  const lutSize = activeLut?.size || 0;
  const lutSizeSq = lutSize * lutSize;
  const lutSizeMinus1 = lutSize - 1;

  for (let i = 0; i < data.length; i += 4) {
    const originalR = data[i];
    const originalG = data[i + 1];
    const originalB = data[i + 2];
    
    // 1. Apply Global Adjustments
    let [r, g, b] = applyAdjustments(originalR, originalG, originalB, globalLocalSettings);

    // 2. Global Color Mixer
    let [h, s, l] = rgbToHsl(clamp(r), clamp(g), clamp(b));
    const adj = getMixerAdjustment(h, settings.colorMixer);
    if (adj.h !== 0 || adj.s !== 0 || adj.l !== 0) {
        h = (h + adj.h / 360);
        s = clamp(s * (1 + adj.s / 100));
        l = clamp(l * (1 + adj.l / 100));
        if (h < 0) h += 1; if (h > 1) h -= 1;
        const rgb = hslToRgb(h, s, l);
        r = rgb[0]; g = rgb[1]; b = rgb[2];
    }

    // 3. Apply Masks
    if (hasMasks) {
        const x = (i / 4) % width;
        const y = Math.floor((i / 4) / width);
        let u = x / width;
        let v = y / height;

        // COORDINATE SPACE MAPPING
        // If image is mirrored or cropped, the 'imageData' passed here is already transformed.
        // But masks (AI, Linear, Radial) are defined in the *Original Image Space* (0..1).
        // We must map current view UV back to global UV.
        
        // 1. Mirroring
        if (settings.isMirrored) {
            u = 1 - u;
        }

        // 2. Cropping
        if (settings.crop) {
            u = settings.crop.x + u * settings.crop.width;
            v = settings.crop.y + v * settings.crop.height;
        }

        for (const mask of settings.masks) {
            if (mask.opacity === 0) continue;
            
            let maskHsl;
            if (mask.type === 'color') {
                 // Use original pixels for stable masking
                 const [oh, os, ol] = rgbToHsl(originalR, originalG, originalB);
                 maskHsl = { h: oh, s: os, l: ol }; 
            }

            // We pass global U,V here
            const alpha = calculateMaskAlpha(u, v, width, height, mask, maskHsl);

            if (alpha > 0) {
                const [mr, mg, mb] = applyAdjustments(r, g, b, mask.settings);
                r = r * (1 - alpha) + mr * alpha;
                g = g * (1 - alpha) + mg * alpha;
                b = b * (1 - alpha) + mb * alpha;
            }
        }
    }

    // 4. LUT
    if (hasLut && activeLut) {
      const nr = clamp(r) / 255, ng = clamp(g) / 255, nb = clamp(b) / 255;
      const ri = Math.round(nr * lutSizeMinus1), gi = Math.round(ng * lutSizeMinus1), bi = Math.round(nb * lutSizeMinus1);
      const idx = (ri + gi * lutSize + bi * lutSizeSq) * 3;
      if (idx < activeLut.data.length - 2) {
        r = r * (1 - lutIntensity) + activeLut.data[idx] * 255 * lutIntensity;
        g = g * (1 - lutIntensity) + activeLut.data[idx+1] * 255 * lutIntensity;
        b = b * (1 - lutIntensity) + activeLut.data[idx+2] * 255 * lutIntensity;
      }
    }

    output[i] = clamp(r);
    output[i + 1] = clamp(g);
    output[i + 2] = clamp(b);
  }

  // Texture (Global Only for now to save perf, applied at end)
  if (settings.texture !== 0) {
    const textureData = new Uint8ClampedArray(output);
    const amount = settings.texture / 100; 
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const i = (y * width + x) * 4;
        for (let c = 0; c < 3; c++) {
          const center = textureData[i + c];
          const avg = (
            textureData[((y - 1) * width + x - 1) * 4 + c] +
            textureData[((y - 1) * width + x) * 4 + c] +
            textureData[((y - 1) * width + x + 1) * 4 + c] +
            textureData[(y * width + x - 1) * 4 + c] +
            textureData[(y * width + x + 1) * 4 + c] +
            textureData[((y + 1) * width + x - 1) * 4 + c] +
            textureData[((y + 1) * width + x) * 4 + c] +
            textureData[((y + 1) * width + x + 1) * 4 + c] + 
            center
          ) / 9;
          const finalAmount = amount > 0 ? amount * 0.5 : amount;
          const diff = center - avg;
          output[i + c] = clamp(center + diff * finalAmount);
        }
      }
    }
  }

  return new ImageData(output, width, height);
};