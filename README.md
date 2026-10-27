# Đấu Trường Tri Thức — Hệ Thống Trình Chiếu Game Show Trên Sân Khấu

Website tĩnh tổ chức thi đấu đố vui (Game Show) dành cho 10–20 đội thi qua 3 vòng, vận hành trên máy chiếu sân khấu và lưu trữ miễn phí trên **GitHub Pages**.

Toàn bộ danh sách đội thi, câu hỏi, cấu hình và bảng điểm được lấy từ một **Google Sheet công khai (chế độ chỉ xem)** mà không cần máy chủ (backend) hay khóa API (API key). Điểm số có thể được ghi trực tiếp lên tab `scores` của Google Sheet thông qua **Google Apps Script Web App** miễn phí (hoặc tự động lưu dự phòng trong `localStorage` của trình duyệt nếu chưa cấu hình Web App).

---

## 1. Hướng dẫn thiết lập Google Sheets & Apps Script (5 bước)

### Bước 1: Tạo Google Sheet và nhập dữ liệu mẫu (`sheet-template/`)

**Cách nhanh nhất:** tải [`sheet-template/gameshow-template.xlsx`](./sheet-template/gameshow-template.xlsx) lên Google Drive, mở file và chọn **Tệp → Lưu dưới dạng Google Trang tính**. File đã có sẵn đủ 5 tab, ghi chú cho từng cột và tab `huong_dan`. Sửa dữ liệu xong thì chuyển sang Bước 2.

