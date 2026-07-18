// lib/physicsKB.ts
// 浏览器内物理内容库：为离线生成引擎提供真实的竞赛题源、训练目标与误区说明。
// 所有题目均经过物理校验，可直接用于「竞赛导师生成题目 / 知识图谱生成训练 / 错题 AI 解析」。
//
// 设计目标：在 GitHub Pages 纯静态离线部署下，让 POMOS 具备可解释的、真实的生成能力，
// 而不再依赖随机哈希或写死常量。

export const KG_BOARDS = ["力学", "电磁学", "热学", "光学", "近代物理"] as const;
export type Board = (typeof KG_BOARDS)[number];

/** 错题归因分类（替代原先写死的 "detected"） */
export interface BugCategory {
  id: string;
  label: string;
  desc: string;
  fix: string;
}
export const BUG_CATEGORIES: BugCategory[] = [
  { id: "concept", label: "概念迷思", desc: "对物理概念/定律本质理解有偏差", fix: "回到定义，用极限/特例检验概念边界" },
  { id: "model", label: "模型误判", desc: "未正确抽象出物理模型或选错模型", fix: "强制走「图像→隔离体→方程」十阶段" },
  { id: "math", label: "数学错误", desc: "微积分/代数/符号处理失误", fix: "分步列式，保留符号到最后再代入" },
  { id: "symbol", label: "符号疏漏", desc: "漏写方向/正负号/单位", fix: "建立坐标系并标注每个量的符号约定" },
  { id: "reading", label: "审题偏差", desc: "漏读条件或误读过程", fix: "圈出已知量、约束与所求量再动笔" },
  { id: "method", label: "方法僵化", desc: "只会一种解法，不会换路", fix: "同一题尝试能量法/牛顿法/图像法各一遍" },
  { id: "check", label: "检验缺失", desc: "解出后未做量纲/极限自检", fix: "养成 SOP：代入 1-2 个极限值验证" },
];

export interface ProblemTemplate {
  id: string;
  topic: string;
  difficulty: number; // 1-5
  stem: string;
  hint: string;
  solutionPoints: string[]; // 标准解答要点
  keyPoints: string[]; // 关键考点 / 易错
}

export interface BoardContent {
  objectives: string[]; // 训练目标
  misconceptions: string[]; // 常见误区
  problems: ProblemTemplate[];
}

