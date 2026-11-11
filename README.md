# Hội Thi Cán Bộ Tuyên Truyền, Kiểm Tra Giỏi Về PCCC và CNCH
## Hệ Thống Trình Chiếu Game Show Trực Tiếp Đa Thiết Bị

Website tĩnh tổ chức thi đấu chuyên nghiệp dành cho hội thi PCCC và CNCH qua 3 vòng thi, vận hành trực tiếp trên máy chiếu sân khấu và các thiết bị máy tính bảng (iPad) của Ban Giám khảo và các Đội thi, lưu trữ miễn phí trên **GitHub Pages**.

Toàn bộ danh sách đội thi, câu hỏi và chủ đề thi, ban giám khảo, tài khoản và cấu hình được quản lý trực tiếp ngay trong ứng dụng qua trang **"Cấu hình nội dung" (`content.html`)**. Trạng thái thi đấu trực tiếp (câu hỏi hiện tại, đồng hồ đếm ngược, đáp án đội thi, điểm số ban giám khảo, bảng tổng sắp) được đồng bộ hóa tức thì (real-time) giữa tất cả các thiết bị qua **Firebase Realtime Database** (gói miễn phí Spark) hoặc tự động chạy **Chế độ thử trên 1 máy (Local Mode)** khi chưa cấu hình Firebase.

---

## 1. Kiến Trúc 3 Cổng Truy Cập (Portals)

Hệ thống được thiết kế tối ưu cho 3 vai trò sử dụng tại hội trường thông qua trang điều hướng trung tâm `index.html`:

1. **Màn hình Dẫn chương trình / Máy chiếu sân khấu (`host.html`)**:
   - Vận hành trên máy tính của người dẫn chương trình kết nối máy chiếu hoặc màn hình LED lớn.
   - Bao gồm các màn hình chuyên biệt:
     - `host.html`: Tổng quan 3 vòng thi và thông tin hội thi.
     - `round1.html`: Vòng 1 — Tuyên truyền PCCC (chọn đội theo số thứ tự thi, mỗi đội chọn 1 chủ đề riêng).
     - `round2.html`: Vòng 2 — Trắc nghiệm kiến thức (chọn bộ đề, mở câu hỏi, đếm ngược đồng bộ tới tất cả iPad, tự động khóa khi hết giờ, công bố đáp án và thống kê bảng xếp hạng Vòng 2).
     - `round3.html`: Vòng 3 — Xử lý tình huống truyền thông (bảng ô số tương tác).
     - `leaderboard.html`: Bảng xếp hạng vinh danh Top 5 trên bục cúp chiến thắng với hoạt họa ánh kim và pháo hoa chúc mừng; hỗ trợ xuất báo cáo kết quả cuộc thi (CSV).
     - `content.html`: Trình soạn thảo và quản trị nội dung trực tiếp dành cho MC, quản lý tài khoản, xuất báo cáo kết quả cuộc thi (CSV) và đặt lại trận đấu.
   - **Thanh bảng điểm trực tiếp (Live Leaderboard Drawer)**: Xuất hiện ở cạnh phải của mọi màn hình MC, hỗ trợ mở/đóng nhanh bằng nút `★ Bảng điểm`, tích hợp hiệu ứng chuyển động mượt mà (FLIP animation) tự động tráo đổi vị trí các đội khi điểm số thay đổi.

2. **Cổng Ban Giám khảo (`judge.html`)**:
   - Vận hành trên iPad của các thành viên Ban Giám khảo và Giám khảo tổng.
   - Đăng nhập bằng tài khoản giám khảo (vd: `gk1`..`gk3`) sẽ vào thẳng danh tính của giám khảo đó, không cần chọn thủ công.
   - **Giám khảo tổng (`gktong`)**: Có quyền xem và nhập đồng thời điểm số cho toàn bộ các giám khảo đối với từng đội thi, lưu điểm hàng loạt với 1 nút bấm (chỉ chỉnh sửa khi đội chưa bị khóa), đồng thời nhập thời gian quá giờ để hệ thống tự động trừ điểm vi phạm thời gian theo Điều 19.
   - Giao diện chấm điểm Vòng 1 & Vòng 3 thân thiện cho iPad cảm ứng: hiển thị đội đang thi và chủ đề/tình huống nổi bật ở trên, các nút tăng/giảm to `+0.5`, `-0.5`, `+1`, `-1`, `+5`, `-5` và thanh trượt để chấm riêng phần **Nội dung** (tối đa 45đ ở V1 / 25đ ở V3) và **Hình thức** (tối đa 5đ), hiển thị tổng điểm trực tiếp và trạng thái đã lưu rõ ràng.
   - Phía dưới có bảng tổng quan tiến độ chấm tất cả các đội trong vòng thi theo đúng thứ tự thi đã cấu hình; giám khảo có thể chạm vào đội bất kỳ để xem lại hoặc điều chỉnh điểm trước khi MC khóa phần thi.
   - Ở Vòng 2: Màn hình tự động cập nhật câu hỏi đang thi và hiển thị bảng theo dõi tiến độ trả lời trực tiếp của các đội thi.

