# BẢNG ĐỐI CHIẾU ĐIỀU LỆ HỘI THI VÀ TÍNH NĂNG ỨNG DỤNG

Tài liệu đối chiếu chi tiết giữa **Điều lệ Hội thi cán bộ tuyên truyền, kiểm tra giỏi trong lực lượng Cảnh sát PCCC và CNCH** (ban hành kèm theo Kế hoạch của C07) và các chức năng, quy tắc tính điểm, cấu hình đã triển khai trên phần mềm thi đấu.

---

## 1. Bảng đối chiếu từng điều khoản

| Điều / Khoản | Quy định trong Điều lệ | Triển khai trên phần mềm | Trạng thái | Ghi chú |
| :--- | :--- | :--- | :--- | :--- |
| **Điều 1** | Phạm vi điều chỉnh: Vòng loại (3 cụm) và Vòng chung kết theo Kế hoạch của C07. | Hỗ trợ chọn 3 Cụm thi (Cụm 1, Cụm 2, Cụm 3) và Vòng chung kết; danh sách đội và phụ đề cập nhật tự động. | **Khớp** | Cụm 1: 12 đội; Cụm 2: 12 đội; Cụm 3: 11 đội; Chung kết: 10 đội. |
| **Điều 2** | Nội dung thi gồm 03 phần: (1) Tuyên truyền PCCC và CNCH; (2) Kiến thức pháp luật; (3) Xử lý tình huống truyền thông. | Phần mềm thiết kế chuẩn 3 vòng thi: Vòng 1 (Tuyên truyền), Vòng 2 (Trắc nghiệm), Vòng 3 (Tình huống). | **Khớp** | Đã đồng bộ tên gọi chính xác theo Điều lệ vào cấu hình mặc định. |
| **Điều 3** | Hình thức thi: Thuyết trình, trả lời trắc nghiệm, trả lời tình huống; 2 vòng: Vòng loại và Vòng chung kết. | Hỗ trợ đầy đủ màn hình MC bốc thăm, màn hình iPad đội thi trắc nghiệm và màn hình BGK chấm điểm. | **Khớp** | Phù hợp quy trình vận hành trực tiếp. |
| **Điều 4, 5** | Đội thi tối đa 10 người (1 Trưởng đoàn, 1 Phó trưởng đoàn, 5 thí sinh chính thức cho 3 phần thi, 3 dự bị). | Phần mềm quản lý theo Đơn vị / Đội thi (doi-01 đến doi-35), cấp 01 tài khoản iPad cho mỗi đội. | **Khớp** | Việc bố trí thành viên cụ thể do Trưởng đoàn điều hành thực tế. |
| **Điều 6, 7** | Đăng ký và thay đổi thí sinh (Mẫu 01, 02, 03). | Quản lý bằng văn bản giấy ngoài đời thực; phần mềm giữ nguyên mã định danh đội. | **Do BTC quyết định** | Thủ tục hành chính của Ban Tổ chức. |
| **Điều 8, 9** | Trang phục CAND/PCCC; kỷ luật, thời gian có mặt trước 30 phút. | Quy định điều lệnh, giám sát trực tiếp tại hội trường. | **Do BTC quyết định** | Không thuộc phạm vi phần mềm. |
| **Điều 10, 11** | Ban Tổ chức (10 người), Ban Đề thi (07 người). | Ban Đề thi nhập ngân hàng câu hỏi và bộ đề thi vào hệ thống qua tab Vòng 1, Vòng 2, Vòng 3 trên trang quản trị. | **Khớp** | Đề thi được bảo mật, phân quyền quản trị (host). |
| **Điều 12.1** | Ban Giám khảo không quá 05 người; chấm điểm các phần thi, xác định kết quả. | Hệ thống hỗ trợ cấu hình danh sách Ban Giám khảo (id, họ tên), cấp tài khoản chấm điểm riêng trên iPad hoặc nhập qua Giám khảo tổng. | **Khớp** | Điểm tính trung bình cộng các giám khảo đã chấm. |
| **Điều 12.2** | Tổ Thư ký không quá 03 người; hỗ trợ bốc thăm, tổng hợp điểm, chuyển kết quả cho MC. | Hệ thống tự động tổng hợp điểm trực tiếp (Realtime Database), hiển thị bảng xếp hạng tức thời trên màn hình MC và Bảng điểm. | **Khớp** | Thư ký kiểm tra, đối chiếu phiếu giấy và hỗ trợ kỹ thuật. |
| **Điều 13.1** | Thời gian tổ chức: Vòng loại 02 ngày, Vòng chung kết 02 ngày. | Phần mềm không giới hạn thời gian mở cổng; cho phép lưu và tiếp tục giữa các ngày thi. | **Khớp** | Trạng thái lưu trên Firebase/LocalStorage. |
| **Điều 13.2** | Thứ tự thi: Phần 1 (Tuyên truyền) → Phần 2 (Kiến thức) → Phần 3 (Tình huống). | Điều hướng trên thanh bên và quy trình thi được sắp xếp chuẩn: Vòng 1 → Vòng 2 → Vòng 3 → Tổng kết. | **Khớp** | Thứ tự các vòng cố định theo Điều lệ. |
| **Điều 13.3** | Bốc thăm thứ tự thi và nội dung: Bốc thăm thứ tự buổi chiều hôm trước; MC bấm chọn ngẫu nhiên gói/đề/câu hỏi trước mỗi phần thi. | Tab "Thứ tự thi" cho phép sắp xếp danh sách đội theo kết quả bốc thăm; MC có nút "Chọn ngẫu nhiên" gói Vòng 1, bộ đề Vòng 2, câu Vòng 3. | **Khớp** | Hỗ trợ cả bốc thăm ngẫu nhiên trên phần mềm và nhập thứ tự bốc thăm bằng tay. |
| **Điều 14** | Màn hình LED, bộ đếm ngược, bục thi Vòng 2 (12 bục vòng loại, 10 bục chung kết), mỗi đội 1 iPad/thiết bị điện tử. | Giao diện máy chiếu LED đồng bộ thời gian thực; iPad đội thi kết nối theo tài khoản riêng (tự động nhận câu hỏi và gửi đáp án). | **Khớp** | Hệ thống phản hồi tức thời dưới 100ms. |
| **Điều 15.1** | Phần 1: Mỗi đội chuẩn bị 2 bài tuyên truyền đối với 2 cơ sở (thuộc 2 lĩnh vực). | Cấu hình mặc định mỗi đội có 2 gói câu hỏi/chủ đề trong cơ sở dữ liệu (`round1_packages_offered = 2`). | **Khớp** | MC bấm chọn gói khi đội lên sân khấu. |
| **Điều 15.2** | Phần 2: 10 bộ đề vòng loại, 5 bộ đề chung kết; mỗi bộ 10 câu 4 đáp án (4 Kiểm tra, 3 Tuyên truyền, 2 Xử phạt, 1 Điều tra). | Đã bổ sung 2 trường `category` và `explanation`; xây dựng "Bộ chạy thử" chuẩn 10 câu (4 Kiểm tra, 3 Tuyên truyền, 2 Xử phạt, 1 Điều tra). | **Đã sửa** | Hỗ trợ phân loại danh mục, đáp án và giải thích chi tiết. |
| **Điều 15.3** | Phần 3: 15 câu hỏi tình huống vòng loại, 15 câu hỏi chung kết. | Ngân hàng câu hỏi Vòng 3 cấu hình dạng ma trận ô số (mặc định 15 ô tình huống trong dữ liệu mẫu). | **Khớp** | Đội bốc thăm chọn ô tình huống trên màn hình. |
| **Điều 15.4.a** | Thang điểm Phần 1: Thang điểm 50 (45 điểm nội dung + 5 điểm phong thái). | Điểm tối đa nội dung: 45, phong thái: 5; tổng điểm tối đa: 50. Phiếu chấm BGK chia rõ 2 tiêu chí. | **Khớp** | Cấu hình `round1_max_content = 45`, `round1_max_manner = 5`. |
| **Điều 15.4.b** | Thang điểm Phần 2: Mỗi câu đúng 02 điểm, tổng điểm 20 điểm. | Mỗi câu đúng cộng 2 điểm, sai/quá giờ được 0 điểm. Tổng điểm tối đa 20 điểm. | **Khớp** | Cấu hình `round2_points_per_correct = 2`. |
| **Điều 15.4.c** | Thang điểm Phần 3: Thang điểm 30 (25 điểm nội dung + 5 điểm cộng phong thái). | Điểm tối đa nội dung: 25, phong thái: 5; tổng điểm tối đa: 30. | **Khớp** | Cấu hình `round3_max_content = 25`, `round3_max_manner = 5`. |
| **Điều 16** | Thời gian Phần 1: Chuẩn bị ≤ 5 phút, thuyết trình ≤ 15 phút (900 giây). | Đồng hồ đếm ngược Vòng 1 mặc định 900 giây (15 phút). | **Đã sửa** | Đã sửa giá trị mặc định trong `DEFAULT_CONFIG` từ 15 giây (thử nghiệm) thành 900 giây. |
| **Điều 17** | Thời gian Phần 2: Mỗi câu có 30 giây trả lời; hết 30 giây chiếu ngay đáp án và ghi nhận thời gian trả lời. | Đồng hồ 30 giây đếm ngược chính xác; khóa nhận bài khi hết giờ; hiển thị đáp án, giải thích và thời gian trả lời của từng đội. | **Khớp** | Cơ chế server timestamp đảm bảo tính công bằng bất kể lệch giờ client. |
| **Điều 18** | Thời gian Phần 3: Chuẩn bị ≤ 2 phút, trả lời ≤ 5 phút (tổng 7 phút = 420 giây). | Đồng hồ đếm ngược Vòng 3 cấu hình mặc định 420 giây (7 phút). | **Đã sửa** | Đã sửa giá trị mặc định trong `DEFAULT_CONFIG` từ 20 giây (thử nghiệm) thành 420 giây. |
| **Điều 19.1** | Trừ điểm quá giờ Phần 1: Quá 30s-60s trừ 0,5đ; Quá 61s-120s trừ 1,0đ; Quá 121s-180s trừ 3,0đ. | Đã bổ sung logic tính trừ điểm tự động theo Điều 19 (`calculateOvertimePenalty`) trong module logic và hỗ trợ nhập điểm trừ thủ công. | **Đã sửa** | Cho phép Giám khảo tổng / MC áp dụng mức trừ điểm trực tiếp hoặc tự động. |
| **Điều 19.2** | Trừ điểm quá giờ Phần 3: Quá 15s-30s trừ 0,5đ; Quá 31s-60s trừ 1,0đ; Quá 61s-90s trừ 2,0đ. | Đã bổ sung logic tính trừ điểm tự động theo Điều 19 (`calculateOvertimePenalty`) trong module logic và hỗ trợ nhập điểm trừ thủ công. | **Đã sửa** | Đã kiểm thử logic trừ điểm và trường hợp vi phạm thời gian. |
| **Điều 20** | Không tính kết quả thi: Phần 1 thuyết trình quá 180s; Phần 3 trả lời quá 90s. | Logic xác định trạng thái hủy kết quả (disqualified / 0 điểm) khi vượt ngưỡng tối đa theo Điều 20. | **Đã sửa** | Cảnh báo quá thời gian tối đa trên hệ thống. |
| **Điều 21.1** | Xếp hạng Phần 1: Điểm trung bình cộng BGK trừ điểm phạt. Bằng nhau: ưu tiên điểm nội dung; nếu vẫn bằng: thi câu hỏi phụ (≤ 3 câu). | Điểm trung bình cộng; tie-break ưu tiên `avgContent`. Trường hợp bằng cả nội dung và phong thái thì chia sẻ thứ hạng (chờ BTC chấm câu hỏi phụ). | **Khớp** | Đúng nguyên tắc Điều 21 khoản 1. |
| **Điều 21.2** | Xếp hạng Phần 2: Tổng điểm các câu đúng. Bằng nhau: (1) Đội có nhiều câu trả lời nhanh nhất; (2) Tổng thời gian trả lời ngắn hơn. | Đã cập nhật thuật toán xếp hạng Vòng 2: ưu tiên tổng điểm → số câu trả lời nhanh nhất (`fastestCount`) → tổng thời gian trả lời đúng (`totalCorrectTimeMs`). | **Đã sửa** | Bổ sung tiêu chí số câu trả lời nhanh nhất theo đúng quy định tại Điều 21.2.b. |
| **Điều 21.3** | Xếp hạng Phần 3: Điểm trung bình cộng BGK trừ điểm phạt. Bằng nhau: ưu tiên điểm nội dung; nếu vẫn bằng: thi câu hỏi phụ (≤ 3 câu). | Điểm trung bình cộng; tie-break ưu tiên `avgContent`. Trường hợp bằng cả nội dung và phong thái thì chia sẻ thứ hạng (chờ BTC chấm câu hỏi phụ). | **Khớp** | Đúng nguyên tắc Điều 21 khoản 3. |
| **Điều 22.1** | Thành tích chung: Tổng điểm của cả 03 phần thi từ cao xuống thấp. | Bảng tổng sắp tự động tính `total = round1 + round2 + round3` và xếp hạng từ cao xuống thấp. | **Khớp** | Cập nhật trực tiếp theo thời gian thực. |
| **Điều 22.2** | Tie-break thành tích chung: Bằng tổng điểm thì lần lượt ưu tiên: (1) Điểm Phần 1; (2) Điểm Phần 3; (3) Điểm Phần 2; (4) Câu hỏi phụ. | Thuật toán `computeLeaderboard` với tùy chọn `tieBreak: true` ưu tiên điểm Vòng 1 → Vòng 3 → Vòng 2; nếu bằng cả 3 thì cùng thứ hạng để BTC phân định. | **Đã sửa** | Chuẩn hóa thứ tự tie-break tuyệt đối theo đúng Điều 22.2 (Vòng 1 → Vòng 3 → Vòng 2). |
| **Điều 22.3** | Chọn 01 đội xếp thứ 4 có thành tích cao nhất của 3 cụm vào Vòng chung kết. | Phần mềm cho phép Host chọn thủ công 10 đội tham gia Vòng chung kết theo kết quả phê duyệt của BTC. | **Khớp** | Điều lệ quy định việc so sánh giữa 3 cụm độc lập và có sự phê duyệt của BGK/BTC. |
| **Điều 22.4** | Giải phụ cá nhân có thành tích ấn tượng. | Ban Giám khảo và Ban Tổ chức đánh giá, bình chọn ngoài phần mềm và trao giải tại lễ bế mạc. | **Do BTC quyết định** | Giải thưởng bình chọn đặc biệt. |
| **Điều 23** | Công bố kết quả phần thi và thành tích toàn đoàn trên màn hình LED. | Trang `scores.html`, `leaderboard.html` và ngăn kéo Bảng điểm trực tiếp trên màn hình MC hiển thị đầy đủ, rõ nét trên máy chiếu LED. | **Khớp** | Hiệu ứng FLIP chuyển động mượt mà khi điểm thay đổi. |
| **Điều 24** | Cơ cấu giải thưởng: Vòng loại (1 Nhất, 1 Nhì, 1 Ba, 2 Khuyến khích mỗi phần thi; Toàn đoàn: 1 Nhất, 1 Nhì, 1 Ba, 1 Khuyến khích, 5 giải phụ); Chung kết (tương tự, giải toàn đoàn có 2 Khuyến khích). | Bục vinh danh Podium hiển thị chuẩn 5 vị trí (Nhất, Nhì, Ba, Khuyến khích), báo cáo xuất file CSV phân loại xếp hạng theo cơ cấu giải. | **Khớp** | Có thể tùy biến số lượng đội nhận giải theo quyết định của BTC. |
| **Điều 25** | Kiến nghị, khiếu nại (bằng lời trong 15 phút, bằng văn bản trong 60 phút). | Tổ Thư ký và Ban Tổ chức tiếp nhận, điều chỉnh điểm số trực tiếp trên phần mềm nếu có quyết định giải quyết khiếu nại. | **Khớp** | Host/Giám khảo tổng có chức năng chỉnh sửa điểm số khi cần. |
| **Điều 26, 27** | Tổ chức thực hiện và hiệu lực thi hành. | Quy định thẩm quyền điều hành và hiệu lực của văn bản. | **Khớp** | Phục vụ điều hành chính thức. |

