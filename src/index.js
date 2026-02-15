/**
 * ux-color-engine (Primary Fixed + Light/Dark + Extended UI Tokens)
 * - OKLab/OKLCH internal color space
 * - WCAG contrast ratio (AA/AAA)
 * - Basic CVD simulation (approx matrices)
 * - Simulated annealing optimization
 *
 * Outputs:
 * - Light/Dark token sets simultaneously
 * - Primary fixed (optionally separate per mode)
 * - Expanded tokens: borders/dividers/focus ring + button/semantic states
 *
 * Zero dependencies.
 */

/* -----------------------------
   Deterministic RNG (xorshift)
------------------------------ */
class RNG {
  constructor(seed = 123456789) {
    this.state = seed >>> 0;
  }
  next() {
    let x = this.state;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.state = x >>> 0;
    return (this.state >>> 0) / 0xffffffff;
  }
  int(lo, hi) {
    return Math.floor(this.next() * (hi - lo + 1)) + lo;
  }
  float(lo, hi) {
    return this.next() * (hi - lo) + lo;
  }
  pick(arr) {
    return arr[this.int(0, arr.length - 1)];
  }
}

/* -----------------------------
   Helpers
------------------------------ */
function clamp(x, lo, hi) {
  return Math.min(hi, Math.max(lo, x));
}

function mod360(h) {
  let x = h % 360;
  if (x < 0) x += 360;
  return x;
}

function hueDistance(a, b) {
  const d = Math.abs(mod360(a) - mod360(b));
  return Math.min(d, 360 - d);
}

