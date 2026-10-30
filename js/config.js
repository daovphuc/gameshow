// Default configuration, constants, and colour palettes.

export const DEFAULT_PASSWORD_SHA256 =
  "2e696ebeea42795bc212e5bae856a9854206e2099d0762231eb4271774037239";

export const CONTENT_TABS = ["teams", "round1", "round2", "round3", "judges", "accounts", "config"];
export const SHEET_TABS = CONTENT_TABS;

export const DEFAULT_CONFIG = {
  show_title: "Hội thi cán bộ tuyên truyền, kiểm tra giỏi về PCCC và CNCH",
  show_subtitle: "Hội thi nghiệp vụ PCCC và CNCH toàn quốc",
  round1_name: "Phần thi thứ nhất: Tuyên truyền về PCCC và CNCH",
  round1_description:
    "Mỗi đội lựa chọn 1 trong 2 cơ sở/chủ đề và thuyết trình tuyên truyền (tối đa 15 phút).",
  round2_name: "Phần thi thứ hai: Kiến thức pháp luật, nghiệp vụ về PCCC và CNCH",
  round2_description:
    "10 câu hỏi trắc nghiệm A/B/C/D trên thiết bị iPad; tính điểm chính xác và tốc độ trả lời.",
  round3_name: "Phần thi thứ ba: Xử lý tình huống truyền thông về PCCC và CNCH",
  round3_description:
    "15 ô tình huống thực tế về PCCC và CNCH (2 phút chuẩn bị + 5 phút trả lời); Ban Giám khảo chấm điểm trên iPad.",
  round1_time_seconds: 15,
  round1_default_points: 10,
  round1_max_content: 45,
  round1_max_manner: 5,
  round1_packages_offered: 2,
  round2_time_seconds: 30,
  round2_max_points: 1000,
  round2_min_points: 500,
  round2_divisor: 500,
  round3_time_seconds: 20,
  round3_default_points: 20,
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