---

## 2. Danh mục "Cần Ban Tổ chức xác nhận"

Các nội dung chưa được quy định chi tiết trong văn bản Điều lệ hoặc cần sự thống nhất của Ban Tổ chức trước khi bấm nút khởi tranh:

1. **Quy tắc xác định đội trả lời nhanh nhất ở Phần 2 (Điều 21.2.b):**
   - *Vấn đề:* Điều lệ quy định: *"đội nào có nhiều câu hỏi trả lời nhanh nhất được xếp thành tích cao hơn"*. Cần xác nhận: Tiêu chí này tính trên **các câu trả lời đúng** hay tính trên **toàn bộ câu hỏi** (kể cả câu trả lời sai)?
   - *Khuyến nghị chuyên môn:* Chỉ nên tính thời gian của câu trả lời **đúng** (nếu trả lời nhanh nhất nhưng sai thì không được tính là thành tích trả lời nhanh). Hiện phần mềm áp dụng tính trên câu trả lời đúng.

2. **Cách chấm câu hỏi phụ khi bằng điểm tuyệt đối (Điều 21, Điều 22):**
   - *Vấn đề:* Khi các đội bằng điểm cả 3 phần thi và cần trả lời câu hỏi phụ (không quá 3 câu), hình thức chấm câu hỏi phụ là trắc nghiệm bấm chuông hay BGK giơ biển chấm điểm?
   - *Khuyến nghị chuyên môn:* Khi có câu hỏi phụ, Thư ký ghi nhận kết quả trực tiếp và Host cập nhật thứ tự thủ công trên tab "Thứ tự thi".

