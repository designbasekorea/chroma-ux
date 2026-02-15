# ux-color-engine

OKLCH 기반 UX/UI 디자인 토큰 생성 라이브러리. **런타임 의존성 0**, ESM/CJS 지원.

- **Primary 고정**: 브랜드 Primary 색상을 라이트/다크 모드별로 고정
- **라이트·다크 동시 생성**: 한 번의 호출로 두 테마 토큰 세트 생성
- **확장 토큰**: 버튼 상태(hover/pressed/disabled), semantic, border/divider/focusRing
- **접근성**: WCAG AA/AAA, CVD(색약/색맹) 시뮬레이션

---

## 한 줄로 시작하기 (npx)

설치 없이 바로 사용:

```bash
# Primary 색상만 넣으면 JSON 토큰 출력
npx ux-color-engine 5B5FF5

# CSS 변수로 출력
npx ux-color-engine #5B5FF5 --css
```

---

## 설치

```bash
npm install ux-color-engine
```

---

## 사용법

### ESM

```javascript
import { recommendTokensDual } from "ux-color-engine";

const { light, dark } = recommendTokensDual({
  primaryHex: "#5B5FF5",
  contrastTarget: "AA",
  randomSeed: 42,
});

console.log(light.tokens.primary);   // #5B5FF5
console.log(dark.tokens.background);
```

### CJS

```javascript
const { recommendTokensDual } = require("ux-color-engine");

const result = recommendTokensDual({ primaryHex: "#5B5FF5" });
```

### JSON 내보내기

```javascript
import { recommendTokensDualAsJson } from "ux-color-engine";

const json = recommendTokensDualAsJson({ primaryHex: "#5B5FF5" });
```

---

## API

### `recommendTokensDual(options)`

| 옵션 | 기본값 | 설명 |
|------|-------|------|
| `primaryHex` | **필수** | 브랜드 Primary (hex) |
| `primaryDarkHex` | `primaryHex` | 다크 전용 Primary |
| `seedHex` | - | 중성/액센트 시드 |
| `contrastTarget` | `"AA"` | `"AA"` \| `"AAA"` |
| `iterations` | `3500` | 최적화 반복 수 |
| `randomSeed` | 랜덤 | 재현용 시드 |

### `validateTokens(tokens, target?, cvdModes?)`

대비·상태 검증.

---

## npm 배포

**배포되는 파일**: `dist`(빌드 결과) + `bin`(CLI)만 포함. 소스(`src`, `build.js`)는 제외됩니다.

```bash
# 1. npm 로그인 (최초 1회)
npm login

# 2. 패키지명 중복 확인 (ux-color-engine이 이미 있으면 다른 이름 사용)
npm search ux-color-engine

# 3. package.json의 repository.url을 본인 GitHub으로 수정

# 4. 배포
npm publish
```

배포 시 `prepublishOnly`가 자동으로 `npm run build`를 실행해 `dist`를 생성합니다.

---

## 라이선스

MIT
