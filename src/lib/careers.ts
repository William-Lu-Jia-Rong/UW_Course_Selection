import type { Text } from "./i18n";
import type { Course } from "./types";

interface Keyword {
  re: RegExp;
  label: Text;
}

export interface Career {
  id: string;
  label: Text;
  blurb: Text;
  /** Courses that define the direction (technical electives, mostly). */
  core: string[];
  keywords: Keyword[];
  /** Subjects worth preferring for complementary-studies / science picks. */
  subjects?: Record<string, number>;
}

const kw = (re: RegExp, en: string, zh: string): Keyword => ({ re, label: { en, zh } });

export const CAREERS: Career[] = [
  {
    id: "software",
    label: { en: "Software / Backend Systems", zh: "软件开发 / 后端系统" },
    blurb: { en: "Big-tech SWE, backend, infrastructure, distributed systems", zh: "大厂 SWE、后端、基础架构、分布式系统" },
    core: ["ECE351", "ECE356", "ECE358", "ECE406", "ECE451", "ECE452", "ECE453", "ECE454", "ECE458", "ECE459", "CS442", "CS448", "CS349"],
    keywords: [
      kw(/software/i, "Software engineering", "软件工程"),
      kw(/database/i, "Databases", "数据库"),
      kw(/distributed|cloud computing/i, "Distributed systems", "分布式"),
      kw(/compiler|programming language/i, "Compilers / languages", "编译器/语言"),
      kw(/operating system|concurren/i, "OS / concurrency", "操作系统/并发"),
      kw(/algorithm/i, "Algorithms", "算法"),
      kw(/performance|parallel/i, "Performance", "性能"),
    ],
  },
  {
    id: "ai",
    label: { en: "AI / Machine Learning", zh: "人工智能 / 机器学习" },
    blurb: { en: "ML engineer, AI research, computer vision, data science", zh: "ML 工程师、AI 研究、计算机视觉、数据科学" },
    core: [
      "ECE457A", "ECE457B", "ECE457C", "ECE457D", "ECE417", "CS480", "CS484", "CS485", "CS486",
      "MSE446", "MSE546", "SYDE522", "BME522", "SYDE572", "SYDE575", "STAT441", "STAT444", "STAT341",
    ],
    keywords: [
      kw(/machine learning|statistical learning/i, "Machine learning", "机器学习"),
      kw(/artificial intelligence|intelligent/i, "AI", "人工智能"),
      kw(/neural|deep learning/i, "Neural networks", "神经网络"),
      kw(/reinforcement/i, "Reinforcement learning", "强化学习"),
      kw(/computer vision|computational vision|image processing|pattern recognition/i, "Vision / pattern recognition", "视觉/模式识别"),
      kw(/optimization/i, "Optimization", "优化"),
      kw(/cogniti|\bmind\b|consciousness/i, "Cognition / mind", "认知/心智"),
    ],
    subjects: { PSYCH: 1, PHIL: 1, STAT: 1 },
  },
  {
    id: "hardware",
    label: { en: "Chips / Digital Hardware", zh: "芯片 / 数字硬件" },
    blurb: { en: "Digital IC, FPGA, computer architecture, semiconductors", zh: "数字 IC、FPGA、计算机体系结构、半导体" },
    core: ["ECE320", "ECE331", "ECE423", "ECE432", "ECE433", "ECE444", "ECE445", "ECE340", "ECE477", "NE345", "ECE459"],
    keywords: [
      kw(/VLSI|integrated (digital |analog )?(circuit|electronic|device)/i, "Integrated circuits", "集成电路"),
      kw(/computer architecture|microarchitecture|processor/i, "Architecture", "体系结构"),
      kw(/semiconductor|CMOS|transistor/i, "Semiconductors", "半导体"),
      kw(/fabrication|micro.?(and )?nano/i, "Fabrication / micro-nano", "工艺/微纳"),
      kw(/FPGA|digital (hardware|logic|circuit|electronic)|hardware description/i, "Digital design", "数字设计"),
      kw(/quantum|solid.state|electron/i, "Device physics", "器件物理"),
    ],
    subjects: { PHYS: 2, NE: 1 },
  },
  {
    id: "embedded",
    label: { en: "Embedded / Robotics / Autonomous Driving", zh: "嵌入式 / 机器人 / 自动驾驶" },
    blurb: { en: "Embedded software, real-time systems, controls, robotics, automotive", zh: "嵌入式软件、实时系统、控制、机器人、汽车电子" },
    core: ["ECE423", "ECE455", "ECE481", "ECE486", "ECE487", "ECE488", "ECE495", "CS452", "ME547", "MTE544"],
    keywords: [
      kw(/embedded/i, "Embedded", "嵌入式"),
      kw(/real.time/i, "Real-time systems", "实时系统"),
      kw(/robot/i, "Robotics", "机器人"),
      kw(/autonomous|vehicle/i, "Autonomous driving", "自动驾驶"),
      kw(/control system|feedback control|\bcontrol theory|controller/i, "Controls", "控制"),
      kw(/sensor|mechatronic|kinematic/i, "Sensing / mechatronics", "传感/机电"),
    ],
    subjects: { PHYS: 1 },
  },
  {
    id: "networks",
    label: { en: "Networking / Communications / Security", zh: "网络 / 通信 / 信息安全" },
    blurb: { en: "Network engineering, wireless, security engineering, cryptography", zh: "网络工程、无线通信、安全工程、密码学" },
    core: ["ECE358", "ECE409", "ECE414", "ECE416", "ECE458", "ECE454", "ECE474", "ECE313"],
    keywords: [
      kw(/computer network|networking|\binternet\b|protocol/i, "Computer networks", "计算机网络"),
      kw(/wireless|radio/i, "Wireless", "无线通信"),
      kw(/security|cryptograph|privacy/i, "Security / crypto", "安全/密码"),
      kw(/communication system|signal processing/i, "Comms / signals", "通信/信号"),
      kw(/surveillance|cyber/i, "Cyber society", "网络社会"),
    ],
    subjects: { LS: 1 },
  },
  {
    id: "quant",
    label: { en: "Quant / FinTech / Data Analytics", zh: "量化 / 金融科技 / 数据分析" },
    blurb: { en: "Quant trading, risk, financial engineering, operations research", zh: "量化交易、风控、金融工程、运筹优化" },
    core: ["ACTSC446", "CO250", "CO342", "CO456", "CO463", "CO466", "STAT340", "STAT341", "STAT440", "STAT441", "STAT444", "MSE331", "MSE431", "MSE435", "MSE452", "ECE406", "ECE407"],
    keywords: [
      kw(/financ|investment|portfolio/i, "Finance", "金融"),
      kw(/stochastic|probabilit/i, "Stochastics / probability", "随机/概率"),
      kw(/optimization/i, "Optimization", "优化"),
      kw(/statistic|regression|inference/i, "Statistics", "统计"),
      kw(/game theor|decision/i, "Game theory / decisions", "博弈/决策"),
      kw(/econom|market/i, "Economics / markets", "经济/市场"),
    ],
    subjects: { ECON: 3, AFM: 2, ACTSC: 2, STAT: 1 },
  },
  {
    id: "product",
    label: { en: "Product / Startups / HCI", zh: "产品 / 创业 / 人机交互" },
    blurb: { en: "Product management, startups, UX, technical leadership", zh: "产品经理、创业、UX、技术管理" },
    core: ["ECE451", "ECE452", "CS349", "SYDE542", "MSE432", "MSE541", "ECE487"],
    keywords: [
      kw(/user interface|interface design|human.computer|user experience/i, "Interaction / UX", "交互/UX"),
      kw(/requirement|product/i, "Product", "产品"),
      kw(/entrepreneur|venture|startup/i, "Entrepreneurship", "创业"),
      kw(/leadership|negotiat|management|marketing|sales/i, "Business / management", "商业/管理"),
      kw(/design thinking|innovation/i, "Innovation", "创新"),
    ],
    subjects: { BET: 4, ECON: 1, PSYCH: 1 },
  },
  {
    id: "power",
    label: { en: "Power / Energy / Sustainability", zh: "电力 / 能源 / 可持续" },
    blurb: { en: "Smart grids, power electronics, renewables, electric vehicles", zh: "智能电网、电力电子、新能源、电动车" },
    core: ["ECE360", "ECE462", "ECE463", "ECE464", "ECE467", "ECE260", "ME459", "ECE331"],
    keywords: [
      kw(/power (system|electronic|engineering|grid)|electric power|smart grid/i, "Power systems", "电力系统"),
      kw(/energy|renewable|battery/i, "Energy", "能源"),
      kw(/converter|high voltage|distribution system/i, "Power electronics", "电力电子"),
      kw(/climate|sustainab|environment/i, "Sustainability", "可持续"),
    ],
    subjects: { ERS: 2, ENVS: 2, EARTH: 1 },
  },
  {
    id: "biomed",
    label: { en: "MedTech / Biomedical", zh: "医疗科技 / 生物医学" },
    blurb: { en: "Medical devices, biosignals, computational neuroscience", zh: "医疗设备、生物信号、计算神经科学" },
    core: ["BME581", "SYDE544", "SYDE552", "SYDE556", "ECE417", "SYDE575"],
    keywords: [
      kw(/biomedical|medical|medicine|clinical/i, "Medical", "医疗"),
      kw(/neuro|brain/i, "Neuroscience", "神经科学"),
      kw(/physiolog|biolog|genetic/i, "Biology", "生物"),
      kw(/ultrasound|imaging|biosignal/i, "Medical imaging / signals", "医学成像/信号"),
    ],
    subjects: { BIOL: 2, KIN: 1, HLTH: 1 },
  },
];

