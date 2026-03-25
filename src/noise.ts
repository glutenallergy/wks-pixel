// 3D + 4D Simplex Noise with FBM
// Based on Stefan Gustavson's simplex noise algorithm

const grad3: readonly number[][] = [
  [1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],
  [1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],
  [0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]
];

const grad4: readonly number[][] = [
  [0,1,1,1],[0,1,1,-1],[0,1,-1,1],[0,1,-1,-1],
  [0,-1,1,1],[0,-1,1,-1],[0,-1,-1,1],[0,-1,-1,-1],
  [1,0,1,1],[1,0,1,-1],[1,0,-1,1],[1,0,-1,-1],
  [-1,0,1,1],[-1,0,1,-1],[-1,0,-1,1],[-1,0,-1,-1],
  [1,1,0,1],[1,1,0,-1],[1,-1,0,1],[1,-1,0,-1],
  [-1,1,0,1],[-1,1,0,-1],[-1,-1,0,1],[-1,-1,0,-1],
  [1,1,1,0],[1,1,-1,0],[1,-1,1,0],[1,-1,-1,0],
  [-1,1,1,0],[-1,1,-1,0],[-1,-1,1,0],[-1,-1,-1,0],
];

const F2 = 0.5 * (Math.sqrt(3.0) - 1.0);
const G2 = (3.0 - Math.sqrt(3.0)) / 6.0;
const F3 = 1.0 / 3.0;
const G3 = 1.0 / 6.0;
const F4 = (Math.sqrt(5.0) - 1.0) / 4.0;
const G4 = (5.0 - Math.sqrt(5.0)) / 20.0;

export class SimplexNoise {
  private perm: Uint8Array;
  private permMod12: Uint8Array;

  constructor(seed: number = 0) {
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;

    let s = seed === 0 ? 1 : Math.abs(seed);
    for (let i = 255; i > 0; i--) {
      s = (s * 16807) % 2147483647;
      const j = s % (i + 1);
      const tmp = p[i];
      p[i] = p[j];
      p[j] = tmp;
    }

    this.perm = new Uint8Array(512);
    this.permMod12 = new Uint8Array(512);
    for (let i = 0; i < 512; i++) {
      this.perm[i] = p[i & 255];
      this.permMod12[i] = this.perm[i] % 12;
    }
  }

  noise2D(xin: number, yin: number): number {
    const { perm, permMod12 } = this;

    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);

    const t = (i + j) * G2;
    const x0 = xin - (i - t);
    const y0 = yin - (j - t);

    const i1 = x0 > y0 ? 1 : 0;
    const j1 = x0 > y0 ? 0 : 1;

    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1.0 + 2.0 * G2;
    const y2 = y0 - 1.0 + 2.0 * G2;

    const ii = i & 255;
    const jj = j & 255;

