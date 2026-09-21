# Kiến trúc

Tài liệu này mô tả hệ thống **như đã xây dựng**, kèm lý do đằng sau những quyết
định đáng kể. Kế hoạch ban đầu nằm ở [`PLAN.md`](PLAN.md); mục cuối liệt kê chỗ
bản thực tế khác kế hoạch và vì sao.

## Luồng dữ liệu

```
File ảnh
   │ decodeSource()            giải mã, thu nhỏ ≤ 2048 px (iOS ≤ 1280), dò alpha
   ▼
ImageData gốc
   │ removeBackground()        Web Worker → adapter → PNG có matte
   │ (bỏ qua nếu ảnh đã có alpha)
   ▼
Matte thô
   │ decontaminate → erode → feather
   │ buildCutout()             cắt theo bbox alpha rồi thêm lề
   ▼
Cutout (ImageData + Blob + bbox)
   │
   ├─► PreviewCanvas ──► createGrid → deform(t) → MeshRenderer (WebGL2)
   │
   └─► runExport ──► FrameRenderer.renderAt(tᵢ) ──► gif / apng / sheet / mp4 / webm
                                                          │
                                                    <a download>
```

`deform()` là hàm thuần dùng chung cho cả preview và export. Cùng tham số và
cùng `t` thì cho hình học giống hệt nhau, nên bản xem thử đúng là bản sẽ xuất ra.

## Các tầng

| Thư mục | Trách nhiệm | Phụ thuộc |
|---|---|---|
| `src/engine` | Toán biến dạng, lưới, preset, timeline | Không (TypeScript thuần) |
| `src/image` | Giải mã, alpha, tiện ích canvas | DOM |
| `src/render` | Renderer WebGL2, dự phòng Canvas2D, renderer khung hình | `engine`, `image` |
| `src/bg-removal` | Giao diện adapter, worker, client | Lazy-load mô hình |
| `src/export` | Bộ mã hoá từng định dạng, điều phối, tải xuống | `engine`, `render` |
| `src/store` | Trạng thái Zustand, lưu trữ IndexedDB | Tất cả các tầng trên |
| `src/components` | Giao diện React | `store`, `i18n` |

`engine` cố tình không biết gì về DOM. Nhờ vậy toàn bộ phần toán được test trong
Node, và đó cũng là nơi 82 unit test tập trung vào.

## Vì sao loop liền mạch

Mỗi modifier được tạo từ `wave(shape, freq, θ, phase, ease)` với `θ = 2π·t/T` và
`freq` **luôn là số nguyên**. Cả hai dạng sóng đều có chu kỳ chia hết `2π`:

- `sine` → `sin(n·θ + φ)`, chu kỳ `2π/n`
- `bounce` → `2·|sin(n·θ/2 + φ/2)|^ease − 1`, giá trị tuyệt đối làm chu kỳ giảm
  một nửa nên cũng bằng `2π/n`

Vì vậy `f(0) = f(T)` là đẳng thức chính xác, không phải xấp xỉ. Bộ xuất render
các khung tại `i/fps` với `i ∈ [0, N)` và bỏ khung tại `t = T` vì nó trùng khung
đầu — giữ lại sẽ tạo một nhịp khựng mỗi vòng lặp.

Tệp test `tests/unit/deform.test.ts` kiểm chứng điều này cho cả tám preset và
cho trường hợp bật đồng thời mọi modifier.

## Renderer

Viết riêng bằng WebGL2 thay vì dùng thư viện 2D có sẵn. Lý do:

- **Kiểm soát alpha.** Toàn bộ đường đi làm việc ở alpha nhân sẵn
  (premultiplied), từ lúc nạp texture tới lúc trộn. Chỗ lưới gấp lên chính nó sẽ
  không sinh viền sáng hay viền tối.
- **Gọn.** Khoảng 250 dòng, không thêm 400 KB vào bundle.
- **Dự phòng rõ ràng.** `Canvas2DMeshRenderer` vẽ từng tam giác bằng biến đổi
  affine, chậm hơn nhưng giúp máy không có WebGL2 vẫn xuất được tệp.

### Khử răng cưa bằng siêu lấy mẫu, không dùng MSAA

Bật MSAA trên một lưới có cạnh dùng chung sẽ để lại **một đường sáng dọc theo
mọi cạnh trong**: hai tam giác kề nhau cùng ghi độ phủ một phần lên cùng cạnh
đó, cộng lại không ra 100%. Lỗi này nhìn thấy rõ trên ảnh chụp trong lúc phát
triển. Cách xử lý là tắt MSAA và render vào buffer lớn hơn rồi để trình duyệt
thu nhỏ.

Preview dùng **độ phân giải thích ứng**: đo thời gian khung hình thật, hạ hệ số
siêu lấy mẫu từ 2× xuống tối thiểu 0,75× khi máy không theo kịp, và nâng lại khi
máy dư sức. Trên bộ rasterizer phần mềm, cơ chế này nâng khung hình từ 19 lên 25
mỗi giây.

### Buộc dùng bộ vẽ dự phòng

`?renderer=canvas2d` trong URL ép chọn `Canvas2DMeshRenderer`, `?renderer=webgl2`
thì ngược lại. Đây vừa là lối thoát cho máy có driver lỗi, vừa là cách duy nhất
đủ thực tế để bộ test end-to-end phủ được nhánh dự phòng.

### Khung hình được đóng khung theo vùng quét

