// Fragment shaders for the WebGL backgrounds. All share the same uniforms:
// u_time (s), u_res (px), u_c1..u_c3 (palette, 0–1 RGB), u_pulse (0–1, spikes on each beat or new lyric line)
// and the live music: u_bass, u_mid, u_high (0–1, all 0 when not listening) and u_beatAge (seconds since the last beat).

const HEADER = `
precision highp float;
uniform float u_time;
uniform vec2 u_res;
uniform vec3 u_c1;
uniform vec3 u_c2;
uniform vec3 u_c3;
uniform float u_pulse;
uniform float u_bass;
uniform float u_mid;
uniform float u_high;
uniform float u_beatAge;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.02 + vec2(1.7, 9.2); a *= 0.5; }
  return v;
}
// Domain-warped noise: the soft, liquid gradient used by music players.
vec3 fluid(vec2 uv, float speed) {
  vec2 p = uv * vec2(u_res.x / u_res.y, 1.0) * 1.5;
  float t = u_time * speed;
  vec2 q = vec2(fbm(p + vec2(0.0, t)), fbm(p + vec2(5.2, 1.3) - t));
  vec2 r = vec2(fbm(p + 3.0 * q + vec2(1.7, 9.2) + 1.3 * t), fbm(p + 3.0 * q + vec2(8.3, 2.8) - t));
  float f = fbm(p + 2.5 * r);
  vec3 col = mix(u_c1, u_c2, clamp(f * 1.7 - 0.2, 0.0, 1.0));
  col = mix(col, u_c3, clamp(dot(q, q) * 0.9, 0.0, 1.0));
  col = mix(col, vec3(0.0), clamp(r.x * r.x * 1.3, 0.0, 0.8));
  return col * (0.55 + 0.65 * f + u_pulse * 0.25 + u_bass * 0.2);
}
`

export const FLUID = HEADER + `
void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  vec3 col = fluid(uv, 0.07);
  // Gentle vignette.
  col *= 1.0 - 0.45 * dot(uv - 0.5, uv - 0.5) * 2.0;
  gl_FragColor = vec4(col, 1.0);
}`

// Ordered (Bayer) dithering of the fluid gradient: the crunchy 1-bit look.
export const DITHER = HEADER + `
float bayer2(vec2 a) { a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
float bayer8(vec2 a) { return bayer2(0.25 * a) * 0.0625 + bayer2(0.5 * a) * 0.25 + bayer2(a); }
void main() {
  float px = 3.0;
  vec2 cell = floor(gl_FragCoord.xy / px);
  vec2 uv = cell * px / u_res;
  vec3 col = fluid(uv, 0.05);
  float l = dot(col, vec3(0.299, 0.587, 0.114));
  float d = bayer8(cell) - 0.5;
  float level = floor(clamp(l * 3.2 + d, 0.0, 3.0));
  vec3 outc = level < 0.5 ? vec3(0.02) : level < 1.5 ? u_c1 * 0.55 : level < 2.5 ? u_c2 : mix(u_c3, vec3(1.0), 0.35);
  gl_FragColor = vec4(outc, 1.0);
}`

// Lava lamp: metaballs drifting and merging, with a hot rim.
export const LAVA = HEADER + `
void main() {
  float aspect = u_res.x / u_res.y;
  vec2 p = gl_FragCoord.xy / u_res.y;
  float t = u_time * 0.35;
  float field = 0.0;
  for (int i = 0; i < 8; i++) {
    float fi = float(i);
    vec2 c = vec2(aspect * (0.5 + 0.38 * sin(t * (0.6 + fi * 0.13) + fi * 1.7)), 0.5 + 0.42 * sin(t * (0.45 + fi * 0.11) + fi * 2.9));
    float r = 0.08 + 0.04 * sin(fi * 3.1 + t * 0.7) + u_pulse * 0.025;
    vec2 d = p - c;
    field += r * r / max(dot(d, d), 1e-4);
  }
  vec3 bg = mix(vec3(0.01, 0.0, 0.02), u_c3 * 0.18, gl_FragCoord.y / u_res.y);
  vec3 inside = mix(u_c1, u_c2, clamp(gl_FragCoord.y / u_res.y + 0.2 * sin(t), 0.0, 1.0));
  float body = smoothstep(0.95, 1.05, field);
  float rim = smoothstep(0.55, 1.0, field) * (1.0 - body);
  vec3 col = bg + rim * u_c3 * 0.9 + body * inside * (0.85 + 0.25 * smoothstep(1.0, 3.0, field));
  gl_FragColor = vec4(col, 1.0);
}`

