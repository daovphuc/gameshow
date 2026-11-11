// Default configuration, constants, and colour palettes.

export const DEFAULT_PASSWORD_SHA256 =
  "2e696ebeea42795bc212e5bae856a9854206e2099d0762231eb4271774037239";

export const CONTENT_TABS = ["teams", "round1", "round2", "round3", "judges", "accounts", "config", "clusters"];
export const SHEET_TABS = CONTENT_TABS;

export const DEFAULT_CONFIG = {
  show_title: "Hội thi cán bộ tuyên truyền, kiểm tra giỏi về PCCC và CNCH",
  show_subtitle: "Hội thi nghiệp vụ PCCC và CNCH toàn quốc",
  round1_name: "Phần thi thứ nhất: Tuyên truyền về PCCC và CNCH",
  round1_description:
    "Mỗi đội lựa chọn 1 trong 2 cơ sở/chủ đề và thuyết trình tuyên truyền (tối đa 15 phút).",
  round1_rules: `THỂ LỆ PHẦN THI THỨ NHẤT: TUYÊN TRUYỀN VỀ PCCC VÀ CNCH

1. Trình tự thi đấu (Điều 16):
- Các đội thi lần lượt lên sân khấu theo thứ tự đã bốc thăm.
- Mỗi đội chuẩn bị 02 bài tuyên truyền đối với 02 cơ sở do PC07 quản lý; khi đội lên sân khấu, MC bấm chọn chủ đề, nội dung tuyên truyền và thông báo bắt đầu tính giờ.
- Thời gian chuẩn bị: Tối đa 05 phút.
- Thời gian thực hiện phần thi thuyết trình: Tối đa 15 phút.

2. Thang điểm và cách tính điểm (Điều 15, Điều 21.1):
- Thang điểm tối đa: 50 điểm, bao gồm 45 điểm nội dung tuyên truyền và 05 điểm phong thái tuyên truyền.
- Điểm của đội là điểm trung bình cộng của các thành viên Ban Giám khảo.

3. Quy định trừ điểm thời gian (Điều 19.1):
- Thuyết trình vượt quá thời gian quy định từ 30 giây đến 60 giây: Trừ 0,5 điểm.
- Vượt quá từ 61 giây đến 120 giây: Trừ 01 điểm.
- Vượt quá từ 121 giây đến 180 giây: Trừ 03 điểm.

4. Trường hợp không tính kết quả thi (Điều 20.1):
- Thí sinh thuyết trình vượt quá thời gian quy định trên 180 giây (trên 3 phút) sẽ không được tính kết quả phần thi này.

5. Xếp hạng và phân định thứ bậc (Điều 21.1):
- Xếp hạng theo điểm từ cao xuống thấp.
- Trường hợp các đội bằng điểm nhau: Đội có điểm nội dung tuyên truyền cao hơn xếp trên; nếu điểm nội dung và phong thái bằng nhau, Ban Giám khảo sẽ phân định bằng câu hỏi phụ (không quá 03 câu).`,
  round2_name: "Phần thi thứ hai: Kiến thức pháp luật về công tác tuyên truyền, xây dựng phong trào toàn dân tham gia PCCC và CNCH, kiểm tra về PCCC",
  round2_description:
    "10 câu hỏi trắc nghiệm A/B/C/D trên thiết bị iPad; mỗi câu đúng được 2 điểm; tính điểm chính xác và tốc độ trả lời.",
  round2_rules: `THỂ LỆ PHẦN THI THỨ HAI: KIẾN THỨC PHÁP LUẬT VỀ CÔNG TÁC TUYÊN TRUYỀN, XÂY DỰNG PHONG TRÀO TOÀN DÂN THAM GIA PCCC VÀ CNCH, KIỂM TRA VỀ PCCC

1. Trình tự thi đấu và thiết bị (Điều 17):
- Các đội tập trung tại các bục trên sân khấu theo số thứ tự đã bốc thăm; mỗi đội gồm 03 thí sinh chính thức, sử dụng 01 thiết bị iPad và 01 tài khoản đăng nhập do Ban Tổ chức cấp.
- MC bấm chọn bộ đề (mỗi bộ đề 10 câu hỏi, mỗi câu 04 phương án, 01 đáp án đúng) và thông báo số bộ đề.
- MC đọc từng câu hỏi; sau khi đọc xong, hệ thống bắt đầu tính giờ đếm ngược.
- Thời gian trả lời cho mỗi câu hỏi là 30 giây.
- Hết 30 giây, hệ thống tự động khóa nhận đáp án, ghi nhận phương án lựa chọn và thời gian trả lời của từng đội, đồng thời công bố đáp án đúng trên màn hình LED.

2. Thang điểm và cách tính điểm (Điều 15.4b, Điều 21.2a):
- Mỗi câu trả lời đúng được 02 điểm. Trả lời sai, không trả lời hoặc trả lời quá giờ được 0 điểm.
- Điểm tối đa của phần thi là 20 điểm. Điểm của đội là tổng điểm của các câu trả lời đúng.

3. Phân định thứ bậc khi bằng điểm (Điều 21.2b):
- Xếp hạng theo tổng điểm từ cao xuống thấp.
- Trường hợp các đội bằng điểm nhau: Đội có nhiều câu trả lời đúng nhanh nhất xếp trên.
- Nếu số câu trả lời nhanh nhất vẫn bằng nhau: Đội có tổng thời gian trả lời các câu đúng ngắn hơn xếp trên.`,
  round3_name: "Phần thi thứ ba: Xử lý tình huống truyền thông về PCCC và CNCH",
  round3_description:
    "15 ô tình huống thực tế về PCCC và CNCH (2 phút chuẩn bị + 5 phút trả lời).",
  round3_rules: `THỂ LỆ PHẦN THI THỨ BA: XỬ LÝ TÌNH HUỐNG TRUYỀN THÔNG VỀ PCCC VÀ CNCH

1. Trình tự thi đấu (Điều 18):
- Thí sinh đại diện mỗi đội lần lượt lên sân khấu theo thứ tự bốc thăm.
- MC bấm chọn câu hỏi tình huống, đọc câu hỏi và thông báo bắt đầu tính thời gian.
- Thời gian chuẩn bị: Tối đa 02 phút.
- Thời gian trả lời: Tối đa 05 phút.

2. Thang điểm và cách tính điểm (Điều 15.4c, Điều 21.3a):
- Thang điểm tối đa: 30 điểm, bao gồm 25 điểm nội dung trả lời và 05 điểm cộng phong thái.
- Điểm của đội là điểm trung bình cộng của các thành viên Ban Giám khảo.

3. Quy định trừ điểm thời gian (Điều 19.2):
- Trả lời vượt quá thời gian quy định từ 15 giây đến 30 giây: Trừ 0,5 điểm.
- Vượt quá từ 31 giây đến 60 giây: Trừ 01 điểm.
- Vượt quá từ 61 giây đến 90 giây: Trừ 02 điểm.

4. Trường hợp không tính kết quả thi (Điều 20.2):
- Thí sinh trả lời vượt quá thời gian quy định trên 90 giây sẽ không được tính kết quả phần thi này.

5. Xếp hạng và phân định thứ bậc (Điều 21.3b):
- Xếp hạng theo điểm từ cao xuống thấp.
- Trường hợp các đội bằng điểm nhau: Đội có điểm nội dung cao hơn xếp trên; nếu cả điểm nội dung và phong thái bằng nhau, Ban Giám khảo phân định bằng câu hỏi phụ (không quá 03 câu).`,
  round1_time_seconds: 900,
  round1_default_points: 50,
  round1_max_content: 45,
  round1_max_manner: 5,
  round1_packages_offered: 2,
  round2_time_seconds: 30,
  round2_points_per_correct: 2,
  round3_time_seconds: 420,
  round3_default_points: 30,
  round3_max_content: 25,
  round3_max_manner: 5,
  warning_seconds: 5
};