Hoặc tự tạo từ các file CSV:
1. Truy cập [Google Sheets](https://sheets.google.com) và tạo một bảng tính mới.
2. Tạo **5 trang tính (tabs)** ở thanh dưới cùng với tên viết thường chính xác như sau:
   - `teams`
   - `round1`
   - `round3`
   - `config`
   - `scores`
3. Với mỗi tab, chọn **Tệp (File) → Nhập (Import) → Tải lên (Upload)** và chọn file CSV tương ứng trong thư mục [`sheet-template/`](./sheet-template/):
   - `sheet-template/teams.csv` → nhập vào tab `teams` (Chọn *"Thay thế trang tính hiện tại"*).
   - `sheet-template/round1.csv` → nhập vào tab `round1`.
   - `sheet-template/round3.csv` → nhập vào tab `round3`.
   - `sheet-template/config.csv` → nhập vào tab `config`.
   - `sheet-template/scores.csv` → nhập vào tab `scores`.

### Bước 2: Bật chia sẻ công khai ("Bất kỳ ai có đường liên kết đều có thể xem")
1. Nhấn nút **Chia sẻ (Share)** ở góc trên bên phải Google Sheet.
2. Trong mục **Quyền truy cập chung (General access)**, đổi từ *Hạn chế (Restricted)* sang **Bất kỳ ai có đường liên kết (Anyone with the link)** với quyền **Người xem (Viewer)**.
3. Nhấn **Sao chép đường liên kết (Copy link)** rồi nhấn **Xong (Done)**.

### Bước 3: Triển khai Google Apps Script để ghi điểm lên Sheet (Tùy chọn nhưng khuyên dùng)
Để điểm số nhập từ trang **Điểm số (`scores.html`)** được ghi trực tiếp vào tab `scores` của Google Sheet (giúp màn hình phụ chiếu **Bảng xếp hạng** tự động cập nhật điểm mỗi 10 giây trên bất kỳ máy nào):

1. Trong Google Sheet của bạn, mở menu **Tiện ích mở rộng (Extensions) → Apps Script**.
2. Xóa đoạn mã mặc định trong `Code.gs`, sao chép toàn bộ nội dung file [`apps-script/Code.gs`](./apps-script/Code.gs) dán vào và nhấn **Lưu (Save / Ctrl+S)**.
3. Nhấn nút **Triển khai (Deploy)** ở góc trên bên phải → chọn **Tạo triển khai mới (New deployment)**.
4. Nhấn biểu tượng bánh răng **Chọn loại (Select type)** → chọn **Ứng dụng web (Web app)**.
5. Thiết lập thông số:
   - **Thực thi dưới dạng (Execute as):** `Tôi (Me)`
   - **Ai có quyền truy cập (Who has access):** `Bất kỳ ai (Anyone)`
6. Nhấn **Triển khai (Deploy)**, cấp quyền truy cập cho tài khoản Google của bạn khi được hỏi, sau đó **sao chép URL Ứng dụng web (Web app URL)** (có dạng `https://script.google.com/macros/s/.../exec`).

> **Lưu ý bảo mật:** Bất kỳ ai biết đường dẫn **Web app URL** này đều có thể gửi yêu cầu ghi điểm vào tab `scores`. Chỉ nhập URL này trên máy tính của Ban tổ chức / Thư ký và không chia sẻ công khai đường dẫn Web app URL.

### Bước 4: Cấu hình trong Thanh bên trái (Sidebar) trên Website
1. Mở thanh bên trái (Sidebar) của website, bấm mở mục **⚙ Cài đặt & Dữ liệu**.
2. Dán đường dẫn hoặc ID của Google Sheet vào ô **Link Google Sheet**.
3. Dán đường dẫn **Apps Script Web App URL** vào ô **Link ghi điểm** (nếu để trống, điểm số sẽ chỉ lưu cục bộ trên trình duyệt hiện tại).
4. Nhấn **Lưu cài đặt**.

### Bước 5: Triển khai miễn phí lên GitHub Pages
1. Đẩy toàn bộ mã nguồn lên một kho lưu trữ (repository) trên GitHub.
2. Vào **Settings → Pages** của repository.
3. Tại mục **Build and deployment → Source**, chọn **Deploy from a branch**, nhánh `main` và thư mục `/ (root)`, sau đó nhấn **Save**.

---

## 2. Cấu trúc các cột trong Google Sheet

Tên cột ở dòng đầu tiên (header) của mỗi tab sử dụng chữ thường `snake_case` tiếng Anh:

### Tab `teams` (Danh sách đội thi)
| Tên cột | Bắt buộc | Mô tả |
| :--- | :---: | :--- |
| `id` | Có | Mã định danh duy nhất của đội (ví dụ: `doi-01`, `doi-02`). |
| `name` | Có | Tên hiển thị của đội thi trên sân khấu (ví dụ: `Đội Sao Vàng`). |
| `image_url` | Không | Tên file ảnh của đội đặt trong thư mục [`images/`](./images/) ở gốc dự án (ví dụ: `doi-01.jpg` sẽ được tải từ `images/doi-01.jpg`). Nếu đã là đường dẫn đầy đủ `http(s)://...` hoặc có chứa dấu `/` (như `teams/x.png`) thì giữ nguyên. Nếu để trống hoặc file ảnh không tồn tại, hệ thống tự động hiển thị chữ viết tắt tên đội trên nền màu của đội. |
| `color` | Không | Mã màu HEX đại diện cho đội (ví dụ: `#D97757`). |

### Tab `round1` (Câu hỏi Vòng 1 — Mỗi gói 1 câu hỏi, gắn với từng đội)
| Tên cột | Bắt buộc | Mô tả |
| :--- | :---: | :--- |
| `package` | Có | Tên gói câu hỏi của đội (ví dụ: `Gói A`, `Gói B`). |
| `team_id` | Có | Mã `id` của đội sở hữu gói câu hỏi này (ví dụ: `doi-01`). Mỗi gói thuộc về một đội cụ thể; các dòng thiếu `team_id` sẽ bị bỏ qua. |
| `question` | Có | Nội dung câu hỏi duy nhất của gói. *(Nếu trong Sheet có nhiều dòng trùng cùng một khóa `<team_id>::<package>`, dòng hợp lệ **đầu tiên** sẽ được sử dụng, các dòng dư bị bỏ qua).* |
| `image_url` | Không | Tên file hình ảnh minh họa trong thư mục `images/` (hoặc đường dẫn `http(s)://...`). |
| `time_seconds` | Không | Thời gian đếm ngược (giây). Nếu trống, lấy theo `round1_time_seconds` trong tab `config`. |
| `points` | Không | Điểm số của câu hỏi. Nếu trống, lấy theo `round1_default_points` trong tab `config`. |

### Tab `round3` (Câu hỏi Vòng 3 — Bảng 50 ô số)
| Tên cột | Bắt buộc | Mô tả |
| :--- | :---: | :--- |
| `number` | Có | Số thứ tự ô câu hỏi trên bảng (`1` đến `50`). |
| `question` | Có | Nội dung câu hỏi. |
| `image_url` | Không | Tên file hình ảnh minh họa trong thư mục `images/` (hoặc đường dẫn `http(s)://...`). |
| `time_seconds` | Không | Thời gian đếm ngược (giây). Nếu trống, lấy theo `round3_time_seconds` trong tab `config`. |
| `points` | Không | Điểm số của ô câu hỏi (ví dụ: `20`, `30`, `40`). |

### Tab `scores` (Điểm số đồng bộ của các đội)
| Tên cột | Bắt buộc | Mô tả |
| :--- | :---: | :--- |
| `team_id` | Có | Mã đội thi (khớp với cột `id` bên tab `teams`). |
| `round1` | Không | Điểm Vòng 1 của đội (mặc định `0`). |
| `round2` | Không | Điểm Vòng 2 của đội (mặc định `0`). |
| `round3` | Không | Điểm Vòng 3 của đội (mặc định `0`). |
| `updated_at` | Không | Thời điểm cập nhật gần nhất (ISO 8601, do Apps Script tự ghi). |

### Tab `config` (Cấu hình chương trình & Bảng màu)
Gồm 2 cột `key` và `value`:
| Khóa (`key`) | Giá trị mặc định (`value`) | Mô tả |
| :--- | :--- | :--- |
| `show_title` | `Đấu Trường Tri Thức 2026` | Tên chương trình hiển thị trên thanh bên và Trang chủ. |
| `show_subtitle` | `Hội thi tìm hiểu kiến thức...` | Dòng phụ đề giới thiệu chương trình. |
| `round1_name` | `Vòng 1: Khởi Động` | Tên hiển thị của Vòng 1. |
| `round1_description` | `Mỗi đội lựa chọn 1 trong 2 gói...` | Mô tả ngắn của Vòng 1 hiển thị trên Trang chủ. |
| `round2_name` | `Vòng 2: Vượt Chướng Ngại Vật` | Tên hiển thị của Vòng 2. |
| `round2_description` | `Phần thi tương tác trực tiếp...` | Mô tả ngắn của Vòng 2 hiển thị trên Trang chủ. |
| `round3_name` | `Vòng 3: Tăng Tốc & Về Đích` | Tên hiển thị của Vòng 3. |
| `round3_description` | `Bảng 50 ô câu hỏi bí mật...` | Mô tả ngắn của Vòng 3 hiển thị trên Trang chủ. |
| `round1_time_seconds` | `15` | Thời gian đếm ngược mặc định (giây) cho Vòng 1. |
| `round3_time_seconds` | `20` | Thời gian đếm ngược mặc định (giây) cho Vòng 3. |
| `warning_seconds` | `5` | Số giây cuối cùng đồng hồ nhấp nháy đỏ và hiện cảnh báo sắp hết giờ. |
| `round1_default_points` | `10` | Điểm mặc định cho câu hỏi Vòng 1. |
| `round3_default_points` | `20` | Điểm mặc định cho câu hỏi Vòng 3. |
| `round1_packages_offered` | `2` | Số gói câu hỏi đề xuất chính cho mỗi đội ở Vòng 1. |
| `theme_mode` | `light` | Chế độ màu (`light` hoặc `dark`). |
| `bg_color` | `#F5F4ED` | Màu nền chính (`--bg`). |
| `surface_color` | `#FAF9F5` | Màu nền thẻ (`--surface`). |
| `text_color` | `#141413` | Màu chữ chính (`--text`). |
| `muted_color` | `#6B6960` | Màu chữ phụ (`--text-muted`). |
| `accent_color` | `#D97757` | Màu nhấn đất nung (`--accent`). |
| `accent_dark_color` | `#C6613F` | Màu nhấn đậm (`--accent-dark`). |
| `border_color` | `#E3E0D3` | Màu viền (`--border`). |
| `password_sha256` | *(mặc định của `12345678910`)* | Mã băm SHA-256 (64 ký tự hex, không phân biệt hoa thường) dùng cho màn hình khóa mật khẩu khi vào trang. |

---

## 3. Mật khẩu mở khóa khi vào trang (`password_sha256`)

Mọi trang của hệ thống đều yêu cầu nhập mật khẩu trước khi hiển thị nội dung:
- **Mật khẩu mặc định:** `12345678910` (trong mã nguồn chỉ lưu mã băm SHA-256 `63640264849a87c90356129d99ea165e37aa5fabc1fea46906df1a7ca50db492`, không lưu mật khẩu dạng văn bản thuần).
- Sau khi nhập đúng, trình duyệt sẽ giữ trạng thái đã mở khóa (lưu trong `localStorage`) cho đến khi bạn nhấn nút **🔒 Khóa** ở cuối thanh điều hướng bên trái (Sidebar) hoặc khi khóa `password_sha256` trong Sheet thay đổi.

### Cách đổi mật khẩu qua tab `config` trên Google Sheet
1. Tạo mã băm SHA-256 (64 ký tự hex) cho mật khẩu mới bằng một dòng lệnh trong Terminal / Command Prompt (cần cài sẵn Node.js):
   ```bash
   node -e "console.log(require('crypto').createHash('sha256').update('MAT_KHAU_MOI_CUA_BAN').digest('hex'))"
   ```
   *(Hoặc chạy trực tiếp trong DevTools Console của trình duyệt):*
   ```js
   crypto.subtle.digest("SHA-256", new TextEncoder().encode("MAT_KHAU_MOI_CUA_BAN")).then(b => console.log([...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("")))
   ```
2. Mở tab `config` trên Google Sheet, thêm một dòng mới với:
   - Cột `key`: `password_sha256`
   - Cột `value`: chuỗi 64 ký tự hex vừa tạo ở bước 1.
3. Trên website, mở mục **⚙ Cài đặt & Dữ liệu → ↻ Tải lại dữ liệu** để áp dụng ngay mật khẩu mới.

> **Lưu ý bảo mật:** Cơ chế mật khẩu phía trình duyệt này chỉ là **lớp chắn cơ bản** nhằm tránh người xem vô tình mở nhầm trang điều khiển trên sân khấu, **không phải bảo mật thực sự (not real security)** vì GitHub Pages phân phối toàn bộ mã nguồn tĩnh và dữ liệu Google Sheet ở chế độ công khai.

---

## 4. Phím tắt hỗ trợ MC trên sân khấu

- `Space` (Phím cách): Bắt đầu đồng hồ đếm ngược khi đang mở câu hỏi.
- `→` (Mũi tên phải): Nút **Tiếp tục** (hoàn thành gói câu hỏi Vòng 1 / quay về bảng 50 ô Vòng 3).
- `←` (Mũi tên trái): Nút **Quay lại** (quay về danh sách đội Vòng 1 / bảng 50 ô Vòng 3).

## 5. Kiểm thử tự động

```bash
npm test
```