    let n0 = 0, n1 = 0, n2 = 0;

    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 >= 0) {
      t0 *= t0;
      const gi = permMod12[ii + perm[jj]];
      n0 = t0 * t0 * (grad3[gi][0] * x0 + grad3[gi][1] * y0);
    }

    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 >= 0) {
      t1 *= t1;
      const gi = permMod12[ii + i1 + perm[jj + j1]];
      n1 = t1 * t1 * (grad3[gi][0] * x1 + grad3[gi][1] * y1);
    }

    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 >= 0) {
      t2 *= t2;
      const gi = permMod12[ii + 1 + perm[jj + 1]];
      n2 = t2 * t2 * (grad3[gi][0] * x2 + grad3[gi][1] * y2);
    }

    return 70.0 * (n0 + n1 + n2);
  }

  noise3D(xin: number, yin: number, zin: number): number {
    const { perm, permMod12 } = this;

    const s = (xin + yin + zin) * F3;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const k = Math.floor(zin + s);

    const t = (i + j + k) * G3;
    const x0 = xin - (i - t);
    const y0 = yin - (j - t);
    const z0 = zin - (k - t);

    let i1: number, j1: number, k1: number;
    let i2: number, j2: number, k2: number;

    if (x0 >= y0) {
      if (y0 >= z0) { i1=1; j1=0; k1=0; i2=1; j2=1; k2=0; }
      else if (x0 >= z0) { i1=1; j1=0; k1=0; i2=1; j2=0; k2=1; }
      else { i1=0; j1=0; k1=1; i2=1; j2=0; k2=1; }
    } else {
      if (y0 < z0) { i1=0; j1=0; k1=1; i2=0; j2=1; k2=1; }
      else if (x0 < z0) { i1=0; j1=1; k1=0; i2=0; j2=1; k2=1; }
      else { i1=0; j1=1; k1=0; i2=1; j2=1; k2=0; }
    }

    const x1 = x0 - i1 + G3;
    const y1 = y0 - j1 + G3;
    const z1 = z0 - k1 + G3;
    const x2 = x0 - i2 + 2.0 * G3;
    const y2 = y0 - j2 + 2.0 * G3;
    const z2 = z0 - k2 + 2.0 * G3;
    const x3 = x0 - 1.0 + 3.0 * G3;
    const y3 = y0 - 1.0 + 3.0 * G3;
    const z3 = z0 - 1.0 + 3.0 * G3;

    const ii = i & 255;
    const jj = j & 255;
    const kk = k & 255;

    let n0 = 0, n1 = 0, n2 = 0, n3 = 0;

    let t0 = 0.6 - x0*x0 - y0*y0 - z0*z0;
    if (t0 >= 0) {
      t0 *= t0;
      const gi = permMod12[ii + perm[jj + perm[kk]]];
      n0 = t0 * t0 * (grad3[gi][0]*x0 + grad3[gi][1]*y0 + grad3[gi][2]*z0);
    }

    let t1 = 0.6 - x1*x1 - y1*y1 - z1*z1;
    if (t1 >= 0) {
      t1 *= t1;
      const gi = permMod12[ii+i1 + perm[jj+j1 + perm[kk+k1]]];
      n1 = t1 * t1 * (grad3[gi][0]*x1 + grad3[gi][1]*y1 + grad3[gi][2]*z1);
    }

    let t2 = 0.6 - x2*x2 - y2*y2 - z2*z2;
    if (t2 >= 0) {
      t2 *= t2;
      const gi = permMod12[ii+i2 + perm[jj+j2 + perm[kk+k2]]];
      n2 = t2 * t2 * (grad3[gi][0]*x2 + grad3[gi][1]*y2 + grad3[gi][2]*z2);
    }

    let t3 = 0.6 - x3*x3 - y3*y3 - z3*z3;
    if (t3 >= 0) {
      t3 *= t3;
      const gi = permMod12[ii+1 + perm[jj+1 + perm[kk+1]]];
      n3 = t3 * t3 * (grad3[gi][0]*x3 + grad3[gi][1]*y3 + grad3[gi][2]*z3);
    }

    return 32.0 * (n0 + n1 + n2 + n3);
  }

  noise4D(xin: number, yin: number, zin: number, win: number): number {
    const { perm } = this;

    const s = (xin + yin + zin + win) * F4;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const k = Math.floor(zin + s);
    const l = Math.floor(win + s);

    const t = (i + j + k + l) * G4;
    const x0 = xin - (i - t);
    const y0 = yin - (j - t);
    const z0 = zin - (k - t);
    const w0 = win - (l - t);

    // Determine simplex corner ordering using rank method
    let rankx = 0, ranky = 0, rankz = 0, rankw = 0;
    if (x0 > y0) rankx++; else ranky++;
    if (x0 > z0) rankx++; else rankz++;
    if (x0 > w0) rankx++; else rankw++;
    if (y0 > z0) ranky++; else rankz++;
    if (y0 > w0) ranky++; else rankw++;
    if (z0 > w0) rankz++; else rankw++;

    const i1 = rankx >= 3 ? 1 : 0, j1 = ranky >= 3 ? 1 : 0, k1 = rankz >= 3 ? 1 : 0, l1 = rankw >= 3 ? 1 : 0;
    const i2 = rankx >= 2 ? 1 : 0, j2 = ranky >= 2 ? 1 : 0, k2 = rankz >= 2 ? 1 : 0, l2 = rankw >= 2 ? 1 : 0;
    const i3 = rankx >= 1 ? 1 : 0, j3 = ranky >= 1 ? 1 : 0, k3 = rankz >= 1 ? 1 : 0, l3 = rankw >= 1 ? 1 : 0;

    const x1 = x0 - i1 + G4, y1 = y0 - j1 + G4, z1 = z0 - k1 + G4, w1 = w0 - l1 + G4;
    const x2 = x0 - i2 + 2*G4, y2 = y0 - j2 + 2*G4, z2 = z0 - k2 + 2*G4, w2 = w0 - l2 + 2*G4;
    const x3 = x0 - i3 + 3*G4, y3 = y0 - j3 + 3*G4, z3 = z0 - k3 + 3*G4, w3 = w0 - l3 + 3*G4;
    const x4 = x0 - 1 + 4*G4, y4 = y0 - 1 + 4*G4, z4 = z0 - 1 + 4*G4, w4 = w0 - 1 + 4*G4;

    const ii = i & 255, jj = j & 255, kk = k & 255, ll = l & 255;

    let n0 = 0, n1 = 0, n2 = 0, n3 = 0, n4 = 0;

    let t0 = 0.6 - x0*x0 - y0*y0 - z0*z0 - w0*w0;
    if (t0 >= 0) {
      t0 *= t0;
      const gi = perm[ii + perm[jj + perm[kk + perm[ll]]]] % 32;
      n0 = t0 * t0 * (grad4[gi][0]*x0 + grad4[gi][1]*y0 + grad4[gi][2]*z0 + grad4[gi][3]*w0);
    }

    let t1 = 0.6 - x1*x1 - y1*y1 - z1*z1 - w1*w1;
    if (t1 >= 0) {
      t1 *= t1;
      const gi = perm[ii+i1 + perm[jj+j1 + perm[kk+k1 + perm[ll+l1]]]] % 32;
      n1 = t1 * t1 * (grad4[gi][0]*x1 + grad4[gi][1]*y1 + grad4[gi][2]*z1 + grad4[gi][3]*w1);
    }

    let t2 = 0.6 - x2*x2 - y2*y2 - z2*z2 - w2*w2;
    if (t2 >= 0) {
      t2 *= t2;
      const gi = perm[ii+i2 + perm[jj+j2 + perm[kk+k2 + perm[ll+l2]]]] % 32;
      n2 = t2 * t2 * (grad4[gi][0]*x2 + grad4[gi][1]*y2 + grad4[gi][2]*z2 + grad4[gi][3]*w2);
    }

    let t3 = 0.6 - x3*x3 - y3*y3 - z3*z3 - w3*w3;
    if (t3 >= 0) {
      t3 *= t3;
      const gi = perm[ii+i3 + perm[jj+j3 + perm[kk+k3 + perm[ll+l3]]]] % 32;
      n3 = t3 * t3 * (grad4[gi][0]*x3 + grad4[gi][1]*y3 + grad4[gi][2]*z3 + grad4[gi][3]*w3);
    }

    let t4 = 0.6 - x4*x4 - y4*y4 - z4*z4 - w4*w4;
    if (t4 >= 0) {
      t4 *= t4;
      const gi = perm[ii+1 + perm[jj+1 + perm[kk+1 + perm[ll+1]]]] % 32;
      n4 = t4 * t4 * (grad4[gi][0]*x4 + grad4[gi][1]*y4 + grad4[gi][2]*z4 + grad4[gi][3]*w4);
    }

    return 27.0 * (n0 + n1 + n2 + n3 + n4);
  }

  fbm2D(x: number, y: number, octaves: number): number {
    let value = 0, amplitude = 1, maxAmp = 0, freq = 1;
    for (let i = 0; i < octaves; i++) {
      value += this.noise2D(x * freq, y * freq) * amplitude;
      maxAmp += amplitude;
      amplitude *= 0.5;
      freq *= 2;
    }
    return value / maxAmp;
  }

  fbm3D(x: number, y: number, z: number, octaves: number): number {
    let value = 0, amplitude = 1, maxAmp = 0, freq = 1;
    for (let i = 0; i < octaves; i++) {
      value += this.noise3D(x * freq, y * freq, z * freq) * amplitude;
      maxAmp += amplitude;
      amplitude *= 0.5;
      freq *= 2;
    }
    return value / maxAmp;
  }

  fbm4D(x: number, y: number, z: number, w: number, octaves: number): number {
    let value = 0, amplitude = 1, maxAmp = 0, freq = 1;
    for (let i = 0; i < octaves; i++) {
      value += this.noise4D(x * freq, y * freq, z * freq, w * freq) * amplitude;
      maxAmp += amplitude;
      amplitude *= 0.5;
      freq *= 2;
    }
    return value / maxAmp;
  }
}
