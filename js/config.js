// Default configuration, constants, and colour palettes.

export const DEFAULT_PASSWORD_SHA256 =
  "2e696ebeea42795bc212e5bae856a9854206e2099d0762231eb4271774037239";

export const CONTENT_TABS = ["teams", "round1", "round2", "round3", "judges", "accounts", "config", "clusters"];
export const SHEET_TABS = CONTENT_TABS;

export const DEFAULT_CONFIG = {
  show_title: "Hội thi cán bộ tuyên truyền, kiểm tra giỏi về PCCC và CNCH",
  show_subtitle: "Hội thi nghiệp vụ PCCC và CNCH toàn quốc",
  round1_name: "Tuyên truyền",
  round1_description:
    "Mỗi đội bốc thăm 1 chủ đề, chuẩn bị 03 phút và thuyết trình tuyên truyền (tối đa 15 phút).",
  round1_rules: `- Hình thức: Bốc thăm chọn 1 chủ đề tuyên truyền theo cơ sở do PC07 quản lý.
- Thời gian: Chuẩn bị tối đa 03 phút; thuyết trình tối đa 15 phút.
- Thang điểm: Tối đa 50 điểm (45 điểm nội dung + 05 điểm phong thái, Điều 15).
- Trừ điểm thời gian: Quá 30s-60s trừ 0,5đ; 61s-120s trừ 1đ; 121s-180s trừ 3đ; quá 180s không tính điểm.`,
  round2_name: "Kiến thức pháp luật",
  round2_description:
    "10 câu hỏi trắc nghiệm A/B/C/D trên thiết bị iPad; mỗi câu đúng được 2 điểm; tính điểm chính xác và tốc độ trả lời.",
  round2_rules: `- Hình thức: 10 câu hỏi trắc nghiệm A/B/C/D trên thiết bị iPad theo bộ đề bốc thăm (Điều 17).
- Thời gian: 30 giây/câu; MC đọc xong câu hỏi bấm Bắt đầu để tính giờ.
- Thang điểm: Mỗi câu đúng được 02 điểm (tối đa 20 điểm); sai hoặc quá giờ được 0 điểm.
- Phân định: Bằng điểm ưu tiên đội có nhiều câu đúng nhanh nhất và tổng thời gian ngắn hơn.`,
  round3_name: "Xử lý tình huống",
  round3_description:
    "15 ô tình huống thực tế về PCCC và CNCH (2 phút chuẩn bị + 5 phút trả lời).",
  round3_rules: `- Hình thức: Bốc thăm chọn 1 trong 15 ô tình huống thực tế về PCCC và CNCH (Điều 18).
- Thời gian: Chuẩn bị tối đa 02 phút; trả lời tối đa 05 phút.
- Thang điểm: Tối đa 30 điểm (25 điểm nội dung + 05 điểm phong thái).
- Trừ điểm thời gian: Quá 15s-30s trừ 0,5đ; 31s-60s trừ 1đ; 61s-90s trừ 2đ; quá 90s không tính điểm.`,
  round1_prep_time_seconds: 180,
  round1_time_seconds: 900,
  round1_default_points: 50,
  round1_max_content: 45,
  round1_max_manner: 5,
  round1_packages_offered: 3,
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