3. **Cổng Đội thi (`team.html`)**:
   - Vận hành trên iPad đặt tại bàn của từng đội thi.
   - Đăng nhập bằng tài khoản đội (vd: `doi01`..`doi35`) sẽ vào thẳng danh tính đội của mình, không cần chọn thủ công.
   - Ở Vòng 1 & Vòng 3: Màn hình chờ thông minh hiển thị rõ tên vòng thi, báo hiệu khi đến lượt đội mình bước lên sân khấu và hiển thị nội dung chủ đề / tình huống bốc thăm. Nếu đội không tham gia vòng thi (do cấu hình thứ tự thi), màn hình thông báo rõ đội không tham gia.
   - Ở Vòng 2: Khi MC phát lệnh tính giờ trên sân khấu, iPad của đội lập tức hiển thị nội dung câu hỏi và 4 nút chọn đáp án **A, B, C, D** cỡ lớn.
   - Tự động ghi nhận thời gian trả lời theo mili-giây chuẩn từ máy chủ và khóa nút sau khi chạm để đảm bảo mỗi đội chỉ được gửi một đáp án duy nhất. Đội không tham gia vòng 2 sẽ không thể gửi đáp án.

---

## 2. Hướng Dẫn Thiết Lập Firebase Miễn Phí (5–10 Phút)

Hệ thống sử dụng cơ sở dữ liệu thời gian thực **Firebase Realtime Database** hoàn toàn miễn phí (gói Spark vĩnh viễn), không cần thẻ tín dụng, không cần cài đặt phần mềm máy chủ.