`contentBox()` lấy bao lồi của **toàn bộ vòng lặp**, không phải của tư thế đứng
yên. Nhờ vậy một nhân vật nghiêng ra ngoài khung texture không bị cắt giữa nhịp.
Preview và export dùng chung phép đóng khung này.

Việc tính vùng quét cần duyệt lưới 32 lần, chấp nhận được khi tham số đổi nhưng
quá đắt nếu làm mỗi khung hình. `createContentBoxCache()` ghi nhớ kết quả theo
định danh của đầu vào — store luôn thay thế object khi có thay đổi thật, nên so
sánh tham chiếu là đủ.

## Tách nền

Giao diện `BackgroundRemover` chỉ có một phương thức, nên đổi mô hình là đổi một
tệp:

| Adapter | Mô hình | Giấy phép | Mặc định |
|---|---|---|---|
| `imgly` | ISNet fp16 qua `@imgly/background-removal` | AGPL-3.0 | Có |
| `transformers` | BiRefNet-lite qua Transformers.js | Apache-2.0 / MIT | Bật bằng `VITE_BG_ADAPTER=transformers` |

Suy luận chạy trong Web Worker. Huỷ giữa chừng sẽ kết thúc luôn worker: phiên
ONNX không dừng được giữa lượt, và tạo worker mới rẻ hơn nhiều so với một tab bị
treo.

Sau khi có matte, ba bước dọn viền chạy trên kênh alpha:
`decontaminateEdges` đẩy màu của pixel bán trong suốt về phía hàng xóm đục nhất
(khử viền màu nền cũ), `erodeAlpha` thu viền, `featherAlpha` làm mềm viền.

## Xuất tệp

`createFrameStream()` dựng từng khung một và nhường vòng lặp sự kiện sau mỗi hai
khung, để thanh tiến trình còn chạy và nút huỷ còn bấm được.

### Độ trễ khung được phân bổ phần dư

GIF lưu độ trễ theo đơn vị 1/100 giây, APNG theo mili giây. Làm tròn độc lập
từng khung sẽ lệch: ở 15 hình/giây, GIF làm tròn 66,67 ms thành 70 ms ở **mọi**
khung và chạy chậm hơn 5%. `frameDelays()` làm tròn tổng tích luỹ thay vì từng
khung, nên phần dư được trải đều và tổng thời lượng đúng tuyệt đối. Kiểm chứng
bằng cách đọc trực tiếp các khối Graphic Control Extension của tệp GIF xuất ra:
`[7, 6, 7, 7, 6, …]`, tổng đúng 240 cs cho vòng lặp 2,4 giây.

### Chặn trước khi cạn bộ nhớ

APNG là định dạng duy nhất phải giữ toàn bộ chuỗi khung trong bộ nhớ, vì bộ mã
hoá cần đủ mọi khung mới ghi được tệp. Ở 1024 px và 30 hình/giây, một vòng lặp 8
giây cần khoảng một gigabyte và sẽ giết tab. `peakFrameMemoryBytes()` tính trước
con số đó; hộp thoại xuất cảnh báo khi vượt 350 MB và chặn hẳn khi vượt 700 MB,
kèm gợi ý giảm thiết lập nào. Các định dạng còn lại tiêu thụ khung theo luồng nên
không bị ràng buộc này.

### Video

Dùng Mediabunny điều khiển WebCodecs. Không định dạng video nào mà trình duyệt
mã hoá được giữ kênh alpha, nên bản xuất video luôn được đặt trên một màu nền và
giao diện nói rõ điều đó trước khi người dùng bấm xuất. `probeVideoSupport()`
hỏi trình duyệt trước và làm mờ lựa chọn không dùng được.

## Trạng thái và lưu trữ

Một store Zustand duy nhất. Vòng lặp render đọc store bằng
`useProject.getState()` chứ không qua hook — nó chạy mỗi khung hình và không
được phép đăng ký lại hay kích hoạt render React.

Dự án được tự lưu vào IndexedDB sau 800 ms kể từ thay đổi cuối, giữ tối đa 12
dự án gần nhất. Tệp `.charanim.json` chứa tham số để chia sẻ thiết lập mà không
kèm ảnh.

## Khác biệt so với kế hoạch

| Kế hoạch | Thực tế | Lý do |
|---|---|---|
| Pixi.js `MeshPlane` | Renderer WebGL2 tự viết | Kiểm soát alpha chính xác, bundle nhỏ hơn khoảng 400 KB, và có đường dự phòng Canvas2D rõ ràng |
| `mp4-muxer` + WebCodecs thủ công | Mediabunny | `mp4-muxer` đã ngừng hỗ trợ; Mediabunny lo cả MP4 lẫn WebM và tự dò khả năng mã hoá |
| Tự host trọng số mô hình trong `public/models/` | Tải từ CDN của nhà cung cấp, service worker cache vĩnh viễn | Giữ repo và bản deploy nhẹ; vẫn chạy offline sau lần đầu |
| Khử răng cưa bằng MSAA | Siêu lấy mẫu thích ứng | MSAA tạo đường nối trên mọi cạnh lưới dùng chung |
| Xuất WebM alpha và WebP động (giai đoạn 2) | Chưa làm | Cần ffmpeg.wasm khoảng 30 MB; APNG đã đáp ứng nhu cầu nền trong suốt |
| Cọ chỉnh mask thủ công | Chưa làm | Nằm ngoài phạm vi v1, đã ghi trong backlog |