// Retro synthwave: striped sun over a scrolling neon grid.
export const SYNTH = HEADER + `
void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_res) / u_res.y;
  float hz = -0.08;
  vec3 col;
  if (uv.y > hz) {
    col = mix(u_c3 * 0.35, vec3(0.02, 0.0, 0.05), clamp((uv.y - hz) * 1.8, 0.0, 1.0));
    vec2 sp = uv - vec2(0.0, 0.14);
    float d = length(sp);
    float sun = smoothstep(0.3, 0.295, d);
    float band = fract(sp.y * 22.0 - u_time * 0.25);
    float cut = sp.y < 0.0 ? step(clamp(-sp.y * 3.2, 0.0, 1.0), band) : 1.0;
    vec3 sunc = mix(u_c2, u_c1, clamp(sp.y * 2.2 + 0.5, 0.0, 1.0));
    col = mix(col, sunc, sun * cut);
    col += sunc * (0.3 + u_pulse * 0.3) * exp(-d * 4.5);
    // A few stars.
    float s = step(0.997, hash(floor(gl_FragCoord.xy / 2.0))) * smoothstep(hz, 0.5, uv.y);
    col += s * 0.8;
  } else {
    float z = 0.35 / (hz - uv.y + 0.002);
    vec2 g = vec2(uv.x * z, z + u_time * 1.1);
    float lx = abs(fract(g.x) - 0.5);
    float ly = abs(fract(g.y) - 0.5);
    float w = 0.03 + 0.01 * z;
    float line = max(smoothstep(0.5 - w, 0.5, lx), smoothstep(0.5 - w, 0.5, ly));
    float fade = clamp(1.0 - z * 0.05, 0.0, 1.0);
    col = mix(vec3(0.03, 0.0, 0.06), u_c1 * (1.2 + u_pulse), line * fade);
    col += u_c2 * 0.25 * exp(-(hz - uv.y) * 9.0);
  }
  gl_FragColor = vec4(col, 1.0);
}`

/** Pulse: a glowing core that breathes with the bass, rings that ripple out on every beat. */
export const PULSE = HEADER + `
void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_res) / u_res.y;
  float d = length(uv);
  float a = atan(uv.y, uv.x);
  float wob = 0.03 * sin(a * 6.0 + u_time * 1.3) * (0.4 + u_mid) + 0.02 * fbm(uv * 3.0 + u_time * 0.3);
  float core = 0.16 + 0.1 * u_bass + 0.04 * u_pulse;
  vec3 col = mix(u_c2, u_c1, smoothstep(0.0, core * 2.4, d)) * exp(-pow(max(0.0, d - core - wob), 1.2) * 4.0);
  // Ripples: one per recent beat, expanding and fading.
  for (int i = 0; i < 4; i++) {
    // Keeps rippling between beats too; each beat restarts the cycle from the centre.
    float age = mod(u_beatAge + float(i) * 0.5, 2.0);
    float r = core + age * 0.55;
    float ring = exp(-pow((d - r - wob) * 34.0, 2.0)) * exp(-age * 1.6);
    col += mix(u_c3, u_c1, float(i) / 3.0) * ring * (0.9 + u_high);
  }
  col += u_c3 * 0.08 * fbm(vec2(a * 3.0, d * 6.0 - u_time * 0.6)) * (1.0 - smoothstep(0.0, 1.2, d));
  col *= 0.55 + 0.6 * u_pulse + 0.35 * u_bass;
  gl_FragColor = vec4(col, 1.0);
}`

/** Nebula: deep, drifting cosmic smoke; bass pushes it towards you, treble makes stars sparkle. */
export const NEBULA = HEADER + `
void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_res) / u_res.y;
  float zoom = 1.6 - 0.25 * u_bass - 0.1 * u_pulse;
  vec2 p = uv * zoom;
  float t = u_time * 0.12;
  vec2 q = vec2(fbm(p * 1.4 + t), fbm(p * 1.4 - t + 4.0));
  float f = fbm(p * 2.0 + q * 2.2 + vec2(t * 2.0, -t));
  vec3 col = mix(u_c1 * 0.15, u_c2, smoothstep(0.35, 0.85, f));
  col = mix(col, u_c3, smoothstep(0.6, 1.0, f * (1.0 + 0.4 * u_mid)) * 0.8);
  col *= 0.35 + 0.9 * f * f + 0.35 * u_pulse;
  // Stars
  vec2 g = floor(gl_FragCoord.xy);
  float s = step(0.9985, hash(g));
  float tw = 0.5 + 0.5 * sin(u_time * 3.0 + hash(g + 7.0) * 40.0);
  col += vec3(s * tw * (0.5 + 1.5 * u_high));
  gl_FragColor = vec4(col, 1.0);
}`

/** Tunnel: flying through rings of light; speed follows the music, rings flash on the beat. */
export const TUNNEL = HEADER + `
void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_res) / u_res.y;
  float r = length(uv) + 1e-3;
  float a = atan(uv.y, uv.x) / 6.28318;
  float z = 0.35 / r + u_time * 0.9;
  float seg = fract(z * 2.0);
  float ring = smoothstep(0.0, 0.06, seg) * smoothstep(0.16, 0.06, seg);
  float spokes = smoothstep(0.47, 0.5, abs(fract(a * 12.0 + z * 0.15) - 0.5));
  vec3 base = mix(u_c1, u_c2, 0.5 + 0.5 * sin(z * 1.3 + a * 6.28));
  vec3 col = base * ring * (0.6 + 1.2 * u_pulse + 0.6 * u_bass);
  col += u_c3 * spokes * 0.25 * (0.5 + u_high);
  col *= smoothstep(0.0, 0.35, r) * (1.0 - smoothstep(0.9, 1.4, r) * 0.4);
  col += u_c3 * 0.12 * exp(-r * 6.0) * (1.0 + 2.0 * u_bass);
  gl_FragColor = vec4(col, 1.0);
}`