### Bước 1: Tạo dự án Firebase
1. Truy cập [Firebase Console](https://console.firebase.google.com/) và đăng nhập bằng tài khoản Google.
2. Nhấn nút **Add project (Thêm dự án)**.
3. Đặt tên dự án (ví dụ: `hoi-thi-pccc-2026`) rồi nhấn **Continue**.
4. Ở bước Google Analytics, tắt mục này (không cần thiết) rồi nhấn **Create project**. Đợi vài giây rồi nhấn **Continue** để vào bảng điều khiển.

### Bước 2: Kích hoạt Authentication (Xác thực) & Tạo tài khoản Dẫn chương trình (MC)
1. Trong menu bên trái, tìm mục **Build (Xây dựng)** → chọn **Authentication**.
2. Nhấn nút **Get started (Bắt đầu)**.
3. Chọn tab **Sign-in method (Phương thức đăng nhập)** → chọn **Email/Password**.
4. Bật công tắc kích hoạt đầu tiên (**Email/Password** - Enable) rồi nhấn **Save (Lưu)**. (Không cần bật Email link / passwordless).
5. Chuyển sang tab **Users (Người dùng)** → nhấn nút **Add user (Thêm người dùng)**.
6. Nhập:
   - **Email**: `mc@hoithi.local`
   - **Password**: Đặt mật khẩu đăng nhập ban đầu cho MC (ít nhất 6 ký tự).
7. Nhấn **Add user**. Tài khoản MC ban đầu này sẽ được hệ thống tự động kích hoạt quyền quản trị Dẫn chương trình (`host`) ngay trong lần đăng nhập đầu tiên (cơ chế tự động Bootstrap).

### Bước 3: Kích hoạt Realtime Database
1. Trong menu bên trái, tìm mục **Build (Xây dựng)** → chọn **Realtime Database**.
2. Nhấn nút **Create Database (Tạo cơ sở dữ liệu)**.
3. Chọn vị trí máy chủ: chọn **Singapore (`asia-southeast1`)** để đảm bảo tốc độ phản hồi nhanh nhất và độ trễ thấp nhất tại Việt Nam. Nhấn **Next**.
4. Chọn **Start in locked mode (Bắt đầu ở chế độ khóa)** → nhấn **Enable (Bật)**.

### Bước 4: Cài đặt Quy tắc bảo mật (Database Rules)
1. Trong giao diện Realtime Database, chọn tab **Rules (Quy tắc)** ở phía trên.
2. Sao chép toàn bộ nội dung từ file [`firebase/database.rules.json`](./firebase/database.rules.json) trong thư mục dự án và dán đè vào ô soạn thảo Rules:
```json
{
  "rules": {
    ".read": false,
    ".write": false,
    "roles": {
      ".read": "auth != null && root.child('roles').child(auth.uid).child('role').val() === 'host'",
      "$uid": {
        ".read": "auth != null && auth.uid === $uid",
        ".write": "auth != null && ((root.child('roles').child(auth.uid).child('role').val() === 'host') || (!root.child('roles').exists() && newData.child('role').val() === 'host' && $uid === auth.uid))"
      }
    },
    "content": {
      ".read": "auth != null && root.child('roles').child(auth.uid).exists()",
      ".write": "auth != null && root.child('roles').child(auth.uid).child('role').val() === 'host'"
    },
    "live": {
      ".read": "auth != null && root.child('roles').child(auth.uid).exists()",
      ".write": "auth != null && root.child('roles').child(auth.uid).child('role').val() === 'host'",
      "penalties": {
        "$round": {
          "$team": {
            ".write": "auth != null && (root.child('roles').child(auth.uid).child('role').val() === 'host' || root.child('roles').child(auth.uid).child('role').val() === 'head_judge')"
          }
        }
      },
      "judgeScores": {
        "$round": {
          "$team": {
            "$judgeId": {
              ".write": "auth != null && (root.child('roles').child(auth.uid).child('role').val() === 'host' || root.child('roles').child(auth.uid).child('role').val() === 'head_judge' || (root.child('roles').child(auth.uid).child('role').val() === 'judge' && root.child('roles').child(auth.uid).child('ref_id').val() === $judgeId))"
            }
          }
        }
      }
    },
    "answers": {
      ".read": "auth != null && root.child('roles').child(auth.uid).exists()",
      ".write": "auth != null && root.child('roles').child(auth.uid).child('role').val() === 'host' && !newData.exists()",
      "$questionKey": {
        "$teamId": {
          ".write": "auth != null && root.child('roles').child(auth.uid).child('role').val() === 'team' && root.child('roles').child(auth.uid).child('ref_id').val() === $teamId && !data.exists() && newData.exists() && $questionKey === root.child('live/round2/questionKey').val() && root.child('live/round2/status').val() === 'open' && (!root.child('live/round2/deadline').exists() || now <= root.child('live/round2/deadline').val()) && newData.child('answeredAt').val() === now"
        }
      }
    }
  }
}
```
3. Nhấn nút **Publish (Xuất bản)**.
   > **Tác dụng của quy tắc bảo mật:**
   > - Chặn đọc/ghi công khai tại gốc (`.read: false`, `.write: false`). Chỉ người dùng đã đăng nhập và được cấp quyền (`roles/<uid>`) mới đọc được dữ liệu hội thi.
   > - Phân quyền ghi tuyệt đối: Chỉ Dẫn chương trình (`host`) mới được chỉnh sửa cấu hình nội dung (`content`) và điều khiển trận đấu (`live`).
   > - Ban Giám khảo (`judge`) chỉ có quyền ghi phiếu điểm của chính mình (`live/judgeScores/.../$judgeId`); Giám khảo tổng (`head_judge`) và Host có quyền ghi điểm cho mọi giám khảo và ghi điểm trừ quá giờ (`live/penalties`).
   > - Đội thi (`team`) chỉ được phép gửi duy nhất 1 lần đáp án của chính đội mình ở câu hỏi đang mở trước thời hạn đếm ngược (`now <= deadline`).
   > - Chỉ Dẫn chương trình mới có quyền xóa (`reset`) dữ liệu câu trả lời cũ (`answers`).

### Bước 5: Lấy thông tin cấu hình Web App (Firebase Config)
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

### Bước 6: Điền vào file `js/firebase-config.js` & Đăng nhập tạo tài khoản
1. Mở file [`js/firebase-config.js`](./js/firebase-config.js) trong mã nguồn dự án và điền thông tin config ở Bước 5.
2. Mở `index.html`, đăng nhập bằng tài khoản `mc` với mật khẩu đã tạo ở Bước 2. Hệ thống sẽ tự động gán quyền `host` cho tài khoản này.
3. Vào trang **Cấu hình nội dung (`content.html`)** → chọn tab **Tài khoản** để tạo thêm các tài khoản Giám khảo, Đội thi (hoặc nhấn **"📁 Tạo hàng loạt từ CSV"**).

---

## 3. Cấu Hình Nội Dung Trực Tiếp Trong Ứng Dụng (Trang `content.html`)

Hệ thống tích hợp sẵn trình soạn thảo nội dung trực quan cho MC tại trang **"Cấu hình nội dung" (`content.html`)**, truy cập trực tiếp từ thanh bên (sidebar) của Dẫn chương trình trong mục **Cài đặt & Dữ liệu**.

Toàn bộ dữ liệu được lưu trữ tại nút `content/` trên Firebase Realtime Database (hoặc bộ nhớ nội bộ ở chế độ Local Mode) và tự động đồng bộ tức thì tới tất cả các màn hình:

1. **Đội thi**: Thêm, sửa tên, xóa đội thi, chọn màu sắc đại diện và ảnh đại diện của đội (hỗ trợ gợi ý danh sách 35 đội thi có sẵn theo đúng danh mục Công an các tỉnh, thành phố và các Trường CAND). Ảnh không tải lên database: chép file ảnh vào thư mục `images/` của dự án rồi commit, sau đó nhập tên file (ví dụ `doi01.png`) hoặc một link https vào ô ảnh; trang hiển thị ảnh xem trước.
2. **Thứ tự thi & Phân cụm thi đấu (Clusters)**:
   - Cấu hình danh sách đội tham gia và số thứ tự thi riêng biệt cho toàn bộ hội thi (`contest`) và từng vòng thi (`round1`, `round2`, `round3`).
   - Tích hợp sẵn nút chọn cụm nhanh: **Cụm 1** (12 đội — Học viện CSND, Hà Nội), **Cụm 2** (12 đội — Công an tỉnh Quảng Ngãi), **Cụm 3** (11 đội — Công an tỉnh Tây Ninh), và **Chung kết** (Khánh Hòa) theo đúng Kế hoạch số 204/KH-BCA-C07.
   - Khi chọn cụm, hệ thống tự động thiết lập danh sách thứ tự thi của tất cả các vòng và tự động đồng bộ dòng phụ đề hội thi (`show_subtitle`) hiển thị thời gian, địa điểm thi đấu lên đầu các màn hình máy chiếu (`host.html`, `round1.html`, `round2.html`, `round3.html`, `leaderboard.html`). Dữ liệu cấu hình cụm được lưu tại `data/sample/clusters.csv`.
3. **Vòng 1 (Tuyên truyền)**: Chỉnh sửa các chủ đề (tên chủ đề, đội sở hữu, nội dung câu hỏi, thời gian 15 phút và thang điểm tối đa 50đ gồm 45đ nội dung + 5đ hình thức).
4. **Vòng 2 (Trắc nghiệm)**:
   - Chỉnh sửa ngân hàng câu hỏi trắc nghiệm chia theo từng bộ đề, bao gồm bộ **"Chạy thử"** (10 câu: 4 Kiểm tra, 3 Tuyên truyền, 2 Xử phạt, 1 Điều tra) và các bộ đề chính thức.
   - Hỗ trợ câu hỏi 4 phương án (A, B, C, D) hoặc câu hỏi 2 phương án (A, B - dạng Đúng/Sai hoặc Có/Không), tự động ẩn các nút lựa chọn C, D trên màn hình iPad của đội thi.
   - Quản lý trường **Lĩnh vực (`category`)** (Kiểm tra, Tuyên truyền, Xử phạt, Điều tra) với bộ lọc chuyên biệt, và **Căn cứ pháp lý / Giải thích (`explanation`)**.
   - Bảo mật thông tin: iPad đội thi (`team.html`) không bao giờ nhận được đáp án đúng hoặc nội dung giải thích trước khi câu hỏi được công bố (reveal). Khi MC mở đáp án, máy chiếu sân khấu hiển thị đáp án đúng, trích dẫn pháp lý chi tiết và bảng thống kê kết quả, thời gian phản hồi của từng đội thi.
5. **Vòng 3 (Xử lý tình huống)**: Quản lý danh sách các ô tình huống truyền thông (số thứ tự ô, nội dung tình huống, thời gian suy nghĩ 2 phút + trả lời 5 phút và điểm số tối đa 30đ gồm 25đ nội dung + 5đ hình thức).
6. **Ban Giám khảo**: Thêm, sửa họ tên và mã định danh của các thành viên Ban Giám khảo.
7. **Tài khoản**: Quản lý phân quyền tài khoản (vai trò, đối tượng liên kết, tên hiển thị) và tạo tài khoản Firebase Authentication trực tiếp trong ứng dụng. Hỗ trợ tạo từng tài khoản hoặc tạo hàng loạt từ file CSV. Ở chế độ Local Mode, hỗ trợ thêm/sửa/tạo tài khoản thử nghiệm trực tiếp.
8. **Cài đặt chung**: Điều chỉnh tên hội thi, tiêu đề phụ, thời gian đếm ngược, điểm trắc nghiệm mỗi câu đúng Vòng 2 và thang điểm từng vòng thi. Tích hợp khu vực nguy hiểm để **Đặt lại trận đấu** (xóa dữ liệu thi đấu trực tiếp để chuẩn bị trận mới, có xác nhận an toàn) và nút **Tải báo cáo kết quả (CSV)**.

### Các nút chức năng tiện ích:
- **💾 Lưu vào hệ thống**: Kiểm tra tính hợp lệ của toàn bộ dữ liệu (chống trùng ID, chống thiếu đáp án, kiểm tra thứ tự thi hoặc liên kết sai) rồi lưu vào cơ sở dữ liệu, đồng bộ ngay lập tức tới máy chiếu và tất cả iPad.
- **↻ Nạp dữ liệu mẫu**: Khôi phục dữ liệu mẫu chuẩn từ các file `data/sample/*.csv` vào trình soạn thảo (kèm hộp thoại xác nhận).
- **⬇ Xuất / ⬆ Nhập file sao lưu (JSON)**: Cho phép sao lưu toàn bộ nội dung hội thi ra file JSON về máy tính và khôi phục lại bất kỳ lúc nào mà không cần kết nối mạng.

---

## 4. Quản Lý Tài Khoản Đăng Nhập & Phân Quyền Bảo Mật

Hệ thống sử dụng cơ chế bảo mật kết hợp giữa **Firebase Authentication (Email/Password)** và cây phân quyền **`roles/<uid>`** trên Firebase Realtime Database:

- **Bảo mật mật khẩu tuyệt đối**: Mật khẩu được mã hóa an toàn trên dịch vụ Firebase Authentication, hoàn toàn **không lưu trữ trong cơ sở dữ liệu** và **không lưu trong mã nguồn repo**.
- **Trải nghiệm đăng nhập thuận tiện**: Người dùng chỉ cần nhập tên đăng nhập ngắn gọn (như `mc`, `gk1`, `gktong`, `doi01`) cùng mật khẩu. Hệ thống tự động chuyển đổi tên đăng nhập sang email nội bộ `<username>@hoithi.local` (chữ thường, cắt khoảng trắng thừa).
- **Phân quyền vai trò (`roles/<uid>`)**:
  - `username`: Tên đăng nhập của người dùng.
  - `role`: Một trong 4 vai trò: `host` (Dẫn chương trình), `judge` (Ban Giám khảo), `head_judge` (Giám khảo tổng), `team` (Đội thi).
  - `ref_id`: Mã giám khảo (vd: `gk-01`) hoặc mã đội (vd: `doi-01`); để trống đối với vai trò `host` và `head_judge`.
  - `display_name`: Tên hiển thị người dùng (tùy chọn, tự động lấy theo tên giám khảo/đội thi nếu để trống).
- **Kiểm soát truy cập cổng (Access Control)**: Sau khi đăng nhập, hệ thống đọc bản ghi `roles/<uid>`. Nếu tài khoản chưa được cấp quyền, hệ thống sẽ tự động đăng xuất và thông báo `"Tài khoản chưa được cấp quyền"`. Mỗi cổng (`host.html`, `judge.html`, `team.html`) chỉ cho phép tài khoản có vai trò phù hợp truy cập.
- **Duy trì phiên đa cổng đồng thời**: Mỗi cổng sử dụng một phiên Firebase App độc lập (`portal_host`, `portal_judge`, `portal_team`), cho phép người điều hành đăng nhập đồng thời cả Host, Giám khảo và Đội thi trên cùng một trình duyệt để kiểm thử mà không bị xung đột phiên.

### Quản trị tài khoản trên trang Cấu hình nội dung (`content.html`)
Dẫn chương trình (`host`) có toàn quyền quản lý tài khoản tại tab **"Tài khoản"**:
1. **Xem danh sách**: Hiển thị toàn bộ tài khoản đã được cấp quyền, vai trò và đối tượng liên kết.
2. **Tạo 1 tài khoản**: Nhập tên đăng nhập, mật khẩu (tối thiểu 6 ký tự), vai trò và đối tượng liên kết. Hệ thống sử dụng ứng dụng phụ để tạo người dùng trên Firebase Auth mà không làm gián đoạn phiên làm việc của Host, sau đó ghi bản ghi phân quyền `roles/<uid>`.
3. **📁 Tạo hàng loạt từ CSV**: Tải lên hoặc dán nội dung CSV với cấu trúc các cột `username,password,role,ref_id,display_name`. Hệ thống lần lượt tạo tài khoản và hiển thị bảng kết quả chi tiết từng dòng (Thành công / Đã tồn tại / Lỗi) bằng tiếng Việt.
4. **Chỉnh sửa & Thu hồi quyền**:
   - Host có thể cập nhật vai trò, đối tượng liên kết hoặc tên hiển thị của tài khoản.
   - Nút **"Thu hồi quyền"** sẽ xóa bản ghi `roles/<uid>`, lập tức chặn truy cập của tài khoản đó. Để xóa vĩnh viễn tài khoản Auth, thực hiện trên Firebase Console.
5. **Đổi mật khẩu & Đặt lại mật khẩu**:
   - Mọi người dùng đã đăng nhập đều có thể tự đổi mật khẩu của mình bằng nút **"🔑 Đổi mật khẩu"** trên thanh bên (sidebar) hoặc thanh tiêu đề (header).
   - Host **không thể xem hay đặt lại mật khẩu của người khác**. Để đặt lại mật khẩu cho một tài khoản bị quên, hãy xóa tài khoản đó trong Firebase Console (Authentication) rồi tạo lại trong ứng dụng.

### Chế độ thử trên 1 máy (Local Mode)
- Khi `databaseURL` để trống hoặc chưa cấu hình Firebase, hệ thống tự động chạy ở chế độ **Local Mode** lưu dữ liệu trong `localStorage` và đồng bộ qua `BroadcastChannel`.
- Mật khẩu mẫu trong file `data/sample/accounts.csv` (như `122345678910`) **chỉ áp dụng cho chế độ Local Mode** phục vụ chạy thử nghiệm. Khi triển khai trên Firebase thật, Ban tổ chức tự đặt mật khẩu thực tế khi tạo tài khoản.

---

## 5. Quy Tắc Chấm Điểm & Xếp Hạng (Điều 21 & Điều 22)

Hệ thống tự động thực hiện đầy đủ các quy định theo Thể lệ hội thi (xem bảng đối chiếu chi tiết toàn bộ 27 điều khoản tại [`docs/doi-chieu-dieu-le.md`](./docs/doi-chieu-dieu-le.md)):

1. **Vòng 1 & Vòng 3 (Điểm Giám Khảo & Điểm Phạt - Điều 19, 20 & 21)**:
   - Điểm của đội là trung bình cộng điểm chấm của các Giám khảo (Nội dung + Hình thức) trừ đi Điểm phạt do vi phạm quy chế hoặc quá thời gian quy định.
   - Thang điểm: Vòng 1 tối đa 50 điểm (45 điểm nội dung + 5 điểm hình thức), thời gian 15 phút. Vòng 3 tối đa 30 điểm (25 điểm nội dung + 5 điểm hình thức), thời gian suy nghĩ 2 phút + trả lời 5 phút.
   - Trừ điểm thời gian (Điều 19): Quá từ 01s đến 30s trừ 0.5 điểm; quá từ 31s đến 60s trừ 1.0 điểm; quá trên 60s trừ 2.0 điểm (hỗ trợ nhập số giây quá giờ và tính tự động bởi Giám khảo tổng tại cổng Ban Giám khảo `judge.html`).
   - Xử lý vi phạm (Điều 20): Trừ 2.0 điểm nếu dùng tài liệu không được phép; hủy kết quả phần thi (0 điểm) nếu có hành vi gian lận.
   - Các giám khảo chưa bấm gửi điểm sẽ tự động bị loại khỏi mẫu số tính trung bình.
   - Khi có các đội bằng điểm nhau ở Vòng 1 hoặc Vòng 3: Đội có điểm trung bình phần **Nội dung** cao hơn sẽ được xếp trên.

2. **Vòng 2 (Trắc nghiệm tương tác - Điều 15 & Điều 21.2.b)**:
   - Mỗi câu trả lời đúng trong thời gian quy định (mặc định 30 giây) nhận điểm cố định (mặc định 2 điểm/câu, cấu hình qua `round2_points_per_correct`).
   - Trả lời sai, quá thời gian quy định hoặc không trả lời nhận 0 điểm.
   - Tổng điểm Vòng 2 là tổng điểm của các câu trả lời đúng (tối đa 20 điểm với bộ đề 10 câu).
   - **Thống kê & Xếp hạng Vòng 2 (Điều 21.2.b)**: Bảng thống kê xếp hạng Vòng 2 được sắp xếp theo các tiêu chí ưu tiên:
     1. Điểm số Vòng 2 cao hơn (nhiều câu đúng hơn xếp trên).
     2. Số lần đưa ra câu trả lời đúng nhanh nhất nhiều hơn (`fastestCount` cao hơn xếp trên).
     3. Tổng thời gian trả lời của các câu trả lời đúng ngắn hơn (trả lời đúng nhanh hơn xếp trên).
     4. Thứ tự đội thi / bốc thăm ban đầu.
   - Bảng thống kê hiển thị sau khi MC công bố đáp án và có thể mở lại bất cứ lúc nào qua nút "📊 Thống kê Vòng 2" trên màn hình `round2.html` (hiển thị thời gian phản hồi theo giây bên cạnh điểm số), đồng thời xuất hiện trên bảng xếp hạng `leaderboard.html` (tab Vòng 2) và trong file báo cáo CSV xuất ra.

3. **Bảng tổng sắp toàn đoàn (Điều 22)**:
   - Tổng điểm = Điểm Vòng 1 + Điểm Vòng 2 + Điểm Vòng 3.
   - Giải quyết hòa điểm: Nếu hai hoặc nhiều đội bằng tổng điểm, thứ tự ưu tiên phân định thứ hạng lần lượt là:
     1. Thứ hạng ở **Vòng 1** tốt hơn.
     2. Thứ hạng ở **Vòng 3** tốt hơn.
     3. Thứ hạng ở **Vòng 2** tốt hơn.

4. **Xuất báo cáo kết quả cuộc thi**:
   - Trong trang **Cấu hình nội dung (`content.html`)** (tab Cài đặt chung) hoặc **Bảng xếp hạng (`leaderboard.html`)**, bấm **"⬇ Tải báo cáo kết quả (CSV)"** để tải về file báo cáo đầy đủ chuẩn UTF-8 BOM, mở trực tiếp bằng Microsoft Excel hiển thị tiếng Việt hoàn hảo không lỗi font.
   - Báo cáo gồm:
     1. **Bảng tổng hợp kết quả điểm các vòng thi**: Thứ hạng, Mã đội, Tên đội, Điểm từng vòng (chi tiết nội dung, hình thức, điểm phạt) và Tổng điểm.
     2. **Bảng thống kê Vòng 2 (Trắc nghiệm)**: Thứ hạng, Mã đội, Tên đội, Điểm số, Số câu đúng, Tổng thời gian câu đúng (giây).
     3. **Chi tiết đáp án Vòng 2**: Từng lượt chọn, kết quả đúng/sai, thời gian trả lời chi tiết từng câu của từng đội.

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

## 7. Chạy Kiểm Thử Tự Động

Kiểm tra toàn bộ các bài kiểm thử logic (không phụ thuộc DOM hay mạng):
```bash
npm test
```
