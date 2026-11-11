# Hội thi cán bộ tuyên truyền, kiểm tra giỏi về PCCC và CNCH

Trang trình chiếu hội thi chạy trên GitHub Pages, đồng bộ trực tiếp qua Firebase Realtime Database (gói miễn phí Spark). Không có máy chủ riêng, không cần khóa bí mật.

> Câu hỏi thật và mật khẩu thật **không bao giờ** đưa lên kho mã này. Chúng được nhập trên trang `content.html` và lưu trong Firebase. Dữ liệu trong `data/sample/` chỉ là dữ liệu mẫu để chạy thử.

## Các cổng

| Cổng | Trang | Thiết bị | Vai trò |
|---|---|---|---|
| Dẫn chương trình (MC) | `host.html`, `round1-3.html`, `leaderboard.html`, `content.html` | Máy chiếu | `host` |
| Giám khảo | `judge.html` | iPad | `head_judge`, `judge` |
| Đội thi | `team.html` | iPad mỗi đội | `team` |

Quyền đọc/ghi do `firebase/database.rules.json` quyết định: chỉ MC sửa nội dung; đội chỉ đọc danh sách đội, cấu hình và đáp án của chính mình, không đọc được ngân hàng câu hỏi.

## Thiết lập Firebase

1. Tạo dự án tại <https://console.firebase.google.com>.
2. **Authentication** → Sign-in method → bật **Email/Password**.
3. **Realtime Database** → tạo cơ sở dữ liệu (chế độ khóa).
4. Tab **Rules** → dán toàn bộ `firebase/database.rules.json` → Publish. Mỗi lần tệp này thay đổi phải dán lại.
5. Project settings → thêm Web app → chép cấu hình vào `js/firebase-config.js` (các giá trị này là định danh công khai, được phép commit).
6. Mở trang, đăng nhập cổng MC lần đầu: tài khoản đầu tiên khi chưa có vai trò nào sẽ nhận vai trò `host`.

Tên đăng nhập `abc` tương ứng email `abc@hoithi.local` trong Firebase Authentication.

## Nội dung và tài khoản

Trên `content.html` (chỉ MC):

- Các tab Đội thi, Phần 1, Phần 2, Phần 3, Giám khảo, Cấu hình (kể cả thể lệ từng phần), Cụm thi.
- Tab Tài khoản: tạo từng tài khoản hoặc nhập CSV `username,password,role,ref_id,display_name`. Mật khẩu chỉ gửi tới Firebase Authentication, không lưu vào cơ sở dữ liệu.
- Mỗi tài khoản dùng mật khẩu riêng, khó đoán; mỗi người có thể đổi mật khẩu bằng nút "Đổi mật khẩu".

## Chế độ thử trên 1 máy

Để trống `databaseURL` trong `js/firebase-config.js`: trang chạy bằng bộ nhớ trình duyệt, đồng bộ giữa các tab trên cùng máy, dùng tài khoản trong `data/sample/accounts.csv`.

## Kiểm thử

```bash
npm test
```

Không có thư viện ngoài, không cần `npm install`. Đối chiếu Điều lệ: `docs/doi-chieu-dieu-le.md`.
