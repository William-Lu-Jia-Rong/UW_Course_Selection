import type { Course } from "./types";

interface Keyword {
  re: RegExp;
  label: string;
}

export interface Career {
  id: string;
  label: string;
  blurb: string;
  /** Courses that define the direction (technical electives, mostly). */
  core: string[];
  keywords: Keyword[];
  /** Subjects worth preferring for complementary-studies / science picks. */
  subjects?: Record<string, number>;
}

const kw = (re: RegExp, label: string): Keyword => ({ re, label });

export const CAREERS: Career[] = [
  {
    id: "software",
    label: "软件开发 / 后端系统",
    blurb: "大厂 SWE、后端、基础架构、分布式系统",
    core: ["ECE351", "ECE356", "ECE358", "ECE406", "ECE451", "ECE452", "ECE453", "ECE454", "ECE458", "ECE459", "CS442", "CS448", "CS349"],
    keywords: [
      kw(/software/i, "软件工程"),
      kw(/database/i, "数据库"),
      kw(/distributed|cloud computing/i, "分布式"),
      kw(/compiler|programming language/i, "编译器/语言"),
      kw(/operating system|concurren/i, "操作系统/并发"),
      kw(/algorithm/i, "算法"),
      kw(/performance|parallel/i, "性能"),
    ],
  },
  {
    id: "ai",
    label: "人工智能 / 机器学习",
    blurb: "ML 工程师、AI 研究、计算机视觉、数据科学",
    core: [
      "ECE457A", "ECE457B", "ECE457C", "ECE457D", "ECE417", "CS480", "CS484", "CS485", "CS486",
      "MSE446", "MSE546", "SYDE522", "BME522", "SYDE572", "SYDE575", "STAT441", "STAT444", "STAT341",
    ],
    keywords: [
      kw(/machine learning|statistical learning/i, "机器学习"),
      kw(/artificial intelligence|intelligent/i, "人工智能"),
      kw(/neural|deep learning/i, "神经网络"),
      kw(/reinforcement/i, "强化学习"),
      kw(/computer vision|computational vision|image processing|pattern recognition/i, "视觉/模式识别"),
      kw(/optimization/i, "优化"),
      kw(/cogniti|\bmind\b|consciousness/i, "认知/心智"),
    ],
    subjects: { PSYCH: 1, PHIL: 1, STAT: 1 },
  },
  {
    id: "hardware",
    label: "芯片 / 数字硬件",
    blurb: "数字 IC、FPGA、计算机体系结构、半导体",
    core: ["ECE320", "ECE331", "ECE423", "ECE432", "ECE433", "ECE444", "ECE445", "ECE340", "ECE477", "NE345", "ECE459"],
    keywords: [
      kw(/VLSI|integrated (digital |analog )?(circuit|electronic|device)/i, "集成电路"),
      kw(/computer architecture|microarchitecture|processor/i, "体系结构"),
      kw(/semiconductor|CMOS|transistor/i, "半导体"),
      kw(/fabrication|micro.?(and )?nano/i, "工艺/微纳"),
      kw(/FPGA|digital (hardware|logic|circuit|electronic)|hardware description/i, "数字设计"),
      kw(/quantum|solid.state|electron/i, "器件物理"),
    ],
    subjects: { PHYS: 2, NE: 1 },
  },
  {
    id: "embedded",
    label: "嵌入式 / 机器人 / 自动驾驶",
    blurb: "嵌入式软件、实时系统、控制、机器人、汽车电子",
    core: ["ECE423", "ECE455", "ECE481", "ECE486", "ECE487", "ECE488", "ECE495", "CS452", "ME547", "MTE544"],
    keywords: [
      kw(/embedded/i, "嵌入式"),
      kw(/real.time/i, "实时系统"),
      kw(/robot/i, "机器人"),
      kw(/autonomous|vehicle/i, "自动驾驶"),
      kw(/control system|feedback control|\bcontrol theory|controller/i, "控制"),
      kw(/sensor|mechatronic|kinematic/i, "传感/机电"),
    ],
    subjects: { PHYS: 1 },
  },
  {
    id: "networks",
    label: "网络 / 通信 / 信息安全",
    blurb: "网络工程、无线通信、安全工程、密码学",
    core: ["ECE358", "ECE409", "ECE414", "ECE416", "ECE458", "ECE454", "ECE474", "ECE313"],
    keywords: [
      kw(/computer network|networking|\binternet\b|protocol/i, "计算机网络"),
      kw(/wireless|radio/i, "无线通信"),
      kw(/security|cryptograph|privacy/i, "安全/密码"),
      kw(/communication system|signal processing/i, "通信/信号"),
      kw(/surveillance|cyber/i, "网络社会"),
    ],
    subjects: { LS: 1 },
  },
  {
    id: "quant",
    label: "量化 / 金融科技 / 数据分析",
    blurb: "量化交易、风控、金融工程、运筹优化",
    core: ["ACTSC446", "CO250", "CO342", "CO456", "CO463", "CO466", "STAT340", "STAT341", "STAT440", "STAT441", "STAT444", "MSE331", "MSE431", "MSE435", "MSE452", "ECE406", "ECE407"],
    keywords: [
      kw(/financ|investment|portfolio/i, "金融"),
      kw(/stochastic|probabilit/i, "随机/概率"),
      kw(/optimization/i, "优化"),
      kw(/statistic|regression|inference/i, "统计"),
      kw(/game theor|decision/i, "博弈/决策"),
      kw(/econom|market/i, "经济/市场"),
    ],
    subjects: { ECON: 3, AFM: 2, ACTSC: 2, STAT: 1 },
  },
  {
    id: "product",
    label: "产品 / 创业 / 人机交互",
    blurb: "产品经理、创业、UX、技术管理",
    core: ["ECE451", "ECE452", "CS349", "SYDE542", "MSE432", "MSE541", "ECE487"],
    keywords: [
      kw(/user interface|interface design|human.computer|user experience/i, "交互/UX"),
      kw(/requirement|product/i, "产品"),
      kw(/entrepreneur|venture|startup/i, "创业"),
      kw(/leadership|negotiat|management|marketing|sales/i, "商业/管理"),
      kw(/design thinking|innovation/i, "创新"),
    ],
    subjects: { BET: 4, ECON: 1, PSYCH: 1 },
  },
  {
    id: "power",
    label: "电力 / 能源 / 可持续",
    blurb: "智能电网、电力电子、新能源、电动车",
    core: ["ECE360", "ECE462", "ECE463", "ECE464", "ECE467", "ECE260", "ME459", "ECE331"],
    keywords: [
      kw(/power (system|electronic|engineering|grid)|electric power|smart grid/i, "电力系统"),
      kw(/energy|renewable|battery/i, "能源"),
      kw(/converter|high voltage|distribution system/i, "电力电子"),
      kw(/climate|sustainab|environment/i, "可持续"),
    ],
    subjects: { ERS: 2, ENVS: 2, EARTH: 1 },
  },
  {
    id: "biomed",
    label: "医疗科技 / 生物医学",
    blurb: "医疗设备、生物信号、计算神经科学",
    core: ["BME581", "SYDE544", "SYDE552", "SYDE556", "ECE417", "SYDE575"],
    keywords: [
      kw(/biomedical|medical|medicine|clinical/i, "医疗"),
      kw(/neuro|brain/i, "神经科学"),
      kw(/physiolog|biolog|genetic/i, "生物"),
      kw(/ultrasound|imaging|biosignal/i, "医学成像/信号"),
    ],
    subjects: { BIOL: 2, KIN: 1, HLTH: 1 },
  },
];

export const CAREER_BY_ID = new Map(CAREERS.map((c) => [c.id, c]));

export interface CareerMatch {
  score: number;
  why: string[];
}

const TITLE_WEIGHT = 3;
const DESC_WEIGHT = 1;
const KEYWORD_CAP = 6;
const CORE_BONUS = 6;

/** How well a course fits the chosen directions; `twins` are cross-listed codes of the course. */
export function careerMatch(course: Course, careers: Career[], twins: string[] = []): CareerMatch {
  let score = 0;
  const why: string[] = [];
  const codes = [course.code, ...twins];
  for (const career of careers) {
    if (codes.some((c) => career.core.includes(c))) {
      score += CORE_BONUS;
      why.push(`${career.label.split(" / ")[0]}方向核心课`);
    }
    let kwScore = 0;
    for (const k of career.keywords) {
      const w = k.re.test(course.title) ? TITLE_WEIGHT : k.re.test(course.desc) ? DESC_WEIGHT : 0;
      if (!w) continue;
      kwScore += w;
      if (!why.includes(k.label)) why.push(k.label);
    }
    score += Math.min(kwScore, KEYWORD_CAP);
    score += career.subjects?.[course.subject] ?? 0;
  }
  return { score, why };
}