3. **Thời gian chuẩn bị và thời gian trả lời ở Phần 3 (Điều 18.2.b):**
   - *Vấn đề:* Điều 18 quy định *"thời gian chuẩn bị không quá 02 phút, thời gian trả lời không quá 05 phút"*.
   - *Xác nhận:* Đồng hồ đếm ngược trên sân khấu nên chạy gộp một mạch 7 phút (420 giây) hay tách làm 2 nhịp (nhịp 1: 2 phút chuẩn bị, nhịp 2: 5 phút trả lời)? Hiện phần mềm đặt mặc định 420 giây gộp.

4. **Xử lý trừ điểm thời gian tự động hay qua Giám khảo tổng (Điều 19):**
   - *Vấn đề:* Trừ điểm quá giờ do phần mềm tự động tính theo thời gian bấm dừng của MC, hay do Tổ Thư ký/Giám khảo tổng xác nhận trên biên bản giấy rồi mới nhập số điểm phạt vào hệ thống?
   - *Khuyến nghị:* Nên để Tổ Thư ký/Giám khảo tổng kiểm tra đồng hồ độc lập và nhập số điểm phạt vào ô "Điểm trừ", tránh tranh chấp do độ trễ thao tác bấm nút của người dẫn chương trình.

5. **Tên chính thức hiển thị của Học viện PCCC và CNCH (T06):**
   - *Vấn đề:* Kế hoạch ghi *"Học viện PCCC và CNCH (T06)"*, trong khi một số văn bản nội bộ gọi tắt là *"T06"*.
   - *Khuyến nghị:* Phần mềm đã chuẩn hóa tên đầy đủ là `"Học viện PCCC và CNCH (T06)"` trên toàn hệ thống và mã chữ viết tắt hiển thị trên logo đại diện là `"T06"`.

6. **Bộ đề "Chạy thử" có 2 câu chỉ có 2 phương án (Có/Không, Đúng/Sai):**
   - *Vấn đề:* Điều 15 khoản 2 quy định mỗi câu hỏi có 04 đáp án. Hai câu này giữ nguyên dạng như ngân hàng câu hỏi để chạy thử; phần mềm vẫn hiển thị và chấm đúng câu 2 phương án.
   - *Khuyến nghị:* Khi soạn bộ đề chính thức, viết lại thành 4 phương án.

7. **Câu Điều tra (câu 10 bộ "Chạy thử") và cơ cấu tổ chức mới:**
   - *Vấn đề:* Từ năm 2025 không còn Công an cấp huyện; các phương án đã được viết lại theo cơ cấu hiện hành (Công an cấp xã, Đội Chữa cháy và CNCH khu vực, PC07, Cơ quan CSĐT Công an tỉnh). Đáp án đề xuất là Công an cấp xã, cần BTC xác nhận.