export const TEAM_PALETTE = [
  "#D97757",
  "#2E7D4F",
  "#3B6E8C",
  "#8C5A3B",
  "#9E3E50",
  "#5D6B38",
  "#2D7B74",
  "#B86B28",
  "#6A4C8C",
  "#B5483A",
  "#3A6680",
  "#7A6334",
  "#4E7A58",
  "#A65638"
];

export const PRESET_TEAM_NAMES = [
  "Công an TP. Hà Nội",
  "Công an TP. Hải Phòng",
  "Công an TP. Huế",
  "Công an TP. Đà Nẵng",
  "Công an TP. Hồ Chí Minh",
  "Công an TP. Cần Thơ",
  "Công an tỉnh Lai Châu",
  "Công an tỉnh Điện Biên",
  "Công an tỉnh Sơn La",
  "Công an tỉnh Lào Cai",
  "Công an tỉnh Tuyên Quang",
  "Công an tỉnh Cao Bằng",
  "Công an tỉnh Lạng Sơn",
  "Công an tỉnh Thái Nguyên",
  "Công an tỉnh Phú Thọ",
  "Công an tỉnh Bắc Ninh",
  "Công an tỉnh Quảng Ninh",
  "Công an tỉnh Hưng Yên",
  "Công an tỉnh Ninh Bình",
  "Công an tỉnh Thanh Hóa",
  "Công an tỉnh Nghệ An",
  "Công an tỉnh Hà Tĩnh",
  "Công an tỉnh Quảng Trị",
  "Công an tỉnh Quảng Ngãi",
  "Công an tỉnh Gia Lai",
  "Công an tỉnh Đắk Lắk",
  "Công an tỉnh Khánh Hòa",
  "Công an tỉnh Lâm Đồng",
  "Công an tỉnh Đồng Nai",
  "Công an tỉnh Tây Ninh",
  "Công an tỉnh Đồng Tháp",
  "Công an tỉnh Vĩnh Long",
  "Công an tỉnh An Giang",
  "Công an tỉnh Cà Mau",
  "Học viện PCCC và CNCH (T06)"
];
