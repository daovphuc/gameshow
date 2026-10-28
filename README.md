# Hội Thi Cán Bộ Tuyên Truyền, Kiểm Tra Giỏi Về PCCC và CNCH
## Hệ Thống Trình Chiếu Game Show Trực Tiếp Đa Thiết Bị

Website tĩnh tổ chức thi đấu chuyên nghiệp dành cho hội thi PCCC và CNCH qua 3 vòng thi, vận hành trực tiếp trên máy chiếu sân khấu và các thiết bị máy tính bảng (iPad) của Ban Giám khảo và các Đội thi, lưu trữ miễn phí trên **GitHub Pages**.

Toàn bộ danh sách đội thi, câu hỏi, ban giám khảo và cấu hình được quản lý trực quan trên một **Google Sheet công khai (chế độ chỉ xem)**. Trạng thái thi đấu trực tiếp (câu hỏi hiện tại, đồng hồ đếm ngược, đáp án đội thi, điểm số ban giám khảo, bảng tổng sắp) được đồng bộ hóa tức thì (real-time) giữa tất cả các thiết bị qua **Firebase Realtime Database** (gói miễn phí Spark) hoặc tự động chạy **Chế độ thử trên 1 máy (Local Mode)** khi chưa cấu hình Firebase.

---

## 1. Kiến Trúc 3 Cổng Truy Cập (Portals)

Hệ thống được thiết kế tối ưu cho 3 vai trò sử dụng tại hội trường thông qua trang điều hướng trung tâm `index.html`:

1. **Màn hình Dẫn chương trình / Máy chiếu sân khấu (`host.html`)**:
   - Vận hành trên máy tính của người dẫn chương trình kết nối máy chiếu hoặc màn hình LED lớn.
   - Bao gồm các màn hình chuyên biệt:
     - `host.html`: Tổng quan 3 vòng thi và thông tin hội thi.
     - `round1.html`: Vòng 1 — Tự giới thiệu & Khởi động (mỗi đội chọn 1 gói câu hỏi riêng).
     - `round2.html`: Vòng 2 — Trắc nghiệm kiến thức (chọn bộ đề, mở câu hỏi, đếm ngược đồng bộ tới tất cả iPad, tự động khóa khi hết giờ, công bố đáp án và thống kê số đội trả lời).
     - `round3.html`: Vòng 3 — Xử lý tình huống (bảng 50 ô số tương tác).
     - `leaderboard.html`: Bảng xếp hạng vinh danh Top 5 trên bục cúp chiến thắng với hoạt họa ánh kim sang trọng.
     - `scores.html`: Quản lý điểm số chi tiết từng giám khảo, trừ điểm vi phạm/quá giờ, ghi đè điểm sự cố và xuất báo cáo Excel CSV.
   - **Thanh bảng điểm trực tiếp (Live Leaderboard Drawer)**: Xuất hiện ở cạnh phải của mọi màn hình MC, hỗ trợ mở/đóng nhanh bằng nút `★ Bảng điểm`, tích hợp hiệu ứng chuyển động mượt mà (FLIP animation) tự động tráo đổi vị trí các đội khi điểm số thay đổi.

2. **Cổng Ban Giám khảo (`judge.html`)**:
   - Vận hành trên iPad của các thành viên Ban Giám khảo.
   - Giám khảo chọn danh tính của mình một lần duy nhất lúc đăng nhập.
   - Giao diện chấm điểm Vòng 1 & Vòng 3 thân thiện cho màn hình cảm ứng: các nút bấm to `+1`, `-1`, `+5`, `-5` để chấm riêng phần **Nội dung** (tối đa 45đ ở V1 / 25đ ở V3) và **Hình thức** (tối đa 5đ).
   - Ở Vòng 2: Màn hình tự động cập nhật câu hỏi đang thi và hiển thị thống kê tiến độ trả lời của các đội thi.

3. **Cổng Đội thi (`team.html`)**:
   - Vận hành trên iPad đặt tại bàn của từng đội thi.
   - Đội thi chọn tên đội một lần duy nhất lúc đăng nhập.
   - Ở Vòng 2: Khi MC bấm bắt đầu câu hỏi trên sân khấu, iPad của đội lập tức hiển thị nội dung câu hỏi và 4 nút chọn đáp án **A, B, C, D** cỡ lớn.
   - Tự động ghi nhận thời gian trả lời theo mili-giây chuẩn từ máy chủ và khóa nút sau khi chạm để đảm bảo mỗi đội chỉ được gửi một đáp án duy nhất.

---

