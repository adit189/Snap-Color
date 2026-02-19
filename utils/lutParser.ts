import { Lut } from '../types.ts';

export const parseCubeLut = (name: string, content: string): Lut => {
  const lines = content.split('\n');
  let size = 0;
  let title = name;
  const dataPoints: number[] = [];

  for (let line of lines) {
    line = line.trim();
    if (!line || line.startsWith('#')) continue;
    
    if (line.startsWith('TITLE')) {
      const match = line.match(/"([^"]+)"/);
      if (match) title = match[1];
      continue;
    }

    if (line.startsWith('LUT_3D_SIZE')) {
      size = parseInt(line.split(/\s+/)[1], 10);
      continue;
    }

    // Data lines often contain just numbers like "0.0 0.0 0.0"
    // Sometimes simple spaces or tabs
    const parts = line.split(/\s+/).map(parseFloat);
    if (parts.length === 3 && !isNaN(parts[0])) {
      dataPoints.push(parts[0], parts[1], parts[2]);
    }
  }

  if (size === 0) {
      // Sometimes size is not specified or implicit, but for standard CUBE it should be there.
      // Fallback or error. Assuming standard CUBE.
      // Estimate size? Cube root of (length / 3).
      size = Math.round(Math.pow(dataPoints.length / 3, 1/3));
  }

  if (dataPoints.length !== size * size * size * 3) {
      console.warn(`LUT data size mismatch for ${title}. Expected ${size*size*size*3}, got ${dataPoints.length}. Processing may be inaccurate.`);
  }

  return {
    id: Math.random().toString(36).substr(2, 9),
    name: title,
    size,
    data: new Float32Array(dataPoints)
  };
};