// ---------------------------------------------------------------- 内容库
export const PHYSICS_BANK: Record<Board, BoardContent> = {
  力学: {
    objectives: [
      "建立「隔离体→受力图→坐标系→动力学方程」的标准流程",
      "熟练在能量 / 动量 / 转动三种视角间切换",
      "刚体定轴转动：I、力矩、角动量守恒的联立",
    ],
    misconceptions: [
      "滑轮质量不可忽略时误用平动牛顿第二定律（应计入转动惯量）",
      "非惯性系漏加惯性力",
      "完全非弹性碰撞后误以为动能守恒",
    ],
    problems: [
      {
        id: "mech-1",
        topic: "刚体转动·细杆下摆",
        difficulty: 4,
        stem:
          "均匀细杆长 L、质量 M，一端铰接于天花板，初始保持水平静止后释放。求：(1) 杆摆至竖直向下位置时的角速度 ω；(2) 此时铰链对杆的作用力。",
        hint: "用机械能守恒求 ω（转动动能 ½Iω²，I=ML²/3，质心下降 L/2）；再用质心动力学求铰链力。",
        solutionPoints: [
          "机械能守恒：Mg·(L/2) = ½·(ML²/3)·ω² ⟹ ω = √(3g/L)",
          "质心速度 v = ω·L/2；径向加速度 a_c = v²/(L/2) = 3g/2（向上）",
          "竖直方向：F_hinge − Mg = M·a_c ⟹ F_hinge = Mg + 3Mg/2 = 2.5Mg，方向向上",
          "该瞬时重力矩为 0，角加速度 α=0，无切向分量",
        ],
        keyPoints: ["I=ML²/3", "质心下降 L/2", "径向加速度指向转轴"],
      },
      {
        id: "mech-2",
        topic: "动量·木块滑上小车",
        difficulty: 3,
        stem:
          "质量 m 的物块以初速 v₀ 滑上静止于光滑水平面的小车 M，车上粗糙段长 d、摩擦系数 μ。求两者共速后小车对地的位移。",
        hint: "先由动量守恒求共速 V；再对小车用动能定理（摩擦力做功 = 小车动能增量）。",
        solutionPoints: [
          "动量守恒：m v₀ = (M+m)V ⟹ V = m v₀/(M+m)",
          "对小车：μ m g · s_cart = ½ M V² ⟹ s_cart = M v₀² / [2 μ g (M+m)²] · m",
          "（木块相对位移 = d 时恰好共速，故 d ≥ 上述临界；否则未共速已滑出）",
        ],
        keyPoints: ["水平方向动量守恒", "摩擦力对小车做正功", "注意相对位移与对地位移的区别"],
      },
      {
        id: "mech-3",
        topic: "振动·双弹簧对称耦合",
        difficulty: 2,
        stem: "质量 m 被两根相同轻弹簧（劲度 k）连接于两固定墙之间，弹簧原长时物体位于中央。求沿连线方向小振动的角频率 ω。",
        hint: "偏离平衡位置 x，两侧弹簧一伸一缩，回复力为 −2kx。",
        solutionPoints: ["F = −k x − k x = −2k x", "ω = √(2k/m)，T = 2π√(m/(2k))"],
        keyPoints: ["对称系统回复力系数翻倍", "小振动近似"],
      },
    ],
  },
  电磁学: {
    objectives: [
      "法拉第定律与楞次定律的方向判断（来拒去留 / 增反减同）",
      "导体棒切割：安培阻力与能量转化",
      "静电场高斯定理与电势梯度 E=−∇V",
    ],
    misconceptions: [
      "对楞次定律「阻碍变化」仅记磁通增大则反向，忽略相对运动视角",
      "导体棒有稳定速度时误以为安培力做正功（实际为阻力，能量来自外力）",
      "静电平衡时误以为导体内部有净场",
    ],
    problems: [
      {
        id: "em-1",
        topic: "电磁感应·导体棒减速",
        difficulty: 5,
        stem:
          "U 形导轨间距 L、总电阻 R，质量为 m 的导体棒电阻不计，置于垂直纸面向里的匀强磁场 B 中，导轨光滑。棒获初速 v₀ 向右运动后撤去外力。求：(1) 棒速随时间变化；(2) 最终状态。",
        hint: "安培力 F=BIL=B²L²v/R 为阻力，列牛顿第二定律得指数衰减。",
        solutionPoints: [
          "感应电流 I = BLv/R，安培力 F = BIL = B²L²v/R（向左，阻力）",
          "m dv/dt = −B²L² v/R ⟹ v(t) = v₀·exp(−t/τ)，τ = mR/(B²L²)",
          "无外力最终 v→0，全部初动能转化为焦耳热 Q = ½ m v₀²",
          "（若恒力 F 外拉：稳定速度 v∞ = F R/(B²L²)）",
        ],
        keyPoints: ["安培力是阻力", "时间常数 τ=mR/B²L²", "能量守恒：动能→焦耳热"],
      },
      {
        id: "em-2",
        topic: "静电场·均匀带电球壳",
        difficulty: 3,
        stem: "总电荷 Q 均匀分布于半径 R 的薄球壳。求壳外 r>R 与壳内 r<R 的电场强度，并说明壳内电势。",
        hint: "用高斯定理，取同心球面为高斯面。",
        solutionPoints: [
          "r>R：∮E·dA = Q/ε₀ ⟹ E = Q/(4π ε₀ r²)",
          "r<R：包围电荷为 0 ⟹ E=0，壳内为等势区",
          "壳内电势 = 表面电势 = Q/(4π ε₀ R)",
        ],
        keyPoints: ["高斯定理", "壳内场强为 0", "导体/带电壳内部等势"],
      },
      {
        id: "em-3",
        topic: "电路·无穷梯形网络",
        difficulty: 4,
        stem: "由无穷多个相同单元（电阻 R 串联两支后再并联）构成的梯形网络，求左右端口等效电阻 R_eq。",
        hint: "利用自相似性：去掉一个单元后剩余网络等效电阻仍为 R_eq。",
        solutionPoints: [
          "设总电阻 R_eq，则 R_eq = R + (R · R_eq)/(R + R_eq)",
          "整理得 R_eq² − R R_eq − R² = 0",
          "取正根：R_eq = R(1+√5)/2（黄金比例）",
        ],
        keyPoints: ["自相似列方程", "舍去负根"],
      },
    ],
  },
  热学: {
    objectives: [
      "理想气体状态方程与过程方程（等压/等容/等温/绝热）",
      "热力学第一定律 ΔU=Q−W 的符号约定",
      "卡诺循环与效率上限",
    ],
    misconceptions: [
      "绝热自由膨胀误以为温度下降（理想气体自由膨胀温度不变）",
      "W 的符号约定混乱（系统对外做功为正）",
      "误以为实际热机可达卡诺效率",
    ],
    problems: [
      {
        id: "thermo-1",
        topic: "热力学·绝热自由膨胀",
        difficulty: 3,
        stem: "物质的量 n 的理想气体，从体积 V 向真空自由膨胀到 2V，容器绝热。求末态温度与内能变化。",
        hint: "自由膨胀 Q=0、W=0，由第一定律得 ΔU=0。",
        solutionPoints: [
          "Q=0（绝热），W=0（向真空不做功）⟹ ΔU=0",
          "理想气体内能只与温度有关 ⟹ T 不变",
          "熵增加（不可逆过程），但温度不变",
        ],
        keyPoints: ["自由膨胀不做功", "理想气体 U 仅依赖于 T"],
      },
      {
        id: "thermo-2",
        topic: "热机·卡诺效率",
        difficulty: 2,
        stem: "卡诺热机高温热源 T_h=600K，低温热源 T_c=300K。求理论最大效率；若每循环吸热 Q_h=1200J，求对外做功。",
        hint: "η=1−T_c/T_h；W=η Q_h。",
        solutionPoints: ["η = 1 − 300/600 = 0.5", "W = 0.5 × 1200 = 600 J", "放热 Q_c = 600 J"],
        keyPoints: ["卡诺效率只取决于两热源温度", "实际效率必低于卡诺"],
      },
    ],
  },
  光学: {
    objectives: [
      "双缝/多缝干涉主极大条件 d sinθ=mλ",
      "薄透镜成像公式与符号约定",
      "几何光学中的光程与费马原理",
    ],
    misconceptions: [
      "误以为双缝间距 d 增大条纹变疏（实际变密）",
      "透镜成像符号约定混乱（实正虚负）",
    ],
    problems: [
      {
        id: "optics-1",
        topic: "波动光学·双缝干涉",
        difficulty: 3,
        stem: "双缝间距 d=0.5mm，屏距 D=1.5m，用波长 λ=600nm 的单色光照射。求第 2 级亮纹到中央亮纹的距离；若将 d 增大到 1.0mm，条纹如何变化？",
        hint: "小角近似下亮纹位置 x_m ≈ mλD/d。",
        solutionPoints: [
          "x₂ ≈ 2 λ D / d = 2×600e-9×1.5 / 0.5e-3 = 3.6×10⁻³ m = 3.6 mm",
          "d 增大到 1.0mm 时 x₂ 减半为 1.8mm，条纹间距变小（变密）",
        ],
        keyPoints: ["d sinθ=mλ", "条纹间距 Δx=λD/d 与 d 成反比"],
      },
      {
        id: "optics-2",
        topic: "几何光学·薄透镜",
        difficulty: 2,
        stem: "凸透镜焦距 f=10cm，物体置于镜前 u=15cm 处。求像距 v 与放大率 m，并判断像的性质。",
        hint: "薄透镜公式 1/u+1/v=1/f，放大率 m=−v/u。",
        solutionPoints: [
          "1/v = 1/10 − 1/15 = 1/30 ⟹ v=30cm",
          "m = −30/15 = −2（倒立、放大、实像）",
        ],
        keyPoints: ["实像 v>0", "m<0 表示倒立"],
      },
    ],
  },
  近代物理: {
    objectives: [
      "狭义相对论：时间膨胀与长度收缩",
      "光电效应与逸出功",
      "一维无限深势阱能级量子化",
    ],
    misconceptions: [
      "双生子佯谬误用对称（一方经历加速，非惯性系不可对称处理）",
      "误以为量子隧穿违背能量守恒（总能量守恒，穿透靠波函数指数衰减）",
    ],
    problems: [
      {
        id: "modern-1",
        topic: "相对论·μ子寿命",
        difficulty: 3,
        stem: "μ 子静止寿命 τ₀=2.2μs，以 v=0.99c 射向地面。求地面参考系中其平均飞行距离（忽略大气影响）。",
        hint: "先算洛伦兹因子 γ，地面寿命 τ=γτ₀，距离 = vτ。",
        solutionPoints: [
          "γ = 1/√(1−0.99²) ≈ 7.09",
          "τ = γ τ₀ ≈ 15.6 μs",
          "L = v τ ≈ 0.99×3e8×15.6e-6 ≈ 4.6 km（远大于自有寿命对应的 0.66km，解释为何能到达地面）",
        ],
        keyPoints: ["γ=1/√(1−v²/c²)", "时间膨胀 τ=γτ₀"],
      },
      {
        id: "modern-2",
        topic: "量子·无限深势阱",
        difficulty: 3,
        stem: "质量为 m 的粒子处于长 L 的一维无限深势阱。求第 n 级能级 E_n 与基态最可几位置。",
        hint: "边界波函数为 0，驻波条件 L=nλ/2。",
        solutionPoints: [
          "波数 k_n = nπ/L，E_n = ℏ²k_n²/(2m) = n²π²ℏ²/(2mL²)",
          "基态 ψ₁ ∝ sin(πx/L)，最可几位置在 x=L/2",
        ],
        keyPoints: ["能级 ∝ n²", "边界条件决定量子化"],
      },
    ],
  },
};

