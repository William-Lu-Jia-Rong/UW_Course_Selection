# UW 选课助手 · Computer Engineering

上传 Quest 导出的成绩单 PDF，自动识别修过/在修的课，对照
[Computer Engineering (BASc Honours)](https://uwaterloo.ca/academic-calendar/undergraduate-studies/catalog#/programs/BybwJ10Ri3)
和 [BASc Complementary Studies 列表](https://uwaterloo.ca/academic-calendar/undergraduate-studies/catalog#/programs/B1ligZqRn)
的要求，以及每门课的先修/同修/反修条件，算出能选哪些课，并和下学期开课列表
（[classes.uwaterloo.ca](https://classes.uwaterloo.ca/uwpcshtm.html) 或自己粘贴的列表）取交集。

## 使用

```bash
npm install
npm run dev        # http://localhost:5173
```

1. 上传 `SSR_TSRPT.pdf`（只在浏览器本地解析，数据存在 localStorage）。
2. 左侧确认「要选课的学期年级」（默认是最近一个学习学期的下一级），以及是否把在修课当作已完成。
3. 「下学期选课」：选官方开课列表（可点按钮实时重新抓取）或粘贴自定义列表，看哪些课能选。
4. 「按方向推荐」：选 1–3 个职业方向（软件、AI、芯片、嵌入式/机器人、网络安全、量化、产品创业、电力能源、医疗科技），按该学期 term-by-term 的必修和选修名额给出建议。每门选修都对应一个还没满足的 TE / NS / CSE / Ethics 要求，并给后面学期指定 List 1 / List 2 的名额留位置。方向的核心课和关键词在 `src/lib/careers.ts`，可以自己改。
5. 「所有能选的课」：不管开不开，所有对学位有用、现在满足条件的课。
6. 「毕业进度」：必修、TE（List 1–5 规则）、NS、Ethics、CSE、PD、Co-op 的完成情况。
7. 点「+ 计划」把课放进下学期计划，计划里的课会参与同修/反修检查。点「课程链」看一门课完整的前置链和后续链。
8. 每门课会自动从 [UWFlow](https://uwflow.com/) 查评分（喜欢 / 简单 / 有用的百分比，括号里是评分人数），结果在浏览器里缓存 3 天。

## 状态含义

| 状态 | 含义 |
| --- | --- |
| 可选 | 先修、年级、专业条件都满足，没有反修冲突 |
| 需同修 | 先修满足，但有 corequisite 需要同学期一起选 |
| 需确认 | 有无法自动判断的条件（语言能力、特定 Topic、特殊许可等） |
| 未满足 | 先修课或年级/专业不满足 |
| 反修冲突 | 已修过或计划修它的 antirequisite |

## 更新数据

数据来自 Academic Calendar 背后的 Kuali API，以及 classes.uwaterloo.ca。

```bash
npm run data            # 全部：抓日历 + 生成 catalog.json + 抓开课列表
npm run data:fetch      # 下载原始课程数据到 data/raw/（已下载的会跳过，--force 强制重下）
npm run data:build      # 解析成 public/data/catalog.json
npm run data:schedule   # 抓下学期开课列表到 public/data/schedule.json
npm test
```

新学年日历发布后跑一次 `npm run data:fetch -- --force && npm run data:build` 即可。

## 已知限制

- 只做了 Computer Engineering 一个专业（专业名在 `src/App.tsx` 的 `PROGRAMS`）。
- 「至少 1–2 门 TE 必须来自 CE/EE 以外的工程专业」只做了文字提示，没有自动校验。
- classes.uwaterloo.ca 的证书链不完整，抓取时对这个站点关闭了证书校验（只读公开页面）。
- 先修条件里约 2% 是自由文本，会显示为「需确认」。
- 「课程链」完全按日历里写明的先修/同修课程来连。很多 CE 核心课在日历里只写了年级 + 专业（例如 ECE 250 只要求 2A 且在 CE/EE），没有写具体先修课，所以链条会在这些课处断开。
