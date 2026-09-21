# Số đo hiệu năng

Mọi con số dưới đây được đo bằng `BENCH=1 npx playwright test benchmark` trên
bản build production, không phải ước lượng.

## Môi trường đo

| Hạng mục | Giá trị |
|---|---|
| Trình duyệt | Chromium 1194, chế độ headless |
| Đồ hoạ | SwiftShader, tức **rasterizer phần mềm, không có GPU** |
| Cửa sổ | 1280 × 860 |
| Ảnh đầu vào | `public/samples/cat.png`, 320 × 400, đã có alpha |
| Ngày đo | 2026-09-21 |

SwiftShader là trường hợp gần như xấu nhất. Máy có GPU thật sẽ nhanh hơn nhiều,
nhất là ở phần xuất tệp vốn bị giới hạn bởi tốc độ tô pixel.

## Preview

| Chỉ số | Giá trị |
|---|---|
| Renderer được chọn | WebGL2 |
| Khung hình mỗi giây | 25 |
| Buffer sau khi tự điều chỉnh | 1338 × 1049 |
| Buffer khi chưa điều chỉnh | 1784 × 1399 |

Bộ điều khiển độ phân giải thích ứng hạ hệ số siêu lấy mẫu từ 2,0 xuống 1,5 và
nâng khung hình từ 19 lên 25 mỗi giây. Trên GPU thật, hệ số giữ nguyên ở 2,0.

Việc ghi nhớ kết quả `contentBox` loại bỏ 32 lần duyệt lưới mỗi khung hình. Trên
máy này mức cải thiện chỉ khoảng một khung hình vì nút thắt nằm ở khâu tô pixel,
nhưng nó cắt hẳn phần CPU lãng phí và có ý nghĩa rõ trên thiết bị di động.

## Xuất tệp

Ảnh mẫu con mèo, 24 hình mỗi giây, vòng lặp 2,4 giây, tức 58 khung hình. Khử
răng cưa 2× bật.

| Định dạng | Kích thước | Thời gian | Tệp |
|---|---|---|---|
| GIF | 256 px | 9,8 s | 230 KB |
| GIF | 512 px | 10,7 s | 624 KB |
| APNG | 256 px | 10,4 s | 1 077 KB |
| APNG | 512 px | 15,7 s | 3 810 KB |
| Sprite sheet | 256 px | 10,7 s | 1 302 KB |
| Sprite sheet | 512 px | 15,1 s | 4 309 KB |

Phần lớn thời gian nằm ở khâu dựng khung hình chứ không phải mã hoá: mỗi khung
được render ở 2× rồi đọc ngược về CPU. Với GPU thật, khâu này nhanh hơn khoảng
một bậc độ lớn.

## Kích thước bundle

| Tệp | Thô | Gzip |
|---|---|---|
| `index` (mã ứng dụng) | 109 KB | 38 KB |
| `react` | 222 KB | 69 KB |
| `imgcodecs` (gifenc + upng) | 72 KB | 25 KB |
| CSS | 26 KB | 6 KB |
| **Tổng tải về lần đầu** | **429 KB** | **138 KB** |

Các phần nặng đều tải trễ, chỉ khi thực sự cần:

| Tệp | Kích thước | Tải khi |
|---|---|---|
| `mediabunny` | 702 KB | Mở hộp thoại xuất |
| ONNX Runtime (4 biến thể) | 4 × ~400 KB | Chạy tách nền |
| `ort-wasm-simd-threaded.jsep.wasm` | 23,9 MB (5,7 MB nén) | Chạy tách nền |

Ngưỡng đặt ra trong kế hoạch là 2 MB gzip cho mã ứng dụng. Con số thực tế là
138 KB, thấp hơn khoảng mười lăm lần.

## Kiểm chứng tính đúng đắn

Những điều sau được kiểm tra trên tệp thật chứ không chỉ qua unit test.

| Điều được kiểm | Cách kiểm | Kết quả |
|---|---|---|
| GIF lặp vô hạn | Tìm khối mở rộng `NETSCAPE2.0` | Có |
| Tổng thời lượng GIF | Đọc trực tiếp các khối Graphic Control Extension | 240 cs cho vòng lặp 2,4 s, đúng tuyệt đối |
| Phân bổ độ trễ | Danh sách delay thô | `[7, 6, 7, 7, 6, …]` |
| Không lặp khung cuối | So sánh khung 0 với khung cuối | Khác nhau, không trùng |
| Tính tuần hoàn | So sánh khung 0 với khung giữa của preset `sway` | Trùng khớp hoàn toàn, đúng với sóng sin một nhịp |
| Alpha của GIF | Thống kê giá trị alpha | Chỉ có 0 và 255, đúng chuẩn một bit của GIF |
| APNG có animation | Tìm khối `acTL` và `fcTL` | Có cả hai, 36 khung |
| Sprite sheet | Đối chiếu JSON với số khung | Số mục khớp, `frameRate` đúng |

## Điều chưa đo được

**Thời gian tách nền bằng AI chưa được đo.** Môi trường dựng bản này chặn CDN
chứa trọng số mô hình, nên khâu suy luận không chạy được ở đây. Những phần
xung quanh nó thì đã kiểm: worker khởi động, tiến trình được báo về, lỗi tải mô
hình hiện thông báo rõ ràng và người dùng vẫn đi tiếp được bằng nút bỏ qua — có
test end-to-end cho đúng tình huống này.

Khi tự chạy trên máy có mạng, hãy đo lại và ghi vào bảng dưới:

| Máy | Thiết bị tính toán | Ảnh | Thời gian |
|---|---|---|---|
| _(chưa đo)_ | WebGPU | 1024 px | |
| _(chưa đo)_ | WASM | 1024 px | |

Lần đầu còn phải tải mô hình và bộ chạy ONNX; giao diện hiển thị số MB theo thời
gian thực trong lúc tải.

## Tự chạy lại

```bash
npm run build
BENCH=1 npx playwright test benchmark
```

Kết quả ghi ra `benchmark.txt` và in ra màn hình. Đổi nơi ghi bằng `BENCH_OUT`.