/** 在内容库中按关键词查找最匹配的知识点（用于把导师对话里的题目请求定位到板块） */
export function findBoardByKeyword(text: string): Board | null {
  const t = (text || "").toLowerCase();
  const rules: [Board, string[]][] = [
    ["力学", ["力学", "mech", "牛顿", "动量", "能量", "转动", "刚体", "振动", "角动量", "摆", "碰撞"]],
    ["电磁学", ["电磁", "电场", "磁场", "电磁感应", "法拉第", "电路", "电容", "静电", "导体棒", "楞次", "电阻"]],
    ["热学", ["热", "thermal", "熵", "卡诺", "热力学", "绝热", "理想气体"]],
    ["光学", ["光", "optics", "干涉", "衍射", "透镜", "折射", "双缝"]],
    ["近代物理", ["相对论", "量子", "relativity", "quantum", "势阱", "光电", "μ子", "洛伦兹"]],
  ];
  let best: Board | null = null;
  let bestLen = 0;
  for (const [board, keys] of rules) {
    for (const k of keys) {
      if (t.includes(k.toLowerCase()) && k.length > bestLen) {
        best = board;
        bestLen = k.length;
      }
    }
  }
  return best;
}

/** 根据错题主题猜测归因分类 */
export function inferBugCategory(topic: string): BugCategory {
  const t = (topic || "").toLowerCase();
  if (t.includes("感应") || t.includes("楞次") || t.includes("磁通")) return BUG_CATEGORIES[0];
  if (t.includes("转动") || t.includes("滑轮") || t.includes("模型")) return BUG_CATEGORIES[1];
  if (t.includes("符号") || t.includes("单位")) return BUG_CATEGORIES[3];
  if (t.includes("极限") || t.includes("检验")) return BUG_CATEGORIES[6];
  if (t.includes("审题") || t.includes("漏读")) return BUG_CATEGORIES[4];
  if (t.includes("方法") || t.includes("换路")) return BUG_CATEGORIES[5];
  if (t.includes("概念") || t.includes("理解")) return BUG_CATEGORIES[0];
  return BUG_CATEGORIES[0];
}
