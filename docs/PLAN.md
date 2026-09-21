# CharAnimation – Kế hoạch xây dựng web app 100% client-side

> Biến 1 ảnh PNG (nhân vật / con vật / đồ vật) thành animation loop kiểu "đung đưa", chạy hoàn toàn trong trình duyệt, không backend, deploy dạng static site.

- Phiên bản kế hoạch: 1.0 (2026-09-21)
- Nhánh: `claude/character-animation-from-image-13cd9d`
- Trạng thái: **đã thực hiện xong**

> Đây là kế hoạch gốc, giữ nguyên để đối chiếu. Hệ thống **như đã xây dựng** được
> mô tả ở [`ARCHITECTURE.md`](ARCHITECTURE.md), trong đó có bảng liệt kê những
> chỗ bản thực tế khác kế hoạch và lý do. Số đo hiệu năng thật nằm ở
> [`BENCHMARK.md`](BENCHMARK.md).

---

## Mục lục

1. [Tóm tắt](#1-tóm-tắt)
2. [Phạm vi](#2-phạm-vi)
3. [Yêu cầu đầu ra](#3-yêu-cầu-đầu-ra)
4. [Kiến trúc và công nghệ](#4-kiến-trúc-và-công-nghệ)
5. [Thiết kế chi tiết từng module](#5-thiết-kế-chi-tiết-từng-module)
6. [Kế hoạch thực hiện theo milestone](#6-kế-hoạch-thực-hiện-theo-milestone)
7. [Kiểm thử](#7-kiểm-thử)
8. [Triển khai](#8-triển-khai)
9. [Rủi ro và phương án xử lý](#9-rủi-ro-và-phương-án-xử-lý)
10. [Lệnh khởi tạo nhanh](#10-lệnh-khởi-tạo-nhanh)
11. [Phụ lục](#11-phụ-lục)

---

## 1. Tóm tắt

**Mục tiêu:** Người dùng kéo thả 1 ảnh → app tự tách nền ngay trong trình duyệt → chọn 1 preset chuyển động (đung đưa, nhấp nhô, thở, lơ lửng, gió, uốn éo, nảy, treo lắc) → xem preview real-time → tinh chỉnh tham số → xuất ra GIF / APNG / sprite sheet / WebM / MP4. Toàn bộ xử lý diễn ra trên máy người dùng.

**Nguyên tắc thiết kế:**

1. **Zero backend.** Chỉ có file tĩnh (HTML/JS/CSS/model). Không API, không database server, không upload ảnh đi đâu.
2. **Loop liền mạch theo toán học.** Mọi chuyển động là tổng các hàm sin với tần số nguyên trên chu kỳ loop, nên frame cuối luôn nối khớp frame đầu, không cần xử lý hậu kỳ.
3. **Deterministic.** Cùng tham số + cùng thời điểm t → cùng khung hình. Preview và export dùng chung một hàm biến dạng thuần (pure function).
4. **Chạy được offline sau lần tải đầu** (PWA, cache model).
5. **Tách lớp rõ:** `engine` (thuần TypeScript, không phụ thuộc UI) – `render` (Pixi.js) – `export` – `ui`.

**Stack chốt:**

| Lớp | Lựa chọn | Lý do |
|---|---|---|
| Build / framework | Vite + React 19 + TypeScript | Nhanh, static build, hệ sinh thái lớn |
| UI | Tailwind CSS v4, lucide-react (icon) | Gọn, không cần design system nặng |
| State | Zustand | Nhỏ, dễ test, không boilerplate |
| Render preview | Pixi.js v8 (`MeshPlane`) | WebGL/WebGPU, biến dạng lưới 2D đơn giản, hiệu năng cao |
| Tách nền | `@imgly/background-removal` (mặc định) qua adapter; adapter thứ 2: `@huggingface/transformers` + BiRefNet-lite | Chạy WASM/WebGPU trong browser, không server |
| Export GIF | `gifenc` | Nhanh, hỗ trợ transparent index |
| Export APNG | `upng-js` | Lossless, giữ alpha 8-bit |
| Export MP4 | WebCodecs `VideoEncoder` + `mp4-muxer` | Không cần ffmpeg, nhanh |
| Export WebM | `MediaRecorder` (nhanh, không alpha) | Fallback phổ biến |
| Export WebM alpha / WebP động (giai đoạn 2) | `@ffmpeg/ffmpeg` (core single-thread) hoặc `webpxmux.js` | Giữ alpha cho video |
| Lưu trữ | IndexedDB qua `idb-keyval` | Lưu project gần đây trên máy |
| Offline | `vite-plugin-pwa` (Workbox) | Cache app shell + model |
| Test | Vitest (unit), Playwright (e2e) | |
| Deploy | GitHub Pages qua GitHub Actions (hoặc Cloudflare Pages / Netlify / Vercel) | Static hosting miễn phí |

**Kết quả cuối cùng:** một URL công khai, mở lên là dùng được, không đăng nhập, không cài đặt; mã nguồn trong repo này kèm CI tự deploy.

---

## 2. Phạm vi

### 2.1 Trong phạm vi (v1)

- Nhập 1 ảnh PNG / JPG / WebP.
- Tự phát hiện ảnh đã có kênh alpha để cho phép bỏ qua bước tách nền.
- Tách nền bằng model AI chạy trong browser, có thanh tiến trình, có nút "bỏ qua".
- Cắt gọn vùng trong suốt thừa (trim), thêm lề (padding) để biến dạng không bị cắt.
- Chọn điểm neo (pivot) bằng cách click lên ảnh, mặc định giữa cạnh dưới.
- 8 preset chuyển động + chế độ tùy chỉnh gộp nhiều modifier.
- Preview real-time, play/pause, kéo timeline, đổi thời lượng loop.
- Xuất: GIF, APNG, sprite sheet (PNG + JSON), WebM (không alpha), MP4 (không alpha). Giai đoạn 2: WebM VP9 alpha, WebP động.
- Tùy chọn xuất: fps, kích thước, nền (trong suốt / màu), scale 1x–2x.
- Lưu project vào IndexedDB, danh sách "gần đây", export/import project dạng JSON + PNG.
- PWA: dùng offline sau lần tải đầu.
- Giao diện tiếng Việt mặc định, chuyển được sang tiếng Anh.
- Responsive: dùng được trên tablet; điện thoại dùng được ở mức cơ bản.

### 2.2 Ngoài phạm vi (v1)

- Sinh video bằng AI (image-to-video) vì cần GPU server.
- Auto-rig xương nhân vật (Animated Drawings) vì cần Python backend.
- Tài khoản người dùng, đồng bộ cloud, chia sẻ link.
- Chỉnh sửa mask thủ công bằng cọ (đưa vào backlog v1.1).
- Nhiều layer / nhiều nhân vật trong một cảnh (backlog v1.2).

### 2.3 Người dùng mục tiêu

- Người làm nội dung, giáo viên, game dev indie, designer cần "làm sống" một hình vẽ tĩnh trong vài phút.
- Không cần kiến thức animation. Toàn bộ thao tác gói trong 3 bước.

---

## 3. Yêu cầu đầu ra

### 3.1 Sản phẩm bàn giao

| # | Bàn giao | Mô tả |
|---|---|---|
| D1 | Mã nguồn | Repo này, cấu trúc như mục 4.3, có README hướng dẫn chạy và build |
| D2 | Web app static | Thư mục `dist/` build từ Vite, deploy được lên bất kỳ static host |
| D3 | URL công khai | GitHub Pages (hoặc host tương đương) chạy bản mới nhất của nhánh chính |
| D4 | Bộ test | Unit test cho engine và tiện ích alpha; e2e smoke test luồng chính |
| D5 | Tài liệu | README (chạy, build, deploy), `docs/PLAN.md` (file này), `docs/ARCHITECTURE.md` (cập nhật khi code), `docs/PRESETS.md` (tham số từng preset) |
| D6 | Ảnh mẫu | 3–5 ảnh mẫu tự vẽ hoặc CC0 trong `public/samples/` để thử nhanh |

### 3.2 Yêu cầu chức năng

| ID | Yêu cầu | Tiêu chí chấp nhận |
|---|---|---|
| FR-01 | Nhập ảnh bằng kéo thả, chọn file, hoặc dán (Ctrl+V) | Nhận PNG/JPG/WebP; từ chối file khác với thông báo rõ; giới hạn 25 MB |
| FR-02 | Ảnh lớn được thu nhỏ tự động | Cạnh dài > 2048 px → thu về 2048 px trước khi xử lý, có thông báo |
| FR-03 | Phát hiện alpha sẵn có | Nếu ≥ 1% pixel có alpha < 255 → hiện lựa chọn "Ảnh đã trong suốt, bỏ qua tách nền" |
| FR-04 | Tách nền trong browser | Chạy trong Web Worker; hiện tiến trình tải model và xử lý; UI không đơ |
| FR-05 | So sánh trước/sau | Slider hoặc toggle xem ảnh gốc vs ảnh đã tách; nền checker để thấy vùng trong suốt |
| FR-06 | Trim và padding | Cắt theo bbox alpha (ngưỡng 8/255), thêm padding 15% cạnh dài (chỉnh được 0–40%) |
| FR-07 | Chọn pivot | Click lên canvas để đặt pivot; hiển thị điểm neo; preset gợi ý pivot mặc định |
| FR-08 | 8 preset | Sway, Bob, Breathe, Float, Wind, Wiggle, Bounce, Pendulum; mỗi preset có thumbnail động |
| FR-09 | Tinh chỉnh tham số | Slider cho biên độ, tốc độ (tần số nguyên), độ mềm, thời lượng loop; đổi là thấy ngay |
| FR-10 | Chế độ Custom | Bật/tắt và chỉnh từng modifier độc lập |
| FR-11 | Preview | Play/pause, kéo timeline 0→T, nút "xem 1 vòng", nền checker/màu |
| FR-12 | Loop liền mạch | Frame 0 và frame N (t = T) trùng nhau tuyệt đối (được đảm bảo bằng thuật toán, có unit test) |
| FR-13 | Xuất GIF | Có transparent, 256 màu, dithering bật/tắt, delay theo fps |
| FR-14 | Xuất APNG | Lossless, alpha 8-bit, loop vô hạn |
| FR-15 | Xuất sprite sheet | PNG (tối đa 4096×4096, tự tính số cột) + JSON kiểu TexturePacker "JSON Hash" có khóa `animations` |
| FR-16 | Xuất WebM / MP4 | Không alpha, nền màu do người dùng chọn; MP4 H.264 qua WebCodecs, fallback WebM MediaRecorder |
| FR-17 | Tùy chọn xuất | fps ∈ {12, 15, 24, 30}; kích thước: gốc / 256 / 512 / 1024 / tùy chỉnh; scale 1x, 2x |
| FR-18 | Đặt tên file | `{tên}_{preset}_{w}x{h}_{fps}fps.{ext}`; tải xuống bằng thẻ `<a download>` |
| FR-19 | Lưu project | Tự lưu vào IndexedDB khi có thay đổi; trang "Gần đây" mở lại được |
| FR-20 | Export/Import project | File `.charanim.json` (tham số) + PNG cutout, hoặc 1 file zip |
| FR-21 | Offline | Sau lần tải đầu, ngắt mạng vẫn mở được app và tách nền được (model đã cache) |
| FR-22 | Đa ngôn ngữ | vi (mặc định), en; đổi ngay không reload |
| FR-23 | Xử lý lỗi | Không có WebGL → thông báo; tải model lỗi → nút thử lại và nút bỏ qua tách nền; hết bộ nhớ → tự giảm kích thước và thử lại |

### 3.3 Đặc tả định dạng xuất

| Định dạng | Alpha | Thư viện | Giai đoạn | Ghi chú |
|---|---|---|---|---|
| GIF | 1-bit (có/không) | `gifenc` | 1 | Quantize `rgba4444`, pixel alpha < 128 → transparent index; viền có thể răng cưa, cảnh báo trong UI |
| APNG | 8-bit | `upng-js` | 1 | `UPNG.encode(frames, w, h, 0, delays)`; chất lượng cao nhất, file lớn |
| Sprite sheet PNG + JSON | 8-bit | Canvas 2D | 1 | Dùng cho Pixi/Phaser/Unity/Godot; JSON có `frames`, `animations.idle`, `meta.frameRate` |
| WebM (VP9/VP8) | Không | `MediaRecorder` từ `canvas.captureStream()` | 1 | Nhanh nhất; Safari sẽ ra MP4/H.264 thay vì WebM |
| MP4 (H.264) | Không | WebCodecs + `mp4-muxer` | 1 | Feature-detect `VideoEncoder.isConfigSupported`; không có → ẩn tùy chọn |
| WebM VP9 alpha | 8-bit | `@ffmpeg/ffmpeg` core single-thread, `-c:v libvpx-vp9 -pix_fmt yuva420p` | 2 | Core ~30 MB tải lần đầu; single-thread để không cần COOP/COEP |
| WebP động | 8-bit | `webpxmux.js` | 2 | Nhẹ hơn ffmpeg; kiểm tra chất lượng viền |

Quy ước chung cho mọi định dạng:

- Số frame `N = round(T × fps)`, thời lượng hiệu dụng `T' = N / fps` (hiển thị cho người dùng nếu khác T).
- Frame thứ i render tại `t_i = i / fps`, i ∈ [0, N). Không render t = T' (trùng frame 0).
- Kích thước output là bội của 2 (yêu cầu của H.264).
- Nền trong suốt chỉ áp dụng với GIF/APNG/sprite sheet/WebM alpha/WebP; định dạng khác bắt buộc chọn màu nền (mặc định trắng).

### 3.4 Yêu cầu phi chức năng

| ID | Yêu cầu | Mục tiêu đo được |
|---|---|---|
| NFR-01 | Riêng tư | Không có request mạng nào mang dữ liệu ảnh. Chỉ tải file tĩnh của app và file model. Kiểm chứng bằng tab Network |
| NFR-02 | Kích thước bundle | JS + CSS app (không tính model) ≤ 2 MB gzip |
| NFR-03 | Model tách nền | ≤ 45 MB (dùng bản `isnet_fp16`); được cache lâu dài (Cache Storage) |
| NFR-04 | Thời gian tách nền | Ảnh 1024 px: ≤ 5 s với WebGPU, ≤ 20 s với WASM (sau khi model đã cache) trên laptop tầm trung 2020 |
| NFR-05 | Preview | ≥ 30 fps với lưới 48×48, ảnh 1024 px, trên laptop tích hợp GPU |
| NFR-06 | Export | 2 s @ 30 fps @ 512 px: GIF ≤ 10 s, APNG ≤ 10 s, WebM ≤ 5 s, MP4 ≤ 5 s |
| NFR-07 | Bộ nhớ | Không vượt 1.5 GB RAM tab trên desktop; trên iOS giới hạn ảnh xử lý 1024 px |
| NFR-08 | Khả năng truy cập | Điều khiển được bằng bàn phím; label cho slider; tương phản ≥ 4.5:1 |
| NFR-09 | Không phụ thuộc dịch vụ ngoài | Model tự host trong `public/models/` (không dùng CDN bên thứ ba khi build production) |

### 3.5 Trình duyệt hỗ trợ

| Trình duyệt | Tách nền | Preview | Export |
|---|---|---|---|
| Chrome / Edge ≥ 113 | WebGPU (nhanh) hoặc WASM | WebGL2 / WebGPU | Đủ mọi định dạng giai đoạn 1 |
| Firefox mới nhất | WASM | WebGL2 | GIF, APNG, sprite sheet, WebM; MP4 nếu có WebCodecs |
| Safari ≥ 17 (macOS, iOS) | WASM | WebGL2 | GIF, APNG, sprite sheet; MediaRecorder ra MP4 |
| Trình duyệt không WebGL | Không hỗ trợ, hiện thông báo | | |

### 3.6 Tiêu chí hoàn thành toàn dự án (Definition of Done)

1. Toàn bộ FR-01 → FR-23 đạt tiêu chí chấp nhận trên Chrome và Firefox mới nhất, FR ngoại trừ MP4 đạt trên Safari.
2. NFR-01 → NFR-09 được đo và ghi kết quả vào `docs/BENCHMARK.md`.
3. Unit test engine ≥ 90% coverage; e2e smoke test xanh trên CI.
4. Deploy tự động từ nhánh chính, URL hoạt động, Lighthouse PWA "installable".
5. README có ảnh chụp màn hình và hướng dẫn 3 bước.

---

## 4. Kiến trúc và công nghệ

### 4.1 Luồng dữ liệu

```
[File ảnh] ──► decode ──► (downscale ≤ 2048) ──► phát hiện alpha?
                                                  │
                    ┌─────────────────────────────┴───────────────┐
                    ▼ chưa có alpha                                ▼ đã có alpha (hoặc bỏ qua)
        Web Worker: BackgroundRemover.remove()                    │
        (imgly / transformers adapter) ──► PNG RGBA ◄─────────────┘
                                             │
                                trim bbox + padding ──► Cutout (ImageBitmap + meta)
                                             │
                     ┌───────────────────────┴────────────────────────┐
                     ▼                                                ▼
        Preview (Pixi MeshPlane, ticker t)                Export (render N frame với t_i = i/fps)
        deform(base, params, t) ──► vertex buffer         deform(...) ──► RenderTexture ──► RGBA frame
                                                                       │
                                                        gif / apng / spritesheet / webm / mp4
                                                                       │
                                                                  <a download>
        Zustand store ◄──► IndexedDB (idb-keyval): project gần đây
```

### 4.2 Nguyên tắc module

- `src/engine/` là TypeScript thuần, **không import Pixi hay React**, để test bằng Vitest và tái sử dụng cho export.
- `src/render/` bọc Pixi, chỉ đọc `params` từ store và gọi `deform`.
- `src/export/` nhận một hàm `renderFrame(t) → ImageData` và không biết gì về Pixi.
- `src/bg-removal/` định nghĩa interface `BackgroundRemover`; adapter cụ thể có thể hoán đổi qua cấu hình.

### 4.3 Cấu trúc thư mục

```
CharAnimation/
├─ index.html
├─ package.json
├─ vite.config.ts               # base '/CharAnimation/', plugin PWA, worker format 'es'
├─ tsconfig.json
├─ tailwind.config (v4 dùng CSS-first, có thể không cần file này)
├─ .github/workflows/
│  ├─ ci.yml                    # lint + test + build trên mọi PR
│  └─ deploy.yml                # build + deploy GitHub Pages khi push nhánh chính
├─ public/
│  ├─ models/                   # file model tách nền tự host (copy từ node_modules lúc postinstall)
│  ├─ samples/                  # ảnh mẫu
│  └─ icons/                    # icon PWA
├─ scripts/
│  └─ copy-models.mjs           # postinstall: copy asset model vào public/models
├─ src/
│  ├─ main.tsx
│  ├─ App.tsx                   # stepper 3 bước
│  ├─ i18n/ (index.ts, vi.ts, en.ts)
│  ├─ store/
│  │  ├─ project.ts             # Zustand: source, cutout, anim params, export options, ui state
│  │  └─ persistence.ts         # idb-keyval: save/load/list/delete project
│  ├─ engine/
│  │  ├─ types.ts               # AnimParams, Preset, Grid, ExportOptions
│  │  ├─ grid.ts                # tạo lưới (u, v, base positions)
│  │  ├─ deform.ts              # deform(base, grid, params, t, out) – pure
│  │  ├─ presets.ts             # 8 preset + pivot mặc định
│  │  ├─ timeline.ts            # tính N, T', t_i
│  │  └─ math.ts                # rotateAround, shaped sine, clamp
│  ├─ render/
│  │  ├─ Stage.ts               # tạo Pixi Application, resize, checker background
│  │  ├─ DeformableSprite.ts    # MeshPlane + cập nhật aPosition mỗi frame
│  │  ├─ PivotGizmo.ts          # vẽ và kéo pivot
│  │  └─ FrameRenderer.ts       # render tại t vào RenderTexture, trả ImageData
│  ├─ bg-removal/
│  │  ├─ types.ts               # interface BackgroundRemover { remove(blob, onProgress): Promise<Blob> }
│  │  ├─ imgly.adapter.ts
│  │  ├─ transformers.adapter.ts (tùy chọn)
│  │  ├─ worker.ts              # chạy adapter trong Web Worker, giao tiếp postMessage
│  │  └─ client.ts              # API cho UI: removeBackground(file, onProgress, signal)
│  ├─ image/
│  │  ├─ decode.ts              # File → ImageBitmap, downscale
│  │  ├─ alpha.ts               # hasAlpha, alphaBBox, trimAndPad
│  │  └─ canvas.ts              # tiện ích canvas/ImageData
│  ├─ export/
│  │  ├─ types.ts
│  │  ├─ frames.ts              # renderAllFrames(renderFrame, opts) → AsyncGenerator<ImageData>
│  │  ├─ gif.ts, apng.ts, spritesheet.ts, webm.ts, mp4.ts
│  │  ├─ (phase 2) webm-alpha.ts, webp.ts
│  │  └─ download.ts
│  ├─ components/
│  │  ├─ layout/ (StepBar, Panel, Toolbar)
│  │  ├─ upload/ (Dropzone, SampleGallery)
│  │  ├─ bg/ (RemovalProgress, BeforeAfter)
│  │  ├─ anim/ (PresetGallery, ParamSliders, Timeline, PivotHint)
│  │  ├─ export/ (ExportDialog, ExportProgress)
│  │  └─ common/ (Slider, Select, Button, Toast)
│  └─ styles/ (index.css với @import "tailwindcss")
├─ tests/
│  ├─ unit/ (deform.test.ts, timeline.test.ts, alpha.test.ts, spritesheet.test.ts)
│  └─ e2e/ (smoke.spec.ts)
└─ docs/
   ├─ PLAN.md
   ├─ ARCHITECTURE.md
   ├─ PRESETS.md
   └─ BENCHMARK.md
```

### 4.4 Mô hình dữ liệu

```ts
// src/engine/types.ts
export type IntFreq = 1 | 2 | 3 | 4 | 6 | 8;      // tần số nguyên trên 1 chu kỳ loop

export interface Pivot { pu: number; pv: number } // 0..1, (0.5, 1) = giữa cạnh dưới

export interface SwayMod    { enabled: boolean; amountDeg: number; falloff: number; freq: IntFreq; phase: number; ease: number }
export interface WindMod    { enabled: boolean; amount: number; wavelength: number; falloff: number; freq: IntFreq }
export interface WiggleMod  { enabled: boolean; amount: number; freq: IntFreq; scaleU: number; scaleV: number }
export interface BreatheMod { enabled: boolean; amountX: number; amountY: number; freq: IntFreq; phase: number; preserveVolume: boolean }
export interface BobMod     { enabled: boolean; amountX: number; amountY: number; freq: IntFreq; phase: number }
export interface JitterMod  { enabled: boolean; amount: number; freq: IntFreq }

export interface AnimParams {
  loopSeconds: number;               // 0.5 .. 6, bước 0.1
  pivot: Pivot;
  grid: { cols: number; rows: number }; // 12 .. 64, mặc định 32
  sway: SwayMod; wind: WindMod; wiggle: WiggleMod;
  breathe: BreatheMod; bob: BobMod; jitter: JitterMod;
}

export interface Preset {
  id: 'sway' | 'bob' | 'breathe' | 'float' | 'wind' | 'wiggle' | 'bounce' | 'pendulum' | 'custom';
  nameKey: string;                   // khóa i18n
  defaultPivot: Pivot;
  params: AnimParams;
}

export interface Grid {
  cols: number; rows: number; count: number;
  u: Float32Array; v: Float32Array;  // toạ độ chuẩn hoá từng đỉnh
  width: number; height: number;     // kích thước ảnh cutout (px)
}

// src/export/types.ts
export interface ExportOptions {
  format: 'gif' | 'apng' | 'spritesheet' | 'webm' | 'mp4' | 'webm-alpha' | 'webp';
  fps: 12 | 15 | 24 | 30;
  size: { mode: 'original' | 'fit' | 'custom'; fit?: 256 | 512 | 1024; width?: number; height?: number };
  scale: 1 | 2;
  background: { type: 'transparent' | 'color'; color: string };
  gif: { colors: number; dither: boolean };
  spritesheet: { maxSize: 2048 | 4096; columns?: number };
  video: { bitrateKbps: number };
}

// src/store/project.ts (rút gọn)
export interface Project {
  id: string; name: string; createdAt: number; updatedAt: number;
  source: { blob: Blob; width: number; height: number; hadAlpha: boolean; downscaled: boolean };
  cutout?: { blob: Blob; width: number; height: number; bbox: [number, number, number, number]; paddingPct: number };
  bgRemoval: { skipped: boolean; adapter: 'imgly' | 'transformers'; model: string; ms: number } | null;
  presetId: Preset['id'];
  params: AnimParams;
  exportOptions: ExportOptions;
}
```

---

## 5. Thiết kế chi tiết từng module

### 5.1 Nhập ảnh và tiền xử lý (`src/image/`)

1. **Nhận file** từ Dropzone (kéo thả, click, dán clipboard). Kiểm tra MIME ∈ {image/png, image/jpeg, image/webp} và size ≤ 25 MB.
2. **Decode** bằng `createImageBitmap(file, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' })`.
3. **Downscale** nếu cạnh dài > 2048 (iOS: > 1024): vẽ lên OffscreenCanvas với `imageSmoothingQuality = 'high'`, ghi cờ `downscaled = true`.
4. **Phát hiện alpha**: đọc `ImageData`, đếm pixel có alpha < 255, lấy mẫu mỗi 4 pixel để nhanh. Tỉ lệ ≥ 1% → `hadAlpha = true`.
5. **Trim + padding** (`trimAndPad`): tìm bbox của pixel alpha ≥ 8; cắt; thêm padding = `paddingPct × max(w, h)` (mặc định 15%); làm tròn kích thước lên bội của 2.
6. Kết quả là `Cutout` gồm PNG Blob + ImageBitmap + meta để dùng cho Pixi và lưu IndexedDB.

### 5.2 Tách nền (`src/bg-removal/`)

**Interface:**

```ts
export interface BackgroundRemover {
  id: 'imgly' | 'transformers';
  warmup(onProgress: ProgressFn): Promise<void>;          // tải model
  remove(input: Blob, onProgress: ProgressFn, signal?: AbortSignal): Promise<Blob>; // PNG RGBA
}
export type ProgressFn = (stage: 'download' | 'inference', done: number, total: number) => void;
```

**Adapter mặc định – `@imgly/background-removal`:**

- Cấu hình: `{ model: 'isnet_fp16', device: 'gpu' nếu `navigator.gpu` tồn tại, ngược lại 'cpu', publicPath: `${BASE_URL}models/`, output: { format: 'image/png' }, progress }`.
- Script `scripts/copy-models.mjs` chạy ở `postinstall`, copy thư mục asset của package vào `public/models/` để tự host (đáp ứng NFR-09 và offline).
- Chạy bên trong `worker.ts` (Web Worker kiểu module). UI gọi `client.removeBackground(file, onProgress, signal)`, worker trả về `Blob` PNG qua `postMessage` với transfer.
- Hủy: `AbortController`; khi hủy thì terminate worker và tạo worker mới ở lần sau.

**Adapter thứ 2 – Transformers.js + BiRefNet-lite (MIT) hoặc MODNet (Apache-2.0):**

- Chỉ cần khi không dùng được license AGPL của imgly (xem 11.1). Cùng interface, chọn qua biến môi trường `VITE_BG_ADAPTER`.
- Dùng `@huggingface/transformers` với `device: 'webgpu'` fallback `'wasm'`, model ONNX quantized, tự host trong `public/models/`.

**Hậu xử lý mask (giai đoạn 1 tối thiểu):** làm mờ viền alpha 1 px (box blur trên kênh A) để giảm răng cưa; giai đoạn 2 thêm tùy chọn "erode 1 px" để giảm viền sáng.

**UI:** màn hình có 3 trạng thái: đang tải model (hiện MB đã tải), đang xử lý (spinner + thời gian), hoàn tất (BeforeAfter slider). Luôn có nút "Bỏ qua, dùng ảnh gốc".

### 5.3 Engine biến dạng (`src/engine/`)

**Lưới:** chia ảnh cutout thành `cols × rows` ô, sinh `(cols+1)(rows+1)` đỉnh. Với đỉnh i: `u = col/cols`, `v = row/rows` (v = 0 cạnh trên, v = 1 cạnh dưới). Vị trí gốc `base[2i] = u × W`, `base[2i+1] = v × H`.

**Pha thời gian:** `θ = 2π · t / T` với T = `loopSeconds`. Mọi modifier chỉ dùng `sin(n·θ + φ)` với n nguyên, nên `f(0) = f(T)` và loop liền mạch không cần xử lý thêm.

**Trọng số theo pivot:** `w = |v − pv|^falloff` (falloff 1..3). Tại hàng pivot w = 0 nên phần "chân" đứng yên, càng xa pivot càng lắc mạnh. Preset "Pendulum" đặt pivot ở cạnh trên nên phần dưới lắc.

**Sine có tạo hình:** `shaped(s, ease) = sign(s) · |s|^ease`, ease ∈ [0.5, 2]: > 1 làm chuyển động "nghỉ" lâu ở giữa, < 1 làm "nghỉ" ở hai biên. Vẫn tuần hoàn.

**Thứ tự áp dụng cho mỗi đỉnh (pseudo-code):**

```ts
export function deform(base: Float32Array, g: Grid, p: AnimParams, t: number, out: Float32Array): void {
  const theta = (2 * Math.PI * t) / p.loopSeconds;
  const px = p.pivot.pu * g.width, py = p.pivot.pv * g.height;

  for (let i = 0; i < g.count; i++) {
    const u = g.u[i], v = g.v[i];
    let x = base[2 * i], y = base[2 * i + 1];
    const dv = Math.abs(v - p.pivot.pv);

    // 1) Sway – xoay quanh pivot, góc giảm dần về 0 tại pivot
    if (p.sway.enabled) {
      const w = Math.pow(dv, p.sway.falloff);
      const s = shaped(Math.sin(p.sway.freq * theta + p.sway.phase), p.sway.ease);
      const ang = degToRad(p.sway.amountDeg) * s * w;
      [x, y] = rotateAround(x, y, px, py, ang);
    }

    // 2) Wind – sóng chạy dọc thân (pha lệch theo v)
    if (p.wind.enabled) {
      const w = Math.pow(dv, p.wind.falloff);
      x += p.wind.amount * g.width * Math.sin(p.wind.freq * theta - v * p.wind.wavelength * 2 * Math.PI) * w;
    }

    // 3) Wiggle – tổng hai sin lệch pha theo u và v (tần số nguyên để loop khớp)
    if (p.wiggle.enabled) {
      const w = Math.pow(dv, 1);
      x += p.wiggle.amount * g.width * 0.5 * (Math.sin(p.wiggle.freq * theta + u * p.wiggle.scaleU)
                                           + Math.sin(p.wiggle.freq * 2 * theta + v * p.wiggle.scaleV)) * w;
    }

    // 4) Breathe / Bounce – co giãn quanh pivot
    if (p.breathe.enabled) {
      const s = Math.sin(p.breathe.freq * theta + p.breathe.phase);
      const sy = 1 + p.breathe.amountY * s;
      const sx = p.breathe.preserveVolume ? 1 / sy : 1 + p.breathe.amountX * s;
      x = px + (x - px) * sx;
      y = py + (y - py) * sy;
    }

    // 5) Bob – tịnh tiến toàn bộ
    if (p.bob.enabled) {
      x += p.bob.amountX * g.width  * Math.sin(p.bob.freq * theta + p.bob.phase);
      y += p.bob.amountY * g.height * Math.sin(p.bob.freq * theta);
    }

    // 6) Jitter – rung nhỏ tần số cao
    if (p.jitter.enabled) {
      x += p.jitter.amount * g.width * Math.sin(p.jitter.freq * theta + u * 13.0);
      y += p.jitter.amount * g.height * Math.sin(p.jitter.freq * theta + v * 17.0);
    }

    out[2 * i] = x; out[2 * i + 1] = y;
  }
}
```

**Timeline (`timeline.ts`):**

```ts
export function frameCount(loopSeconds: number, fps: number) { return Math.max(2, Math.round(loopSeconds * fps)); }
export function effectiveLoop(loopSeconds: number, fps: number) { return frameCount(loopSeconds, fps) / fps; }
export function frameTime(i: number, fps: number) { return i / fps; }
```

Export dùng `effectiveLoop` làm `loopSeconds` khi gọi `deform` để đảm bảo frame N trùng frame 0.

### 5.4 Preset (`src/engine/presets.ts`)

| Preset | Pivot mặc định | Modifier bật | Tham số chính |
|---|---|---|---|
| Sway (Đung đưa) | (0.5, 1) | sway | amountDeg 6, falloff 1.6, freq 1, ease 1 |
| Bob (Nhấp nhô) | (0.5, 1) | bob | amountY 0.03, freq 1 |
| Breathe (Thở) | (0.5, 1) | breathe + bob nhẹ | amountY 0.025, amountX 0.01, freq 1; bob 0.005 |
| Float (Lơ lửng) | (0.5, 0.5) | bob + sway nhẹ | bob amountY 0.04 freq 1; sway 2°, falloff 1, ease 1 |
| Wind (Gió) | (0.5, 1) | wind + sway | wind amount 0.03, wavelength 1.2, falloff 1.4, freq 2; sway 3° |
| Wiggle (Uốn éo) | (0.5, 1) | wiggle | amount 0.02, freq 2, scaleU 6, scaleV 9 |
| Bounce (Nảy) | (0.5, 1) | breathe (preserveVolume) + bob | amountY 0.08, freq 2; bob amountY 0.05 freq 2 phase π/2 |
| Pendulum (Treo lắc) | (0.5, 0) | sway | amountDeg 10, falloff 1.2, freq 1, ease 1.3 |

Mỗi preset có thumbnail động: vẽ chính engine lên một canvas nhỏ 96 px với ảnh mẫu (hoặc cutout hiện tại). Chi tiết tham số cuối cùng ghi vào `docs/PRESETS.md` sau khi tinh chỉnh bằng mắt.

### 5.5 Preview (`src/render/`)

- `Stage.ts`: `new Application()` → `await app.init({ backgroundAlpha: 0, antialias: true, resolution: devicePixelRatio, preference: 'webgl' })`. Nền checker vẽ bằng `TilingSprite` phía sau, không nằm trong container export.
- `DeformableSprite.ts`: `new MeshPlane({ texture, verticesX: cols + 1, verticesY: rows + 1 })`. Mỗi tick: `deform(base, grid, params, t, positions)` rồi `mesh.geometry.getBuffer('aPosition').update()`. Giữ `base` là bản sao bất biến của vị trí gốc.
- Thời gian preview: `t = (performance.now() / 1000) % loopSeconds` khi đang play; khi kéo timeline thì `t` lấy từ slider.
- `PivotGizmo.ts`: vòng tròn kéo được; cập nhật `params.pivot` trong store.
- Đổi `grid` (cols/rows) tạo lại mesh; đổi tham số khác chỉ cập nhật buffer.
- `FrameRenderer.ts`: tạo `RenderTexture` kích thước output; đặt container ở scale phù hợp; `renderer.render({ container, target: rt })`; `renderer.extract.pixels(rt)` → `Uint8ClampedArray` RGBA (unpremultiply nếu extract trả premultiplied); trả `ImageData`. Dùng cùng một `deform` với `t_i` nên preview và export khớp 100%.

### 5.6 Export (`src/export/`)

**`frames.ts`:** `async function* renderAllFrames(renderFrame, opts)` lặp `i = 0..N-1`, `yield await renderFrame(frameTime(i, fps))`, nhường event loop mỗi frame (`await new Promise(requestAnimationFrame)`) để UI cập nhật tiến trình và cho phép hủy.

**GIF (`gif.ts`):** với mỗi frame: nếu nền trong suốt, ép pixel alpha < 128 về alpha 0, quantize `rgba4444` với `gifenc.quantize`, `applyPalette`, `gif.writeFrame(index, w, h, { palette, delay: 1000/fps, transparent: true, transparentIndex: 0, repeat: 0 })`. Tùy chọn dùng palette chung tính từ frame 0 để giảm nhấp nháy màu.

**APNG (`apng.ts`):** gom `ImageData.data.buffer` từng frame, `UPNG.encode(frames, w, h, 0, frames.map(() => 1000/fps))`, `cnum = 0` là lossless.

**Sprite sheet (`spritesheet.ts`):** tính số cột `ceil(sqrt(N))`, kiểm tra `cols × w ≤ maxSize`, nếu vượt thì giảm kích thước frame và cảnh báo. Vẽ vào một canvas, xuất PNG + JSON:

```json
{
  "frames": { "idle_000": { "frame": { "x": 0, "y": 0, "w": 512, "h": 512 }, "rotated": false, "trimmed": false,
                            "spriteSourceSize": { "x": 0, "y": 0, "w": 512, "h": 512 }, "sourceSize": { "w": 512, "h": 512 } } },
  "animations": { "idle": ["idle_000", "idle_001"] },
  "meta": { "app": "CharAnimation", "version": "1.0", "image": "name.png", "size": { "w": 2048, "h": 2048 }, "scale": "1", "frameRate": 30 }
}
```

**WebM (`webm.ts`):** canvas ẩn kích thước output, `captureStream(0)` với `track.requestFrame()` sau mỗi frame vẽ vào canvas, `MediaRecorder` mimeType `video/webm;codecs=vp9` (fallback vp8, Safari fallback `video/mp4`). Vì MediaRecorder không giữ alpha nên luôn tô nền màu trước.

**MP4 (`mp4.ts`):** `VideoEncoder` với codec `avc1.640028`, `width/height` chẵn, `bitrate` từ tùy chọn, `framerate = fps`. Mỗi frame: `new VideoFrame(imageBitmap, { timestamp: i * 1e6 / fps })` → `encode`. Muxer `mp4-muxer` với `fastStart: 'in-memory'`. Feature-detect bằng `VideoEncoder.isConfigSupported`, không hỗ trợ thì ẩn tùy chọn MP4.

**Tải xuống (`download.ts`):** `URL.createObjectURL(blob)` + `<a download>`; sprite sheet tải 2 file hoặc gói zip bằng `fflate` (tùy chọn).

**Giai đoạn 2:** `webm-alpha.ts` dùng `@ffmpeg/ffmpeg` với `@ffmpeg/core` (single-thread) ghi PNG frame vào FS ảo rồi chạy `-framerate fps -i f_%03d.png -c:v libvpx-vp9 -pix_fmt yuva420p -b:v 0 -crf 30 out.webm`; `webp.ts` dùng `webpxmux.js`.

### 5.7 Lưu trữ và PWA

- `persistence.ts`: `saveProject(project)` lưu Blob và JSON vào IndexedDB (key `project:{id}`), `listProjects()` trả meta + thumbnail nhỏ, `deleteProject(id)`. Debounce 500 ms khi tham số thay đổi.
- Export project: JSON tham số + PNG cutout (zip bằng `fflate`); import ngược lại.
- PWA: `vite-plugin-pwa` với `registerType: 'autoUpdate'`, precache app shell; `runtimeCaching` cho `models/**` chiến lược CacheFirst, `maximumFileSizeToCacheInBytes` nâng lên 60 MB. Manifest: tên, icon 192/512, `display: standalone`.

### 5.8 Luồng giao diện

```
Bước 1: Tải ảnh          Bước 2: Tách nền                 Bước 3: Chuyển động & xuất
┌─────────────────┐      ┌───────────────────────────┐    ┌────────────────────┬──────────────────┐
│  [ Kéo thả ảnh ] │  →   │ Tiến trình / So sánh       │ →  │  Canvas preview    │ Preset gallery   │
│  hoặc chọn mẫu   │      │ [Bỏ qua] [Tiếp tục]        │    │  ▶ ◼ ──●────── T   │ Slider tham số   │
└─────────────────┘      └───────────────────────────┘    │  pivot ◎           │ [ Xuất… ]        │
                                                          └────────────────────┴──────────────────┘
```

- Bước 3 là màn hình chính: canvas chiếm 2/3, panel phải 1/3; trên mobile panel thành tab dưới canvas.
- Dialog xuất: chọn định dạng → các tùy chọn tương ứng → ước lượng số frame và kích thước → nút Xuất → thanh tiến trình → tự tải xuống.
- Header: logo, chọn ngôn ngữ, nút "Gần đây", nút "Dự án mới".

---

## 6. Kế hoạch thực hiện theo milestone

Ước lượng cho 1 lập trình viên full-time. Mỗi milestone kết thúc bằng bản deploy chạy được.

| Milestone | Nội dung | Ước lượng |
|---|---|---|
| M0 | Khởi tạo dự án, CI/CD, deploy trang trống | 1 ngày |
| M1 | Nhập ảnh, tách nền, trim/padding | 3 ngày |
| M2 | Engine + preview + 8 preset | 5 ngày |
| M3 | Export giai đoạn 1 (GIF, APNG, sprite sheet, WebM, MP4) | 5 ngày |
| M4 | Lưu trữ, PWA, i18n, responsive, xử lý lỗi, tài liệu | 4 ngày |
| M5 | Export giai đoạn 2 (WebM alpha, WebP), tinh chỉnh preset, benchmark | 3 ngày |
| Dự phòng | | 2 ngày |
| **Tổng** | | **23 ngày** |

### M0 – Khởi tạo (1 ngày)

Công việc:
- [ ] `npm create vite@latest` với template `react-ts`; cài Tailwind v4, ESLint, Prettier, Vitest, Playwright.
- [ ] `vite.config.ts`: `base` theo tên repo, `worker: { format: 'es' }`, plugin PWA (tạm tắt precache model).
- [ ] Cấu trúc thư mục như 4.3 với file rỗng/placeholder.
- [ ] `.github/workflows/ci.yml` (lint, test, build) và `deploy.yml` (GitHub Pages).
- [ ] README tối thiểu.

Nghiệm thu: push lên nhánh chính → URL Pages hiện trang "CharAnimation" với header và stepper 3 bước.

### M1 – Nhập ảnh và tách nền (3 ngày)

Công việc:
- [ ] `image/decode.ts`, `image/alpha.ts` + unit test cho `hasAlpha`, `alphaBBox`, `trimAndPad`.
- [ ] `Dropzone` (kéo thả, click, paste), `SampleGallery` với 3 ảnh mẫu.
- [ ] `scripts/copy-models.mjs` + `postinstall`; kiểm tra `public/models/` có đủ file, thêm vào `.gitignore` nếu quá lớn (tải lại lúc build CI).
- [ ] `bg-removal/imgly.adapter.ts`, `worker.ts`, `client.ts` với progress và abort.
- [ ] Màn hình bước 2: tiến trình, BeforeAfter, nút bỏ qua, nút tiếp tục.
- [ ] Phát hiện WebGPU để chọn device; đo và log thời gian.

Nghiệm thu: FR-01 → FR-06, NFR-04 đo trên máy dev và ghi vào BENCHMARK.md.

### M2 – Engine và preview (5 ngày)

Công việc:
- [ ] `engine/grid.ts`, `engine/math.ts`, `engine/deform.ts`, `engine/timeline.ts`, `engine/presets.ts`.
- [ ] Unit test: loop liền mạch (`deform(t=0) ≈ deform(t=T)` sai số ≤ 1e-6 với mọi preset), pivot bất động với Sway/Wind/Wiggle, `frameCount` đúng, không NaN khi amount = 0.
- [ ] `render/Stage.ts`, `DeformableSprite.ts`, `PivotGizmo.ts`.
- [ ] `PresetGallery` với thumbnail động, `ParamSliders` sinh tự động từ schema modifier, `Timeline`.
- [ ] Store Zustand: `params`, `presetId`, `playing`, `t`.
- [ ] Tinh chỉnh 8 preset bằng mắt trên 3 ảnh mẫu; ghi `docs/PRESETS.md`.

Nghiệm thu: FR-07 → FR-12, NFR-05 (đo bằng `app.ticker.FPS` trung bình 10 s).

### M3 – Export giai đoạn 1 (5 ngày)

Công việc:
- [ ] `render/FrameRenderer.ts` (RenderTexture, extract, unpremultiply, kiểm tra viền).
- [ ] `export/frames.ts` với AsyncGenerator và hủy.
- [ ] `export/gif.ts`, `apng.ts`, `spritesheet.ts` (+ unit test JSON), `webm.ts`, `mp4.ts`, `download.ts`.
- [ ] `ExportDialog` với tùy chọn theo định dạng, ước lượng, tiến trình, cảnh báo (GIF răng cưa, MP4 không alpha).
- [ ] Kiểm tra loop bằng cách so sánh pixel frame 0 và frame N-1 + 1 (render thêm t = T' để test, không ghi vào file).
- [ ] Kiểm tra file mở được: GIF (browser), APNG (Chrome/Safari), sprite sheet (nạp vào Pixi demo nhỏ trong test), MP4 (QuickTime/VLC), WebM (Chrome).

Nghiệm thu: FR-13 → FR-18, NFR-06.

### M4 – Lưu trữ, PWA, i18n, hoàn thiện (4 ngày)

Công việc:
- [ ] `store/persistence.ts`, trang "Gần đây", export/import project.
- [ ] PWA: precache + runtimeCaching model; test ngắt mạng.
- [ ] i18n vi/en; rà toàn bộ chuỗi.
- [ ] Responsive: breakpoint tablet và mobile; giới hạn 1024 px trên iOS.
- [ ] Xử lý lỗi FR-23: không WebGL, tải model lỗi, OOM.
- [ ] Accessibility cơ bản: focus ring, label, phím tắt Space (play/pause), ←/→ (nhích frame).
- [ ] README đầy đủ, ARCHITECTURE.md, ảnh chụp màn hình.

Nghiệm thu: FR-19 → FR-23, NFR-01, NFR-02, NFR-08, Lighthouse PWA installable.

### M5 – Export giai đoạn 2 và benchmark (3 ngày)

Công việc:
- [ ] `export/webm-alpha.ts` (ffmpeg.wasm single-thread, lazy-load), `export/webp.ts` (webpxmux).
- [ ] Hậu xử lý mask: tùy chọn erode/feather.
- [ ] Chạy bộ benchmark trên 3 máy (Windows Chrome, macOS Safari, Android Chrome) và ghi BENCHMARK.md.
- [ ] Gắn tag `v1.0.0`.

Nghiệm thu: DoD mục 3.6.

### Backlog sau v1

- v1.1: cọ chỉnh mask (thêm/xóa vùng), chọn màu nền chroma cho video.
- v1.2: nhiều layer (mỗi bộ phận một modifier riêng), kết hợp 2 preset theo thời gian.
- v1.3: Web Share API, xuất Lottie nếu nguồn là SVG.
- v2: tích hợp tùy chọn AI motion qua API ngoài (người dùng tự nhập API key, vẫn không cần backend riêng).

---

## 7. Kiểm thử

### 7.1 Unit (Vitest)

| File | Kiểm tra |
|---|---|
| `deform.test.ts` | Loop liền mạch cho từng preset; pivot bất động khi chỉ bật sway/wind/wiggle; amount = 0 → out = base; không NaN với mọi tham số biên |
| `timeline.test.ts` | `frameCount(2, 30) = 60`; `effectiveLoop(1.05, 24) = 25/24`; không bao giờ < 2 frame |
| `alpha.test.ts` | `hasAlpha` với ảnh đục và ảnh có alpha; `alphaBBox` với ảnh có viền trong suốt; `trimAndPad` ra kích thước chẵn |
| `spritesheet.test.ts` | Số cột/hàng, toạ độ từng frame, JSON hợp lệ, không vượt maxSize |
| `presets.test.ts` | Mọi preset có đủ trường, tần số nằm trong tập nguyên cho phép |

### 7.2 E2E (Playwright, Chromium có sẵn)

- `smoke.spec.ts`: mở app → tải ảnh mẫu đã có alpha → chọn "bỏ qua tách nền" → chọn preset Sway → mở Export → GIF 12 fps 256 px → chờ sự kiện download → kiểm tra file > 1 KB và header `GIF89a`.
- `spritesheet.spec.ts`: xuất sprite sheet → đọc JSON → số frame đúng `frameCount`.
- Tách nền thật (tải model) chạy ở job riêng có cờ `E2E_FULL=1`, không chặn CI thường.

### 7.3 Kiểm tra thủ công trước mỗi release

- Checklist trình duyệt mục 3.5.
- Mở file xuất bằng: Chrome, Safari, VLC, Photoshop/Photopea (APNG), Pixi playground (sprite sheet).
- Ngắt mạng và mở lại app.

---

## 8. Triển khai

### 8.1 GitHub Pages

`.github/workflows/deploy.yml` (rút gọn):

```yaml
name: Deploy
on:
  push:
    branches: [main]
permissions: { contents: read, pages: write, id-token: write }
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm test -- --run
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with: { path: dist }
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment: github-pages
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- `vite.config.ts`: `base: process.env.GITHUB_PAGES ? '/CharAnimation/' : '/'`.
- Model nằm trong `public/models/` nên được deploy cùng; GitHub Pages giới hạn site 1 GB, đủ.
- Không cần header COOP/COEP ở giai đoạn 1 vì không dùng SharedArrayBuffer. Nếu sau này chuyển sang ffmpeg multi-thread thì chuyển host sang Cloudflare Pages/Netlify (hỗ trợ `_headers`).

### 8.2 Host thay thế

Cloudflare Pages, Netlify, Vercel: kết nối repo, build `npm run build`, output `dist`. Đặt `base: '/'`.

---

## 9. Rủi ro và phương án xử lý

| Rủi ro | Ảnh hưởng | Phương án |
|---|---|---|
| License AGPL-3.0 của `@imgly/background-removal` | Sản phẩm closed-source thương mại phải mua license hoặc mở mã | Adapter hoán đổi sang Transformers.js + BiRefNet-lite (MIT) hoặc MODNet (Apache-2.0); quyết định trước M1 |
| Model 40 MB tải lần đầu chậm | Trải nghiệm lần đầu kém | Hiện tiến trình MB, cho phép thao tác bước 1 song song, cache lâu dài, nút bỏ qua |
| Safari/iOS giới hạn bộ nhớ | Crash tab với ảnh lớn | Giới hạn 1024 px trên iOS, giải phóng ImageBitmap sau dùng, `try/catch` OOM rồi giảm kích thước |
| MediaRecorder không giữ alpha | Người dùng kỳ vọng video trong suốt | Ghi rõ trong UI; đưa WebM alpha vào giai đoạn 2 qua ffmpeg.wasm; khuyến nghị APNG/WebP |
| Viền sáng (halo) sau tách nền | Chất lượng hình | Feather 1 px mặc định, erode tùy chọn, dùng `premultiplyAlpha: 'none'` khi decode |
| GIF răng cưa viền trong suốt | Chất lượng GIF | Cảnh báo, gợi ý dùng nền màu hoặc APNG/WebP; tùy chọn palette chung |
| Pixi extract trả premultiplied alpha | Màu viền sai khi export | Unpremultiply trong `FrameRenderer`, unit test với pixel bán trong suốt |
| WebCodecs chưa có trên Firefox/Safari cũ | Thiếu MP4 | Feature-detect, ẩn tùy chọn, dùng MediaRecorder |
| Kích thước sprite sheet vượt 4096 | Không nạp được vào engine game | Tự giảm kích thước frame hoặc giảm fps, thông báo rõ |

---

## 10. Lệnh khởi tạo nhanh

```bash
# Tại thư mục repo
npm create vite@latest . -- --template react-ts
npm install pixi.js zustand @imgly/background-removal gifenc upng-js mp4-muxer idb-keyval fflate lucide-react
npm install -D tailwindcss @tailwindcss/vite vitest @vitest/coverage-v8 @playwright/test vite-plugin-pwa \
  eslint prettier typescript-eslint @types/node

# Script trong package.json
#  "dev": "vite",
#  "build": "tsc -b && vite build",
#  "preview": "vite preview",
#  "test": "vitest",
#  "test:e2e": "playwright test",
#  "lint": "eslint .",
#  "postinstall": "node scripts/copy-models.mjs"
```

`vite.config.ts` khung:

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: process.env.GITHUB_PAGES ? '/CharAnimation/' : '/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        maximumFileSizeToCacheInBytes: 60 * 1024 * 1024,
        runtimeCaching: [{ urlPattern: /\/models\//, handler: 'CacheFirst', options: { cacheName: 'models' } }],
      },
      manifest: { name: 'CharAnimation', short_name: 'CharAnim', display: 'standalone', theme_color: '#111111' },
    }),
  ],
  worker: { format: 'es' },
});
```

Thứ tự bắt tay vào code: M0 → M1 (làm `alpha.ts` và test trước) → M2 (viết `deform.ts` + test loop trước khi đụng Pixi) → M3 (sprite sheet trước vì đơn giản nhất, rồi APNG, GIF, WebM, MP4) → M4 → M5.

---

## 11. Phụ lục

### 11.1 License các thư viện chính

| Thư viện | License | Lưu ý |
|---|---|---|
| pixi.js | MIT | |
| zustand, idb-keyval, fflate, gifenc, upng-js, mp4-muxer, lucide-react | MIT | |
| @imgly/background-removal | AGPL-3.0 | Closed-source thương mại cần license từ IMG.LY |
| @huggingface/transformers | Apache-2.0 | |
| BiRefNet (model) | MIT | Ứng viên thay imgly |
| MODNet (model) | Apache-2.0 | Tốt cho chân dung, kém hơn cho đồ vật |
| BRIA RMBG-1.4 / 2.0 (model) | Non-commercial | Không dùng cho sản phẩm thương mại nếu chưa có thỏa thuận |
| @ffmpeg/ffmpeg | MIT (core LGPL/GPL tùy build) | Chỉ dùng giai đoạn 2, lazy-load |

### 11.2 Tài liệu tham khảo

- IMG.LY background removal: https://github.com/imgly/background-removal-js
- Transformers.js WebGPU background removal demo: https://huggingface.co/spaces/Xenova/remove-background-webgpu
- BiRefNet-lite ONNX trong browser: https://github.com/AkaraChen/web-image-background-remover
- Pixi.js v8 MeshPlane: https://pixijs.com/8.x/examples/mesh-and-shaders/mesh-plane
- gifenc: https://github.com/mattdesl/gifenc
- UPNG.js: https://github.com/photopea/UPNG.js
- mp4-muxer: https://github.com/Vanilagy/mp4-muxer
- WebCodecs VideoEncoder: https://developer.mozilla.org/docs/Web/API/VideoEncoder
- vite-plugin-pwa: https://vite-pwa-org.netlify.app/
- TexturePacker JSON Hash format: https://www.codeandweb.com/texturepacker/documentation/texture-settings

### 11.3 Quyết định cần chốt trước khi bắt đầu

| # | Câu hỏi | Mặc định nếu không có ý kiến |
|---|---|---|
| Q1 | Sản phẩm mở mã hay đóng mã? (ảnh hưởng chọn adapter tách nền) | Mở mã trên GitHub → dùng imgly |
| Q2 | Host ở GitHub Pages hay Cloudflare Pages? | GitHub Pages |
| Q3 | Có cần MP4 ngay ở v1 không? | Có, qua WebCodecs, ẩn nếu không hỗ trợ |
| Q4 | Tên sản phẩm hiển thị | "CharAnimation" |