export const CAREER_BY_ID = new Map(CAREERS.map((c) => [c.id, c]));

export interface CareerMatch {
  score: number;
  why: Text[];
}

const TITLE_WEIGHT = 3;
const DESC_WEIGHT = 1;
const KEYWORD_CAP = 6;
const CORE_BONUS = 6;

/** How well a course fits the chosen directions; `twins` are cross-listed codes of the course. */
export function careerMatch(course: Course, careers: Career[], twins: string[] = []): CareerMatch {
  let score = 0;
  const why: Text[] = [];
  const add = (t: Text) => !why.some((w) => w.en === t.en) && why.push(t);
  const codes = [course.code, ...twins];
  for (const career of careers) {
    if (codes.some((c) => career.core.includes(c))) {
      score += CORE_BONUS;
      add({ en: `${career.label.en.split(" / ")[0]} core`, zh: `${career.label.zh.split(" / ")[0]}方向核心课` });
    }
    let kwScore = 0;
    for (const k of career.keywords) {
      const w = k.re.test(course.title) ? TITLE_WEIGHT : k.re.test(course.desc) ? DESC_WEIGHT : 0;
      if (!w) continue;
      kwScore += w;
      add(k.label);
    }
    score += Math.min(kwScore, KEYWORD_CAP);
    score += career.subjects?.[course.subject] ?? 0;
  }
  return { score, why };
}