## 2. Hướng Dẫn Thiết Lập Firebase Miễn Phí (5–10 Phút)

Hệ thống sử dụng cơ sở dữ liệu thời gian thực **Firebase Realtime Database** hoàn toàn miễn phí (gói Spark vĩnh viễn), không cần thẻ tín dụng, không cần cài đặt phần mềm máy chủ.

### Bước 1: Tạo dự án Firebase
1. Truy cập [Firebase Console](https://console.firebase.google.com/) và đăng nhập bằng tài khoản Google.
2. Nhấn nút **Add project (Thêm dự án)**.
3. Đặt tên dự án (ví dụ: `hoi-thi-pccc-2026`) rồi nhấn **Continue**.
4. Ở bước Google Analytics, tắt mục này (không cần thiết) rồi nhấn **Create project**. Đợi vài giây rồi nhấn **Continue** để vào bảng điều khiển.

### Bước 2: Kích hoạt Realtime Database
1. Trong menu bên trái, tìm mục **Build (Xây dựng)** → chọn **Realtime Database**.
2. Nhấn nút **Create Database (Tạo cơ sở dữ liệu)**.
3. Chọn vị trí máy chủ: chọn **Singapore (`asia-southeast1`)** để đảm bảo tốc độ phản hồi nhanh nhất và độ trễ thấp nhất tại Việt Nam. Nhấn **Next**.
4. Chọn **Start in locked mode (Bắt đầu ở chế độ khóa)** → nhấn **Enable (Bật)**.

### Bước 3: Cài đặt Quy tắc bảo mật (Database Rules)
1. Trong giao diện Realtime Database, chọn tab **Rules (Quy tắc)** ở phía trên.
2. Sao chép toàn bộ nội dung từ file [`firebase/database.rules.json`](./firebase/database.rules.json) trong thư mục dự án và dán đè vào ô soạn thảo Rules:
```json
{
  "rules": {
    ".read": true,
    "shared_sheet_id": {
      ".write": true
    },
    "live": {
      ".write": "!newData.exists() || !newData.hasChild('round2') || !newData.child('round2/answers').exists()",
      "stage": {
        ".write": true
      },
      "scores": {
        ".write": true
      },
      "penalties": {
        ".write": true
      },
      "judges": {
        ".write": true
      },
      "round1": {
        ".write": true
      },
      "round3": {
        ".write": true
      },
      "round2": {
        ".write": "!newData.child('answers').exists()",
        "state": { ".write": true },
        "set_id": { ".write": true },
        "q_index": { ".write": true },
        "question": { ".write": true },
        "shownAt": { ".write": true },
        "deadline": { ".write": true },
        "stats": { ".write": true },
        "results": { ".write": true },
        "scores": { ".write": true },
        "answers": {
          ".write": "!newData.exists()",
          "$teamId": {
            ".write": "!data.exists() && newData.exists() && (!root.child('live/round2/deadline').exists() || now <= root.child('live/round2/deadline').val())"
          }
        }
      }
    }
  }
}
```
3. Nhấn nút **Publish (Xuất bản)**.
   > **Tác dụng của quy tắc:**
   > - Cho phép mọi thiết bị đọc trạng thái thi đấu trực tiếp.
   > - Nghiêm cấm đội thi gửi đáp án lần 2 (chống sửa đáp án đã chọn).
   > - Tự động từ chối đáp án gửi sau khi hết thời gian đếm ngược (`now <= deadline`).
   > - Cho phép người dẫn chương trình xóa câu trả lời cũ khi chuyển câu hỏi mới.

### Bước 4: Lấy thông tin cấu hình Web App (Firebase Config)
1. Nhấn vào biểu tượng **Bánh răng cài đặt** ở góc trên menu bên trái → chọn **Project settings (Cài đặt dự án)**.
2. Cuộn xuống mục **Your apps (Ứng dụng của bạn)**, bấm vào biểu tượng Web **`</>`**.
3. Đặt tên ứng dụng (ví dụ: `gameshow-pccc`), **không** chọn *Firebase Hosting*, rồi nhấn **Register app (Đăng ký ứng dụng)**.
4. Màn hình sẽ hiển thị đoạn mã `firebaseConfig`:
```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "hoi-thi-pccc-2026.firebaseapp.com",
  databaseURL: "https://hoi-thi-pccc-2026-asia-southeast1.firebasedatabase.app",
  projectId: "hoi-thi-pccc-2026",
  storageBucket: "hoi-thi-pccc-2026.appspot.com",
  messagingSenderId: "123456789...",
  appId: "1:123456789...:web:..."
};
```

### Bước 5: Điền vào file `js/firebase-config.js`
1. Mở file [`js/firebase-config.js`](./js/firebase-config.js) trong mã nguồn dự án.
2. Dán các giá trị tương ứng vào:
```javascript
export const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "hoi-thi-pccc-2026.firebaseapp.com",
  databaseURL: "https://hoi-thi-pccc-2026-asia-southeast1.firebasedatabase.app",
  projectId: "hoi-thi-pccc-2026",
  storageBucket: "hoi-thi-pccc-2026.appspot.com",
  messagingSenderId: "123456789...",
  appId: "1:123456789...:web:..."
};
```
3. Lưu file và đẩy lên GitHub. Thông tin này là định danh công khai phía client của Firebase, hoàn toàn an toàn khi xuất bản trên GitHub Pages.

---

## 3. Cấu Hình Google Sheets

Hệ thống đọc dữ liệu từ một bảng tính Google Sheet được chia sẻ ở chế độ **"Bất kỳ ai có đường liên kết đều có thể xem"**.

### Tạo Sheet từ mẫu có sẵn
Tải file mẫu [`sheet-template/gameshow-template.xlsx`](./sheet-template/gameshow-template.xlsx) lên Google Drive, mở file và chọn **Tệp → Lưu dưới dạng Google Trang tính**.

Bảng tính gồm 6 tab:
1. `teams`: Danh sách các đội thi (`id`, `name`, `image_url`, `color`).
2. `round1`: Câu hỏi Vòng 1 theo từng đội (`package`, `team_id`, `question`, `image_url`, `time_seconds`, `points`).
3. `round2`: Ngân hàng câu hỏi trắc nghiệm Vòng 2 (`set_id`, `question_number`, `question`, `image_url`, `option_a`, `option_b`, `option_c`, `option_d`, `correct`, `time_seconds`).
4. `round3`: Bảng 50 câu hỏi tình huống Vòng 3 (`number`, `question`, `image_url`, `time_seconds`, `points`).
5. `judges`: Danh sách Ban Giám khảo (`id`, `name`).
6. `config`: Cấu hình tên chương trình, thời gian đếm ngược, thang điểm và mật khẩu các cổng.

---

## 4. Quản Lý Mật Khẩu Các Cổng Truy Cập

Để ngăn khán giả hoặc người lạ mở nhầm trang điều khiển của MC hoặc trang chấm điểm của Ban Giám khảo, hệ thống tích hợp sẵn màn hình khóa mật khẩu:

- **Mật khẩu mặc định:** `122345678910` (áp dụng cho mọi cổng nếu chưa cấu hình mật khẩu riêng).
- Khi nhập đúng mật khẩu, thiết bị sẽ ghi nhớ phiên đăng nhập (trong `localStorage`). Bạn có thể bấm nút **🔒 Khóa** trên thanh điều hướng để khóa lại.

### Đặt mật khẩu riêng cho từng cổng trong tab `config`
Bạn có thể cấu hình mật khẩu riêng biệt cho từng vai trò bằng mã băm SHA-256 (64 ký tự hex) trong tab `config`:
- `password_host_sha256`: Mật khẩu màn hình Dẫn chương trình / Máy chiếu.
- `password_judge_sha256`: Mật khẩu cổng Ban Giám khảo.
- `password_team_sha256`: Mật khẩu cổng Đội thi.

> **Cách tạo mã SHA-256 nhanh:**
> Mở trang web bất kỳ, nhấn `F12` vào mục **Console** và dán đoạn lệnh sau (thay `MAT_KHAU_CUA_BAN` bằng mật khẩu muốn đặt):
> ```js
> crypto.subtle.digest("SHA-256", new TextEncoder().encode("MAT_KHAU_CUA_BAN")).then(b => console.log([...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("")))
> ```
> Sao chép chuỗi 64 ký tự in ra và dán vào cột `value` tương ứng trong tab `config` của Google Sheet.

---

## 5. Quy Tắc Chấm Điểm & Xếp Hạng (Điều 21 & Điều 22)

Hệ thống tự động thực hiện đầy đủ các quy định theo Thể lệ hội thi:

1. **Vòng 1 & Vòng 3 (Điểm Giám Khảo & Điểm Trừ - Điều 19 & 21)**:
   - Điểm của đội là trung bình cộng điểm chấm của các Giám khảo (Nội dung + Hình thức) trừ đi Điểm phạt do vi phạm quy chế hoặc quá thời gian quy định.
   - Các giám khảo chưa bấm gửi điểm sẽ tự động bị loại khỏi mẫu số tính trung bình.
   - Khi có các đội bằng điểm nhau ở Vòng 1 hoặc Vòng 3: Đội có điểm trung bình phần **Nội dung** cao hơn sẽ được xếp trên.

2. **Vòng 2 (Trắc nghiệm tương tác - Điều 15)**:
   - Đội trả lời đúng tại thời điểm 0 giây được tối đa 1.000 điểm; điểm số giảm tuyến tính theo thời gian trả lời và đạt tối thiểu 500 điểm khi chạm mốc thời gian quy định.
   - Trả lời sai hoặc quá giờ nhận 0 điểm.
   - Tổng điểm phần mềm được chia cho hệ số quy đổi (mặc định 500) để tính ra điểm vòng thi (làm tròn 2 chữ số thập phân, tối đa 20 điểm).
   - Xếp hạng Vòng 2: Ưu tiên điểm phần mềm cao hơn → số câu đúng nhiều hơn → tổng thời gian trả lời câu đúng nhanh hơn.

3. **Bảng tổng sắp toàn đoàn (Điều 22)**:
   - Tổng điểm = Điểm Vòng 1 + Điểm Vòng 2 + Điểm Vòng 3.
   - Giải quyết hòa điểm: Nếu hai hoặc nhiều đội bằng tổng điểm, thứ tự ưu tiên phân định thứ hạng lần lượt là:
     1. Thứ hạng ở **Vòng 1** tốt hơn.
     2. Thứ hạng ở **Vòng 3** tốt hơn.
     3. Thứ hạng ở **Vòng 2** tốt hơn.

4. **Xuất báo cáo kết quả cuộc thi**:
   - Trong trang **Điểm số (`scores.html`)**, bấm **"⬇ Tải báo cáo (Excel CSV)"** để tải về file báo cáo đầy đủ chuẩn UTF-8 BOM, mở trực tiếp bằng Microsoft Excel hiển thị tiếng Việt hoàn hảo không lỗi font.
   - Báo cáo gồm: Bảng tổng kết thứ hạng toàn đoàn và Bảng chi tiết câu trả lời từng câu của Vòng 2.

---

## 6. Hướng Dẫn Chuẩn Bị Mạng & Dự Phòng (Wi-Fi & 4G)

Để hội thi diễn ra trôi chảy, Ban tổ chức nên chuẩn bị hạ tầng mạng theo các khuyến nghị sau:

1. **Bộ phát Wi-Fi tại hội trường**:
   - Sử dụng một bộ phát Wi-Fi chuyên dụng (khuyến nghị băng tần 5GHz) đặt tại khu vực sân khấu, chỉ dành riêng cho máy chiếu và các iPad dự thi (đặt mật khẩu riêng, không cấp cho khán giả).
   - Vì hệ thống sử dụng kết nối Firebase WebSocket siêu nhẹ (mỗi lượt gửi đáp án chỉ vài trăm byte), băng thông yêu cầu rất thấp nhưng cần độ ổn định kết nối.

2. **Dự phòng qua mạng 4G/5G**:
   - Trong trường hợp Wi-Fi hội trường gặp sự cố, các iPad có gắn SIM 4G/5G hoặc chia sẻ mạng từ điện thoại di động vẫn có thể kết nối đồng bộ trực tiếp với máy chiếu thông qua đám mây Firebase mà **không cần chung mạng nội bộ LAN**.

3. **Chế độ thử nghiệm 1 máy (Local Mode)**:
   - Nếu máy tính hoặc các thiết bị chưa có kết nối Internet / chưa cấu hình Firebase, hệ thống tự động kích hoạt chế độ **Local Mode** bằng công nghệ `BroadcastChannel` và `localStorage`.
   - Ban tổ chức có thể mở 3 tab trình duyệt trên cùng 1 máy tính (`host.html`, `judge.html`, `team.html`) để tổng duyệt toàn bộ quy trình trước giờ thi đấu.

---

## 7. Phím Tắt Điều Khiển

- `Space` (Phím cách): Bắt đầu tính giờ câu hỏi / Khóa câu hỏi.
- `→` (Mũi tên phải): Tiếp tục (công bố đáp án, chuyển câu hỏi tiếp theo).
- `←` (Mũi tên trái): Quay lại màn hình trước.

## 8. Chạy Kiểm Thử Tự Động

Kiểm tra toàn bộ 34 bài kiểm thử logic (không phụ thuộc DOM hay mạng):
```bash
npm test
```
