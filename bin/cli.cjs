#!/usr/bin/env node
"use strict";

const { recommendTokensDual, recommendTokensDualAsJson } = require("../dist/cjs/index.cjs");

const args = process.argv.slice(2);
const hexArg = args.find((a) => /^#?[0-9A-Fa-f]{6}$/.test(a.replace("#", "")));
const primaryHex = hexArg ? ("#" + hexArg.replace(/^#/, "")) : null;

if (!primaryHex) {
  console.error(`
chroma-ux — Primary 색상으로 라이트/다크 토큰 생성

사용법:
  npx chroma-ux <primary-hex>

예시:
  npx chroma-ux 5B5FF5
  npx chroma-ux #5B5FF5

옵션:
  --json    JSON 형식으로 출력 (기본)
  --css     CSS 변수 형식으로 출력
`);
  process.exit(1);
}

const format = args.includes("--css") ? "css" : "json";
const result = recommendTokensDual({
  primaryHex,
  contrastTarget: "AA",
  iterations: 3000,
  randomSeed: 42,
});

if (format === "css") {
  const { light, dark } = result;
  console.log("/* Light theme */");
  console.log(":root {");
  Object.entries(light.tokens).forEach(([k, v]) => {
    if (typeof v === "string" && v.startsWith("#")) {
      console.log(`  --color-${k.replace(/([A-Z])/g, "-$1").toLowerCase()}: ${v};`);
    }
  });
  console.log("}\n");
  console.log("/* Dark theme */");
  console.log('[data-theme="dark"] {');
  Object.entries(dark.tokens).forEach(([k, v]) => {
    if (typeof v === "string" && v.startsWith("#")) {
      console.log(`  --color-${k.replace(/([A-Z])/g, "-$1").toLowerCase()}: ${v};`);
    }
  });
  console.log("}");
} else {
  console.log(recommendTokensDualAsJson({ primaryHex, contrastTarget: "AA", randomSeed: 42 }));
}
