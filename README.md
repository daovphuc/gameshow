# Đấu Trường Tri Thức — Hệ Thống Trình Chiếu Game Show Trên Sân Khấu

Website tĩnh tổ chức thi đấu đố vui (Game Show) dành cho 10–20 đội thi qua 3 vòng, vận hành trực tiếp trên 1 máy tính kết nối máy chiếu sân khấu và lưu trữ miễn phí trên **GitHub Pages**.

Toàn bộ danh sách đội thi, câu hỏi, đáp án và cấu hình được lấy trực tiếp từ một **Google Sheet công khai (chế độ chỉ xem)** mà không cần máy chủ (backend) hay khóa API (API key). Điểm số và tiến độ thi đấu được lưu an toàn trong `localStorage` của trình duyệt máy chủ trì (MC/Host).

---

## 1. Hướng dẫn thiết lập Google Sheets (4 bước)

### Bước 1: Tạo Google Sheet và nhập dữ liệu mẫu (`sheet-template/`)
1. Truy cập [Google Sheets](https://sheets.google.com) và tạo một bảng tính mới.
2. Tạo đúng **4 trang tính (tabs)** ở thanh dưới cùng với tên viết thường chính xác như sau:
   - `teams`
   - `round1`
   - `round3`
   - `config`
3. Với mỗi tab, chọn **Tệp (File) → Nhập (Import) → Tải lên (Upload)** và chọn file CSV tương ứng trong thư mục [`sheet-template/`](./sheet-template/):
   - `sheet-template/teams.csv` → nhập vào tab `teams` (Chọn *"Thay thế trang tính hiện tại"*).
   - `sheet-template/round1.csv` → nhập vào tab `round1`.
   - `sheet-template/round3.csv` → nhập vào tab `round3`.
   - `sheet-template/config.csv` → nhập vào tab `config`.

### Bước 2: Bật chia sẻ công khai ("Bất kỳ ai có đường liên kết đều có thể xem")
1. Nhấn nút **Chia sẻ (Share)** ở góc trên bên phải Google Sheet.
2. Trong mục **Quyền truy cập chung (General access)**, đổi từ *Hạn chế (Restricted)* sang **Bất kỳ ai có đường liên kết (Anyone with the link)** với quyền **Người xem (Viewer)**.
3. Nhấn **Sao chép đường liên kết (Copy link)** rồi nhấn **Xong (Done)**.

### Bước 3: Lấy Sheet ID và kết nối vào Website
Đường dẫn Google Sheet có dạng:
```text
https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit#gid=0
```
Phần chuỗi nằm giữa `/d/` và `/edit` chính là **Sheet ID** (`1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms`).

Bạn có thể cấu hình Sheet ID theo 1 trong 3 cách:
- **Cách 1 (Khuyên dùng):** Mở trang **Cài đặt (`settings.html`)**, dán toàn bộ link Google Sheet hoặc Sheet ID vào ô cấu hình và bấm **Lưu & Tải dữ liệu từ Sheet**.
- **Cách 2 (Qua đường dẫn URL):** Truy cập trực tiếp với tham số `?sheet=<ID>`, ví dụ: `https://<username>.github.io/<repo>/?sheet=1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms`.
- **Cách 3 (Cố định trong mã nguồn):** Điền trực tiếp vào hằng số `DEFAULT_SHEET_ID` trong file [`js/config.js`](./js/config.js).

> Nếu chưa cấu hình Sheet ID, website tự động tải bộ dữ liệu mẫu tích hợp sẵn tại `data/sample/*.csv` (12 đội thi, 24 gói câu hỏi Vòng 1, 50 câu hỏi Vòng 3) để chạy thử ngay lập tức.

### Bước 4: Triển khai miễn phí lên GitHub Pages
1. Đẩy toàn bộ mã nguồn lên một kho lưu trữ (repository) trên GitHub.
2. Vào **Settings → Pages** của repository.
3. Tại mục **Build and deployment → Source**, chọn **Deploy from a branch**.
4. Chọn nhánh `main` và thư mục `/ (root)`, sau đó nhấn **Save**.
5. Sau khoảng 1 phút, website sẽ hoạt động tại `https://<username>.github.io/<repo-name>/`.

---

## 2. Cấu trúc các cột trong Google Sheet

Tên cột ở dòng đầu tiên (header) của mỗi tab sử dụng chữ thường `snake_case` tiếng Anh:

### Tab `teams` (Danh sách đội thi)
| Tên cột | Bắt buộc | Mô tả |
| :--- | :---: | :--- |
| `id` | Có | Mã định danh duy nhất của đội (ví dụ: `doi-01`, `doi-02`). |
| `name` | Có | Tên hiển thị của đội thi trên sân khấu (ví dụ: `Đội Sao Vàng`). |
| `image_url` | Không | Đường dẫn ảnh/logo của đội. Nếu để trống, hệ thống tự tạo avatar chữ cái đầu trên nền màu của đội. |
| `color` | Không | Mã màu HEX đại diện cho đội (ví dụ: `#D97757`). Nếu để trống, hệ thống tự gán màu từ bảng màu sân khấu. |

### Tab `round1` (Câu hỏi Vòng 1 — Theo gói)
| Tên cột | Bắt buộc | Mô tả |
| :--- | :---: | :--- |
| `package` | Có | Tên gói câu hỏi (ví dụ: `Gói Đ01 - Lịch Sử & Địa Lý` hoặc `Gói Chung 01`). |
| `team_id` | Không | Nếu điền `id` của đội, gói này chỉ đề xuất riêng cho đội đó. Nếu **để trống**, gói thuộc kho gói chung (đội nào chọn trước sẽ khóa gói đó đối với các đội sau). |
| `order` | Không | Thứ tự câu hỏi trong gói (`1, 2, 3, 4...`). |
| `question` | Có | Nội dung câu hỏi hiển thị trên màn chiếu. |
| `answer` | Có | Đáp án chính thức (chỉ hiển thị khi MC bấm *Hiện đáp án*). |
| `image_url` | Không | Đường dẫn hình ảnh minh họa cho câu hỏi (nếu có). |
| `time_seconds` | Không | Thời gian đếm ngược (giây) của câu hỏi. Nếu trống, lấy theo `round1_time_seconds` trong tab `config`. |
| `points` | Không | Điểm số cho câu trả lời đúng. Nếu trống, lấy theo `round1_default_points` trong tab `config`. |

### Tab `round3` (Câu hỏi Vòng 3 — Bảng 50 ô số)
| Tên cột | Bắt buộc | Mô tả |
| :--- | :---: | :--- |
| `number` | Có | Số thứ tự ô câu hỏi trên bảng (`1` đến `50`). |
| `question` | Có | Nội dung câu hỏi. |
| `answer` | Có | Đáp án chính thức. |
| `image_url` | Không | Đường dẫn hình ảnh minh họa (nếu có). |
| `time_seconds` | Không | Thời gian đếm ngược (giây). Nếu trống, lấy theo `round3_time_seconds` trong tab `config`. |
| `points` | Không | Điểm số của ô câu hỏi (ví dụ: `20`, `30`, `40`). |

### Tab `config` (Cấu hình chương trình & Bảng màu)
Gồm 2 cột `key` và `value`:
| Khóa (`key`) | Giá trị mặc định (`value`) | Mô tả |
| :--- | :--- | :--- |
| `show_title` | `Đấu Trường Tri Thức 2026` | Tên chương trình hiển thị trên thanh tiêu đề và Trang chủ. |
| `show_subtitle` | `Hội thi tìm hiểu kiến thức...` | Dòng phụ đề giới thiệu chương trình. |
| `round1_name` | `Vòng 1: Khởi Động` | Tên hiển thị của Vòng 1. |
| `round2_name` | `Vòng 2: Vượt Chướng Ngại Vật` | Tên hiển thị của Vòng 2. |
| `round3_name` | `Vòng 3: Tăng Tốc & Về Đích` | Tên hiển thị của Vòng 3. |
| `round1_time_seconds` | `15` | Thời gian đếm ngược mặc định (giây) cho mỗi câu Vòng 1. |
| `round3_time_seconds` | `20` | Thời gian đếm ngược mặc định (giây) cho mỗi ô Vòng 3. |
| `round1_default_points` | `10` | Điểm mặc định cho mỗi câu Vòng 1. |
| `round3_default_points` | `20` | Điểm mặc định cho mỗi câu Vòng 3. |
| `round1_packages_offered` | `2` | Số gói câu hỏi đề xuất chính cho mỗi đội ở Vòng 1. |
| `theme_mode` | `light` | Chế độ màu (`light` hoặc `dark`). |
| `bg_color` | `#F5F4ED` | Màu nền chính (`--bg`). |
| `surface_color` | `#FAF9F5` | Màu nền thẻ (`--surface`). |
| `text_color` | `#141413` | Màu chữ chính (`--text`). |
| `muted_color` | `#6B6960` | Màu chữ phụ (`--text-muted`). |
| `accent_color` | `#D97757` | Màu nhấn đất nung (`--accent`). |
| `accent_dark_color` | `#C6613F` | Màu nhấn đậm (`--accent-dark`). |
| `border_color` | `#E3E0D3` | Màu viền (`--border`). |

---

## 3. Phím tắt hỗ trợ MC trên sân khấu

- `Space` (Phím cách): Bắt đầu đồng hồ đếm ngược khi đang mở câu hỏi.
- `→` (Mũi tên phải): Nút **Tiếp tục** (chuyển câu hỏi tiếp theo / hoàn thành gói / quay về bảng 50 ô).
- `←` (Mũi tên trái): Nút **Quay lại**.

## 4. Kiểm thử tự động (Dành cho lập trình viên)

Chạy bộ kiểm thử đơn vị (Node.js built-in test runner, không phụ thuộc thư viện ngoài):
```bash
npm test
```