/* -----------------------------
   Color conversions
   sRGB <-> Linear <-> OKLab / OKLCH
------------------------------ */
export function hexToRgb(hex) {
  const h = hex.trim().replace(/^#/, "");
  if (h.length !== 6) throw new Error(`Invalid hex: ${hex}`);
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return { r, g, b };
}

export function rgbToHex(rgb) {
  const r = clamp(rgb.r, 0, 1);
  const g = clamp(rgb.g, 0, 1);
  const b = clamp(rgb.b, 0, 1);
  const ri = Math.round(r * 255);
  const gi = Math.round(g * 255);
  const bi = Math.round(b * 255);
  return (
    "#" +
    ri.toString(16).padStart(2, "0") +
    gi.toString(16).padStart(2, "0") +
    bi.toString(16).padStart(2, "0")
  ).toUpperCase();
}

export function srgbToLinear(c) {
  if (c <= 0.04045) return c / 12.92;
  return Math.pow((c + 0.055) / 1.055, 2.4);
}

export function linearToSrgb(c) {
  if (c <= 0.0031308) return 12.92 * c;
  return 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

export function rgbToLinearRgb(rgb) {
  return { r: srgbToLinear(rgb.r), g: srgbToLinear(rgb.g), b: srgbToLinear(rgb.b) };
}

export function linearRgbToRgb(rgb) {
  return { r: linearToSrgb(rgb.r), g: linearToSrgb(rgb.g), b: linearToSrgb(rgb.b) };
}

export function linearRgbToOklab(rgb) {
  const r = rgb.r,
    g = rgb.g,
    b = rgb.b;

  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;

  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);

  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const b2 = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;

  return { L, a, b: b2 };
}

export function oklabToLinearRgb(lab) {
  const L = lab.L,
    a = lab.a,
    b = lab.b;

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const b2 = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

  return { r, g, b: b2 };
}

export function oklabToOklch(lab) {
  const C = Math.sqrt(lab.a * lab.a + lab.b * lab.b);
  const H = mod360((Math.atan2(lab.b, lab.a) * 180) / Math.PI);
  return { L: lab.L, C, H };
}

export function oklchToOklab(lch) {
  const a = lch.C * Math.cos((lch.H * Math.PI) / 180);
  const b = lch.C * Math.sin((lch.H * Math.PI) / 180);
  return { L: lch.L, a, b };
}

export function hexToOklch(hex) {
  const rgb = hexToRgb(hex);
  const lin = rgbToLinearRgb(rgb);
  const lab = linearRgbToOklab(lin);
  return oklabToOklch(lab);
}

export function oklchToHex(lch) {
  const lab = oklchToOklab(lch);
  const lin = oklabToLinearRgb(lab);
  const rgb = linearRgbToRgb(lin);
  const inGamut =
    rgb.r >= 0 && rgb.r <= 1 && rgb.g >= 0 && rgb.g <= 1 && rgb.b >= 0 && rgb.b <= 1;
  return { hex: rgbToHex(rgb), inGamut };
}

/* -----------------------------
   WCAG Contrast
------------------------------ */
export function relativeLuminance(rgb) {
  const r = srgbToLinear(rgb.r);
  const g = srgbToLinear(rgb.g);
  const b = srgbToLinear(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(fgHex, bgHex) {
  const fg = hexToRgb(fgHex);
  const bg = hexToRgb(bgHex);
  const L1 = relativeLuminance(fg);
  const L2 = relativeLuminance(bg);
  const lighter = Math.max(L1, L2);
  const darker = Math.min(L1, L2);
  return (lighter + 0.05) / (darker + 0.05);
}

function targetContrast(target) {
  return {
    normal: target === "AAA" ? 7.0 : 4.5,
    large: target === "AAA" ? 4.5 : 3.0,
  };
}

/* -----------------------------
   CVD Simulation (approx matrices)
------------------------------ */
const CVD_MATS = {
  protan: [
    [0.56667, 0.43333, 0.0],
    [0.55833, 0.44167, 0.0],
    [0.0, 0.24167, 0.75833],
  ],
  deutan: [
    [0.625, 0.375, 0.0],
    [0.7, 0.3, 0.0],
    [0.0, 0.3, 0.7],
  ],
  tritan: [
    [0.95, 0.05, 0.0],
    [0.0, 0.43333, 0.56667],
    [0.0, 0.475, 0.525],
  ],
};

export function applyCvd(hex, mode) {
  if (mode === "none") return hex.toUpperCase();
  const mat = CVD_MATS[mode];
  const rgb = hexToRgb(hex);
  const r = clamp(mat[0][0] * rgb.r + mat[0][1] * rgb.g + mat[0][2] * rgb.b, 0, 1);
  const g = clamp(mat[1][0] * rgb.r + mat[1][1] * rgb.g + mat[1][2] * rgb.b, 0, 1);
  const b = clamp(mat[2][0] * rgb.r + mat[2][1] * rgb.g + mat[2][2] * rgb.b, 0, 1);
  return rgbToHex({ r, g, b });
}

/* -----------------------------
   Distance / ΔE in OKLab (euclidean)
------------------------------ */
export function deltaEoklab(hex1, hex2) {
  const lch1 = hexToOklch(hex1);
  const lch2 = hexToOklch(hex2);
  const lab1 = oklchToOklab(lch1);
  const lab2 = oklchToOklab(lch2);
  const dL = lab1.L - lab2.L;
  const da = lab1.a - lab2.a;
  const db = lab1.b - lab2.b;
  return Math.sqrt(dL * dL + da * da + db * db);
}

/* -----------------------------
   Token param model (primary fixed)
------------------------------ */
function defaultWeights(overrides) {
  const base = {
    contrast: 3.2,
    toneSystem: 1.1,
    emphasis: 1.3,
    harmony: 0.7,
    cvdRobust: 1.4,
    semanticSeparation: 1.0,
    gamutPenalty: 2.0,
    stateContrast: 1.4,
  };
  return { ...base, ...(overrides || {}) };
}

function lch(L, C, H) {
  return { L: clamp(L, 0, 1), C: Math.max(0, C), H: mod360(H) };
}

function pickTextOn(fillHex) {
  const lum = relativeLuminance(hexToRgb(fillHex));
  return lum > 0.5 ? "#000000" : "#FFFFFF";
}

function deriveFillStates(baseHex, mode) {
  const base = hexToOklch(baseHex);
  const dir = mode === "light" ? -1 : 1;

  const hoverL = clamp(base.L + dir * 0.04, 0, 1);
  const pressedL = clamp(base.L + dir * 0.08, 0, 1);

  const disabledL = clamp(mode === "light" ? 0.85 : 0.25, 0, 1);
  const disabledC = Math.min(base.C, 0.02);

  const hover = oklchToHex(lch(hoverL, base.C, base.H)).hex;
  const pressed = oklchToHex(lch(pressedL, base.C, base.H)).hex;
  const disabled = oklchToHex(lch(disabledL, disabledC, base.H)).hex;

  return { hover, pressed, disabled };
}

function deriveSubtleBg(baseHex, bgHex, mode) {
  const base = hexToOklch(baseHex);
  const bg = hexToOklch(bgHex);

  const targetL = clamp(
    mode === "light" ? Math.max(bg.L - 0.05, 0.88) : Math.min(bg.L + 0.1, 0.22),
    0,
    1
  );
  const C = Math.min(0.05, Math.max(0.02, base.C * 0.35));

  return oklchToHex(lch(targetL, C, base.H)).hex;
}

function deriveBorderFrom(bgOrSurfaceHex, mode, deltaL, hue) {
  const ref = hexToOklch(bgOrSurfaceHex);
  const L = clamp(ref.L + (mode === "light" ? -deltaL : deltaL), 0, 1);
  const C = Math.min(0.02, Math.max(0.004, ref.C));
  return oklchToHex(lch(L, C, hue)).hex;
}

function deriveFocusRing(fromHex, mode, cBoost, targetL) {
  const src = hexToOklch(fromHex);
  const C = clamp(src.C + cBoost, 0.08, 0.26);
  const L = clamp(targetL, 0.25, 0.85);
  return oklchToHex(lch(L, C, src.H)).hex;
}

function buildTokens(params, mode, primaryHexFixed) {
  let gamutCount = 0;

  const bg = oklchToHex(lch(params.bgL, params.neutralC, params.neutralHue));
  const surface = oklchToHex(
    lch(
      clamp(params.bgL + (mode === "light" ? -params.surfaceDeltaL : params.surfaceDeltaL), 0, 1),
      params.neutralC * 1.05,
      params.neutralHue
    )
  );
  const surface2 = oklchToHex(
    lch(
      clamp(
        params.bgL + (mode === "light" ? -params.surface2DeltaL : params.surface2DeltaL),
        0,
        1
      ),
      params.neutralC * 1.1,
      params.neutralHue
    )
  );

  const textPrimary = oklchToHex(
    lch(params.textPrimaryL, params.neutralC * 0.12, params.neutralHue)
  );
  const textSecondary = oklchToHex(
    lch(params.textSecondaryL, params.neutralC * 0.14, params.neutralHue)
  );
  const textTertiary = oklchToHex(
    lch(params.textTertiaryL, params.neutralC * 0.16, params.neutralHue)
  );

  const secondary = oklchToHex(lch(params.secondaryL, params.secondaryC, params.secondaryHue));
  const accent = oklchToHex(lch(params.accentL, params.accentC, params.accentHue));

  const primaryHex = normalizeHex(primaryHexFixed);
  const primaryLch = hexToOklch(primaryHex);

  const border = deriveBorderFrom(surface.hex, mode, params.borderDeltaL, params.neutralHue);
  const divider = deriveBorderFrom(surface2.hex, mode, params.dividerDeltaL, params.neutralHue);

  const focusSourceHex = params.focusFrom === "primary" ? primaryHex : accent.hex;
  const focusRing = deriveFocusRing(focusSourceHex, mode, params.focusCBoost, params.focusL);

  const primaryText = pickTextOn(primaryHex);
  const primaryStates = deriveFillStates(primaryHex, mode);
  const primaryDisabledText = mode === "light" ? "#9AA0A6" : "#6B7280";

  const secondaryTextOn = pickTextOn(secondary.hex);
  const secondaryStates = deriveFillStates(secondary.hex, mode);
  const secondaryDisabledText = primaryDisabledText;

  const buttonPrimary = {
    bg: primaryHex,
    text: primaryText,
    hoverBg: primaryStates.hover,
    pressedBg: primaryStates.pressed,
    disabledBg: primaryStates.disabled,
    disabledText: secondaryDisabledText,
  };

  const buttonSecondary = {
    bg: secondary.hex,
    text: secondaryTextOn,
    hoverBg: secondaryStates.hover,
    pressedBg: secondaryStates.pressed,
    disabledBg: secondaryStates.disabled,
    disabledText: secondaryDisabledText,
  };

  const successBase = oklchToHex(lch(params.successL, params.semanticC, params.successHue));
  const warningBase = oklchToHex(lch(params.warningL, params.semanticC, params.warningHue));
  const dangerBase = oklchToHex(lch(params.dangerL, params.semanticC, params.dangerHue));
  const infoBase = oklchToHex(lch(params.infoL, params.semanticC, params.infoHue));

  const semList = [
    bg,
    surface,
    surface2,
    textPrimary,
    textSecondary,
    textTertiary,
    secondary,
    accent,
    successBase,
    warningBase,
    dangerBase,
    infoBase,
  ];
  for (const e of semList) if (!e.inGamut) gamutCount += 1;

  const sem = {
    success: buildSemanticStates(successBase.hex, bg.hex, mode),
    warning: buildSemanticStates(warningBase.hex, bg.hex, mode),
    danger: buildSemanticStates(dangerBase.hex, bg.hex, mode),
    info: buildSemanticStates(infoBase.hex, bg.hex, mode),
  };

  const secondaryText = secondaryTextOn;
  const accentText = pickTextOn(accent.hex);

  const tokens = {
    mode,

    background: bg.hex,
    surface: surface.hex,
    surface2: surface2.hex,

    textPrimary: textPrimary.hex,
    textSecondary: textSecondary.hex,
    textTertiary: textTertiary.hex,

    primary: primaryHex,
    primaryText,

    secondary: secondary.hex,
    secondaryText,

    accent: accent.hex,
    accentText,

    border,
    divider,
    focusRing,

    buttonPrimary,
    buttonSecondary,

    semantic: sem,
  };

  const Linfo = {
    background: params.bgL,
    surface: clamp(
      params.bgL + (mode === "light" ? -params.surfaceDeltaL : params.surfaceDeltaL),
      0,
      1
    ),
    surface2: clamp(
      params.bgL + (mode === "light" ? -params.surface2DeltaL : params.surface2DeltaL),
      0,
      1
    ),
    textPrimary: params.textPrimaryL,
    textSecondary: params.textSecondaryL,
    textTertiary: params.textTertiaryL,
    primary: primaryLch.L,
    secondary: params.secondaryL,
    accent: params.accentL,
  };

  return { tokens, gamutCount, Linfo };
}

function buildSemanticStates(baseHex, bgHex, mode) {
  const base = normalizeHex(baseHex);
  const onBaseText = pickTextOn(base);

  const subtleBg = deriveSubtleBg(base, bgHex, mode);
  const subtleText = normalizeHex(base);

  const border = deriveBorderFrom(subtleBg, mode, 0.04, hexToOklch(base).H);

  const states = deriveFillStates(base, mode);

  return {
    base,
    onBaseText,
    subtleBg,
    subtleText,
    border,
    hover: states.hover,
    pressed: states.pressed,
  };
}

function normalizeHex(hex) {
  const h = hex.trim().toUpperCase();
  if (!h.startsWith("#")) return ("#" + h).toUpperCase();
  return h;
}

/* -----------------------------
   Scoring
------------------------------ */
function scoreContrastBase(tokens, target, cvdMode) {
  const { normal, large } = targetContrast(target);
  const checks = [];

  const add = (pair, fg, bg, min) => {
    const ratio = contrastRatio(applyCvd(fg, cvdMode), applyCvd(bg, cvdMode));
    const pass = ratio >= min;
    checks.push({ pair, ratio, pass, mode: cvdMode });
  };

  add("textPrimary/background (normal)", tokens.textPrimary, tokens.background, normal);
  add("textPrimary/surface (normal)", tokens.textPrimary, tokens.surface, normal);
  add("textSecondary/background (normal)", tokens.textSecondary, tokens.background, normal);
  add("textSecondary/surface (normal)", tokens.textSecondary, tokens.surface, normal);
  add("textTertiary/surface (normal)", tokens.textTertiary, tokens.surface, large);

  add("primaryText/primary (normal)", tokens.primaryText, tokens.primary, normal);
  add("secondaryText/secondary (normal)", tokens.secondaryText, tokens.secondary, normal);
  add("accentText/accent (normal)", tokens.accentText, tokens.accent, normal);

  add("textPrimary/background (large)", tokens.textPrimary, tokens.background, large);

  const passAll = checks.every((c) => c.pass);
  const worstRatio = checks.reduce((m, c) => Math.min(m, c.ratio), Infinity);

  return { target, normalTextMin: normal, largeTextMin: large, checks, passAll, worstRatio };
}

function scoreContrastStates(tokens, target, cvdMode) {
  const { normal } = targetContrast(target);
  const checks = [];

  const add = (pair, fg, bg, min) => {
    const ratio = contrastRatio(applyCvd(fg, cvdMode), applyCvd(bg, cvdMode));
    const pass = ratio >= min;
    checks.push({ pair, ratio, pass, mode: cvdMode });
  };

  add("btnPrimary/text:hoverBg", tokens.buttonPrimary.text, tokens.buttonPrimary.hoverBg, normal);
  add(
    "btnPrimary/text:pressedBg",
    tokens.buttonPrimary.text,
    tokens.buttonPrimary.pressedBg,
    normal
  );

  add(
    "btnSecondary/text:hoverBg",
    tokens.buttonSecondary.text,
    tokens.buttonSecondary.hoverBg,
    normal
  );
  add(
    "btnSecondary/text:pressedBg",
    tokens.buttonSecondary.text,
    tokens.buttonSecondary.pressedBg,
    normal
  );

  add(
    "semantic.success/subtleText:subtleBg",
    tokens.semantic.success.subtleText,
    tokens.semantic.success.subtleBg,
    normal
  );
  add(
    "semantic.warning/subtleText:subtleBg",
    tokens.semantic.warning.subtleText,
    tokens.semantic.warning.subtleBg,
    normal
  );
  add(
    "semantic.danger/subtleText:subtleBg",
    tokens.semantic.danger.subtleText,
    tokens.semantic.danger.subtleBg,
    normal
  );
  add(
    "semantic.info/subtleText:subtleBg",
    tokens.semantic.info.subtleText,
    tokens.semantic.info.subtleBg,
    normal
  );

  const passAll = checks.every((c) => c.pass);
  const worstRatio = checks.reduce((m, c) => Math.min(m, c.ratio), Infinity);

  return { checks, passAll, worstRatio };
}

function scoreToneSystem(mode, Linfo) {
  const notes = [];
  let ok = true;

  const bg = Linfo.background;
  const sf = Linfo.surface;
  const sf2 = Linfo.surface2;
  const tp = Linfo.textPrimary;
  const ts = Linfo.textSecondary;
  const tt = Linfo.textTertiary;

  if (mode === "light") {
    if (bg < 0.85) {
      ok = false;
      notes.push("라이트: background L 권장 >= 0.85");
    }
    if (!(sf < bg && bg - sf >= 0.03 && bg - sf <= 0.14)) {
      ok = false;
      notes.push("라이트: surface는 bg보다 살짝 어두워야 함(ΔL 0.03~0.14)");
    }
    if (!(sf2 <= sf && sf - sf2 >= 0.01 && sf - sf2 <= 0.08)) {
      ok = false;
      notes.push("라이트: surface2는 surface보다 조금 더 어두운 층 권장");
    }
    if (tp > 0.26) {
      ok = false;
      notes.push("라이트: textPrimary L 권장 <= 0.26");
    }
    if (!(ts > tp && ts <= 0.45)) {
      ok = false;
      notes.push("라이트: textSecondary는 primary보다 밝고 너무 밝지 않게");
    }
    if (!(tt >= ts && tt <= 0.6)) {
      ok = false;
      notes.push("라이트: textTertiary는 secondary보다 밝고 너무 밝지 않게");
    }
  } else {
    if (bg > 0.18) {
      ok = false;
      notes.push("다크: background L 권장 <= 0.18");
    }
    if (!(sf > bg && sf - bg >= 0.03 && sf - bg <= 0.14)) {
      ok = false;
      notes.push("다크: surface는 bg보다 살짝 밝아야 함(ΔL 0.03~0.14)");
    }
    if (!(sf2 >= sf && sf2 - sf >= 0.01 && sf2 - sf <= 0.08)) {
      ok = false;
      notes.push("다크: surface2는 surface보다 조금 더 밝은 층 권장");
    }
    if (tp < 0.78) {
      ok = false;
      notes.push("다크: textPrimary L 권장 >= 0.78");
    }
    if (!(ts < tp && ts >= 0.6)) {
      ok = false;
      notes.push("다크: textSecondary는 primary보다 어둡되 너무 어둡지 않게");
    }
    if (!(tt <= ts && tt >= 0.45)) {
      ok = false;
      notes.push("다크: textTertiary는 secondary보다 어둡되 너무 어둡지 않게");
    }
  }

  return { mode, L: { ...Linfo }, ok, notes };
}

function scoreEmphasis(tokens) {
  const p = hexToOklch(tokens.primary);
  const s = hexToOklch(tokens.surface);

  const dL = Math.abs(p.L - s.L);
  const dC = Math.abs(p.C - s.C);
  const dH = hueDistance(p.H, s.H);

  const score = clamp((dL / 0.2) * 0.35 + (dC / 0.14) * 0.55 + (dH / 90) * 0.1, 0, 1);
  const ok = dL >= 0.1 || dC >= 0.1;
  return { primaryVsSurface: { dL, dC, dH, score }, ok };
}

function classifyHarmony(seedHue, primaryHue, accentHue) {
  if (seedHue == null) {
    const d = hueDistance(primaryHue, accentHue);
    if (d < 15) return "mono";
    if (d < 45) return "analogous";
    if (Math.abs(d - 180) < 15) return "complementary";
    if (Math.abs(d - 150) < 20 || Math.abs(d - 210) < 20) return "split";
    if (Math.abs(d - 120) < 15) return "triadic";
    return "other";
  } else {
    const d3 = hueDistance(primaryHue, accentHue);
    if (d3 < 15) return "mono";
    if (d3 < 45) return "analogous";
    if (Math.abs(d3 - 180) < 20) return "complementary";
    if (Math.abs(d3 - 150) < 25 || Math.abs(d3 - 210) < 25) return "split";
    if (Math.abs(d3 - 120) < 20) return "triadic";
    return "other";
  }
}

function scoreHarmony(seedHue, tokens) {
  const p = hexToOklch(tokens.primary);
  const a = hexToOklch(tokens.accent);
  const rel = classifyHarmony(seedHue, p.H, a.H);
  const scoreMap = {
    mono: 0.9,
    analogous: 1.0,
    complementary: 0.9,
    split: 0.95,
    triadic: 0.85,
    other: 0.75,
  };

  return {
    hueRelations: {
      seedHue,
      primaryHue: p.H,
      accentHue: a.H,
      relation: rel,
    },
    score: scoreMap[rel],
  };
}

function scoreSemanticSeparation(tokens, cvdMode) {
  const roles = [
    ["success", tokens.semantic.success.base],
    ["warning", tokens.semantic.warning.base],
    ["danger", tokens.semantic.danger.base],
    ["info", tokens.semantic.info.base],
  ];

  const pairs = [];
  let minDE = Infinity;

  for (let i = 0; i < roles.length; i++) {
    for (let j = i + 1; j < roles.length; j++) {
      const n1 = roles[i][0];
      const n2 = roles[j][0];
      const c1 = applyCvd(roles[i][1], cvdMode);
      const c2 = applyCvd(roles[j][1], cvdMode);
      const dE = deltaEoklab(c1, c2);
      pairs.push({ pair: `${n1}-${n2}`, dE, mode: cvdMode });
      minDE = Math.min(minDE, dE);
    }
  }

  const ok = minDE >= 0.06;
  return { pairs, minDE, ok };
}

function aggregateScore(
  tokens,
  mode,
  target,
  weights,
  gamutCount,
  Linfo,
  cvdModes,
  seedHue
) {
  const contrastReports = cvdModes.map((m) => scoreContrastBase(tokens, target, m));
  const worstContrast = Math.min(...contrastReports.map((r) => r.worstRatio));
  const passAllAllModes = contrastReports.every((r) => r.passAll);

  const stateReports = cvdModes.map((m) => scoreContrastStates(tokens, target, m));
  const worstState = Math.min(...stateReports.map((r) => r.worstRatio));
  const passAllStates = stateReports.every((r) => r.passAll);

  const tone = scoreToneSystem(mode, Linfo);
  const emphasis = scoreEmphasis(tokens);
  const harmony = scoreHarmony(seedHue, tokens);

  const primaryDist = cvdModes.map((m) => {
    const p = applyCvd(tokens.primary, m);
    const s = applyCvd(tokens.surface, m);
    return { mode: m, dE: deltaEoklab(p, s) };
  });

  const semanticDist = cvdModes.map((m) => {
    const sem = scoreSemanticSeparation(tokens, m);
    let minPair = "";
    let minDE = Infinity;
    for (const p of sem.pairs) {
      if (p.dE < minDE) {
        minDE = p.dE;
        minPair = p.pair;
      }
    }
    return { mode: m, minPair, minDE };
  });

  const semanticNone = scoreSemanticSeparation(tokens, "none");

  const { normal } = targetContrast(target);

  const contrastScore = clamp((worstContrast - normal) / (normal * 0.6), 0, 1);
  const stateContrastScore = clamp((worstState - normal) / (normal * 0.6), 0, 1);

  const toneScore = tone.ok ? 1.0 : 0.65;
  const emphasisScore = emphasis.primaryVsSurface.score;
  const harmonyScore = clamp(harmony.score, 0, 1);

  const primaryDEmin = Math.min(...primaryDist.map((x) => x.dE));
  const semDEmin = Math.min(...semanticDist.map((x) => x.minDE));
  const cvdPrimaryScore = clamp((primaryDEmin - 0.05) / 0.1, 0, 1);
  const cvdSemanticScore = clamp((semDEmin - 0.05) / 0.1, 0, 1);
  const cvdScore = 0.55 * cvdPrimaryScore + 0.45 * cvdSemanticScore;

  const semanticScore = semanticNone.ok
    ? clamp((semanticNone.minDE - 0.06) / 0.08, 0, 1)
    : 0;

  const outOfGamutCount = gamutCount;
  const penaltyGamut = outOfGamutCount > 0 ? clamp(outOfGamutCount / 8, 0, 1) : 0;

  const hardContrastPenalty = passAllAllModes ? 0 : 0.85;
  const hardStatePenalty = passAllStates ? 0 : 0.65;

  const total =
    weights.contrast * contrastScore +
    weights.stateContrast * stateContrastScore +
    weights.toneSystem * toneScore +
    weights.emphasis * emphasisScore +
    weights.harmony * harmonyScore +
    weights.cvdRobust * cvdScore +
    weights.semanticSeparation * semanticScore -
    weights.gamutPenalty * penaltyGamut -
    4.0 * hardContrastPenalty -
    2.8 * hardStatePenalty;

  const mergedContrast = {
    target,
    normalTextMin: targetContrast(target).normal,
    largeTextMin: targetContrast(target).large,
    checks: contrastReports.flatMap((r) => r.checks),
    passAll: passAllAllModes,
    worstRatio: worstContrast,
  };

  const mergedStates = {
    checks: stateReports.flatMap((r) => r.checks),
    passAll: passAllStates,
    worstRatio: worstState,
  };

  return {
    mode,
    total,
    contrast: mergedContrast,
    tone,
    emphasis,
    harmony,
    cvd: { modes: cvdModes, primaryDist, semanticDist },
    semantic: semanticNone,
    states: mergedStates,
    penalties: {
      outOfGamutCount,
      penalty:
        weights.gamutPenalty * penaltyGamut +
        4.0 * hardContrastPenalty +
        2.8 * hardStatePenalty,
    },
  };
}

/* -----------------------------
   Params init & mutation
------------------------------ */
function initParams(rng, mode, seedHex, preferVibrant, semanticConventional) {
  let seedHue = rng.float(0, 360);
  if (seedHex) {
    try {
      seedHue = hexToOklch(seedHex).H;
    } catch {
      /* ignore */
    }
  }

  const isLight = mode === "light";

  const neutralHue = seedHex ? mod360(seedHue + rng.float(-10, 10)) : rng.float(0, 360);
  const neutralC = rng.float(0.004, 0.028);

  const bgL = isLight ? rng.float(0.88, 0.98) : rng.float(0.06, 0.16);
  const surfaceDeltaL = rng.float(0.04, 0.11);
  const surface2DeltaL = clamp(surfaceDeltaL + rng.float(0.01, 0.06), 0.05, 0.18);

  const textPrimaryL = isLight ? rng.float(0.1, 0.23) : rng.float(0.82, 0.95);
  const textSecondaryL = isLight ? rng.float(0.22, 0.4) : rng.float(0.6, 0.8);
  const textTertiaryL = isLight ? rng.float(0.36, 0.58) : rng.float(0.48, 0.68);

  const secondaryHue = mod360(seedHue + rng.float(-25, 25));
  const secondaryC = preferVibrant ? rng.float(0.05, 0.11) : rng.float(0.04, 0.09);
  const secondaryL = isLight ? rng.float(0.7, 0.88) : rng.float(0.18, 0.34);

  const accentStrategy = rng.int(0, 3);
  let accentHue = seedHue;
  if (accentStrategy === 0) accentHue = mod360(seedHue + rng.float(-12, 12));
  if (accentStrategy === 1) accentHue = mod360(seedHue + rng.float(20, 45));
  if (accentStrategy === 2) accentHue = mod360(seedHue + 180 + rng.float(-12, 12));
  if (accentStrategy === 3)
    accentHue = mod360(seedHue + rng.pick([150, 210]) + rng.float(-12, 12));
  const accentC = preferVibrant ? rng.float(0.1, 0.2) : rng.float(0.08, 0.16);
  const accentL = isLight ? rng.float(0.45, 0.66) : rng.float(0.45, 0.72);

  const successHue = semanticConventional
    ? mod360(145 + rng.float(-10, 10))
    : rng.float(0, 360);
  const warningHue = semanticConventional
    ? mod360(85 + rng.float(-12, 12))
    : rng.float(0, 360);
  const dangerHue = semanticConventional
    ? mod360(25 + rng.float(-12, 12))
    : rng.float(0, 360);
  const infoHue = semanticConventional
    ? mod360(245 + rng.float(-12, 12))
    : rng.float(0, 360);

  const semanticC = preferVibrant ? rng.float(0.12, 0.2) : rng.float(0.1, 0.18);
  const successL = isLight ? rng.float(0.45, 0.62) : rng.float(0.45, 0.62);
  const warningL = isLight ? rng.float(0.55, 0.72) : rng.float(0.55, 0.74);
  const dangerL = isLight ? rng.float(0.45, 0.62) : rng.float(0.45, 0.62);
  const infoL = isLight ? rng.float(0.45, 0.62) : rng.float(0.45, 0.62);

  const borderDeltaL = rng.float(0.02, 0.06);
  const dividerDeltaL = rng.float(0.03, 0.08);

  const focusFrom = rng.pick(["primary", "accent"]);
  const focusCBoost = preferVibrant ? rng.float(0.05, 0.1) : rng.float(0.04, 0.08);
  const focusL = isLight ? rng.float(0.45, 0.65) : rng.float(0.55, 0.75);

  return {
    seedHue,
    neutralHue,
    neutralC,
    bgL,
    surfaceDeltaL,
    surface2DeltaL,
    textPrimaryL,
    textSecondaryL,
    textTertiaryL,
    secondaryHue,
    secondaryC,
    secondaryL,
    accentHue,
    accentC,
    accentL,
    successHue,
    warningHue,
    dangerHue,
    infoHue,
    semanticC,
    successL,
    warningL,
    dangerL,
    infoL,
    borderDeltaL,
    dividerDeltaL,
    focusFrom,
    focusCBoost,
    focusL,
  };
}

function mutateParams(rng, p) {
  const q = { ...p };
  const jitter = (x, amt) => x + rng.float(-amt, amt);

  const pick = rng.int(0, 9);
  switch (pick) {
    case 0:
      q.bgL = clamp(jitter(q.bgL, 0.03), 0, 1);
      q.surfaceDeltaL = clamp(jitter(q.surfaceDeltaL, 0.02), 0.02, 0.16);
      q.surface2DeltaL = clamp(jitter(q.surface2DeltaL, 0.03), 0.03, 0.2);
      break;
    case 1:
      q.textPrimaryL = clamp(jitter(q.textPrimaryL, 0.04), 0, 1);
      q.textSecondaryL = clamp(jitter(q.textSecondaryL, 0.05), 0, 1);
      q.textTertiaryL = clamp(jitter(q.textTertiaryL, 0.06), 0, 1);
      break;
    case 2:
      q.secondaryHue = mod360(jitter(q.secondaryHue, 25));
      q.secondaryC = clamp(jitter(q.secondaryC, 0.03), 0.01, 0.16);
      q.secondaryL = clamp(jitter(q.secondaryL, 0.06), 0.12, 0.92);
      break;
    case 3:
      q.accentHue = mod360(jitter(q.accentHue, 30));
      q.accentC = clamp(jitter(q.accentC, 0.04), 0.02, 0.24);
      q.accentL = clamp(jitter(q.accentL, 0.07), 0.16, 0.92);
      break;
    case 4:
      q.neutralHue = mod360(jitter(q.neutralHue, 15));
      q.neutralC = clamp(jitter(q.neutralC, 0.01), 0.002, 0.06);
      break;
    case 5:
      q.semanticC = clamp(jitter(q.semanticC, 0.03), 0.06, 0.26);
      q.successL = clamp(jitter(q.successL, 0.05), 0.2, 0.85);
      q.warningL = clamp(jitter(q.warningL, 0.05), 0.2, 0.9);
      q.dangerL = clamp(jitter(q.dangerL, 0.05), 0.2, 0.85);
      q.infoL = clamp(jitter(q.infoL, 0.05), 0.2, 0.85);
      break;
    case 6:
      q.successHue = mod360(jitter(q.successHue, 15));
      q.warningHue = mod360(jitter(q.warningHue, 15));
      q.dangerHue = mod360(jitter(q.dangerHue, 15));
      q.infoHue = mod360(jitter(q.infoHue, 15));
      break;
    case 7:
      q.borderDeltaL = clamp(jitter(q.borderDeltaL, 0.02), 0.01, 0.1);
      q.dividerDeltaL = clamp(jitter(q.dividerDeltaL, 0.02), 0.02, 0.14);
      break;
    case 8:
      q.focusFrom = rng.pick(["primary", "accent"]);
      q.focusCBoost = clamp(jitter(q.focusCBoost, 0.03), 0.02, 0.16);
      q.focusL = clamp(jitter(q.focusL, 0.08), 0.25, 0.85);
      break;
    case 9:
      q.seedHue = mod360(jitter(q.seedHue, 15));
      break;
    default:
      break;
  }
  return q;
}

function accept(delta, temperature, rng) {
  if (delta >= 0) return true;
  const prob = Math.exp(delta / Math.max(1e-9, temperature));
  return rng.next() < prob;
}

function optimizeTheme(mode, primaryHexFixed, opts, rng, seedHue) {
  const contrastTarget = opts.contrastTarget ?? "AA";
  const iterations = opts.iterations ?? 3500;
  let temperature = opts.temperature ?? 1.0;
  const cooling = opts.cooling ?? 0.985;

  const preferVibrant = opts.preferVibrant ?? true;
  const semanticConventional = opts.semanticConventional ?? true;
  const cvdModes =
    opts.cvdModes && opts.cvdModes.length > 0
      ? opts.cvdModes
      : ["none", "protan", "deutan", "tritan"];

  const weights = defaultWeights(opts.weights);

  let curParams = initParams(rng, mode, opts.seedHex, preferVibrant, semanticConventional);
  let built = buildTokens(curParams, mode, primaryHexFixed);
  let curReport = aggregateScore(
    built.tokens,
    mode,
    contrastTarget,
    weights,
    built.gamutCount,
    built.Linfo,
    cvdModes,
    seedHue
  );
  let curScore = curReport.total;

  let bestParams = curParams;
  let bestTokens = built.tokens;
  let bestReport = curReport;
  let bestScore = curScore;

  for (let i = 0; i < iterations; i++) {
    const nextParams = mutateParams(rng, curParams);
    const nextBuilt = buildTokens(nextParams, mode, primaryHexFixed);
    const nextReport = aggregateScore(
      nextBuilt.tokens,
      mode,
      contrastTarget,
      weights,
      nextBuilt.gamutCount,
      nextBuilt.Linfo,
      cvdModes,
      seedHue
    );
    const nextScore = nextReport.total;

    const delta = nextScore - curScore;
    if (accept(delta, temperature, rng)) {
      curParams = nextParams;
      built = nextBuilt;
      curReport = nextReport;
      curScore = nextScore;
    }

    if (curScore > bestScore) {
      bestScore = curScore;
      bestParams = curParams;
      bestTokens = built.tokens;
      bestReport = curReport;
    }

    temperature *= cooling;

    if ((i + 1) % 900 === 0) temperature = Math.min(1.0, temperature * 1.18);
  }

  void bestParams;

  return { tokens: bestTokens, score: bestScore, report: bestReport };
}

/* -----------------------------
   Public API: dual recommend
------------------------------ */
export function recommendTokensDual(options) {
  if (!options || !options.primaryHex) {
    throw new Error("primaryHex is required (brand primary fixed).");
  }

  const randomSeed = options.randomSeed ?? Math.floor(Math.random() * 1e9);
  const rng = new RNG(randomSeed);

  const primaryHex = normalizeHex(options.primaryHex);
  const primaryDarkHex = normalizeHex(options.primaryDarkHex ?? options.primaryHex);

  const cvdModes =
    options.cvdModes && options.cvdModes.length > 0
      ? options.cvdModes
      : ["none", "protan", "deutan", "tritan"];

  const seedHue = safeSeedHue(options.seedHex);

  const light = optimizeTheme("light", primaryHex, options, rng, seedHue);
  const dark = optimizeTheme("dark", primaryDarkHex, options, rng, seedHue);

  return {
    light,
    dark,
    meta: {
      primaryHex,
      primaryDarkHex,
      contrastTarget: options.contrastTarget ?? "AA",
      cvdModes,
      randomSeed,
    },
  };
}

function safeSeedHue(seedHex) {
  if (!seedHex) return undefined;
  try {
    return hexToOklch(seedHex).H;
  } catch {
    return undefined;
  }
}

/* -----------------------------
   Optional helpers
------------------------------ */
export function validateTokens(
  tokens,
  target = "AA",
  cvdModes = ["none", "protan", "deutan", "tritan"]
) {
  const base = cvdModes.map((m) => scoreContrastBase(tokens, target, m));
  const states = cvdModes.map((m) => scoreContrastStates(tokens, target, m));
  const pass = base.every((r) => r.passAll) && states.every((r) => r.passAll);
  const worst = Math.min(
    ...base.map((r) => r.worstRatio),
    ...states.map((r) => r.worstRatio)
  );
  return { pass, worst, base, states };
}

export function recommendTokensDualAsJson(options) {
  const res = recommendTokensDual(options);
  return JSON.stringify(
    {
      meta: res.meta,
      light: {
        score: res.light.score,
        contrastPass: res.light.report.contrast.passAll,
        statePass: res.light.report.states.passAll,
        worstContrast: res.light.report.contrast.worstRatio,
        worstState: res.light.report.states.worstRatio,
        tokens: res.light.tokens,
      },
      dark: {
        score: res.dark.score,
        contrastPass: res.dark.report.contrast.passAll,
        statePass: res.dark.report.states.passAll,
        worstContrast: res.dark.report.contrast.worstRatio,
        worstState: res.dark.report.states.worstRatio,
        tokens: res.dark.tokens,
      },
    },
    null,
    2
  );
}
