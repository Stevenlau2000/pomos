// lib/textbooks.ts
// 7 部预置教材：按「学科 → 章节 → 核心知识点 + 典型例题（题干/解析/出处）」结构化。
// 静态随包（开箱即用），由 lecture / 题目生成器经 textbookRetriever 引用，不进用户知识库。
// 体量受控：每章 2–3 知识点 + 2–3 例题，覆盖竞赛核心考点。

export interface TextbookExample {
  id: string;
  topic: string; // 例题标题（含考点）
  difficulty: number; // 1-5
  stem: string; // 题干
  solution: string; // 解析要点
  source: string; // 出处
}

export interface TextbookPoint {
  id: string;
  title: string; // 知识点名
  summary: string; // 核心公式 / 要点
  keywords: string[]; // 检索关键词
}

export interface TextbookChapter {
  id: string;
  title: string;
  points: TextbookPoint[];
  examples: TextbookExample[];
}

export interface Textbook {
  id: string;
  title: string;
  subject: string; // 对应学科（与 KG_BOARDS / 新学科一致）
  author?: string;
  chapters: TextbookChapter[];
}

export const TEXTBOOKS: Textbook[] = [
  {
    id: "tb-mech",
    title: "力学精要",
    subject: "力学",
    author: "POMOS 教研组",
    chapters: [
      {
        id: "mech-rot",
        title: "刚体定轴转动",
        points: [
          { id: "p-rot-1", title: "转动惯量", summary: "I=∫r²dm；平行轴定理 I=I_cm+md²。", keywords: ["转动惯量", "平行轴定理", "刚体", "转动"] },
          { id: "p-rot-2", title: "转动定律与角动量", summary: "M=Iα；合外力矩为零时 L=Iω 守恒。", keywords: ["转动定律", "角动量守恒", "力矩", "刚体"] },
        ],
        examples: [
          {
            id: "e-mech-1",
            topic: "细杆下摆角速度",
            difficulty: 4,
            stem: "均匀细杆长 L、质量 M，一端铰接，水平释放，求竖直时 ω 与铰链力。",
            solution: "机械能守恒：Mg·L/2 = ½·(ML²/3)·ω² ⟹ ω=√(3g/L)；质心 a_c=3g/2，F_hinge=2.5Mg 向上。",
            source: "力学精要·刚体定轴转动",
          },
        ],
      },
      {
        id: "mech-vib",
        title: "振动与波",
        points: [
          { id: "p-vib-1", title: "简谐振动", summary: "x¨+ω²x=0，解 x=Acos(ωt+φ)；能量 E=½kA² 守恒。", keywords: ["简谐振动", "弹簧", "周期", "振动"] },
        ],
        examples: [
          {
            id: "e-mech-2",
            topic: "双弹簧对称耦合",
            difficulty: 2,
            stem: "质量 m 被两根相同轻弹簧（劲度 k）连于两墙之间，求小振动角频率。",
            solution: "偏离 x 时回复力 = −2kx，故 ω=√(2k/m)。",
            source: "力学精要·振动与波",
          },
        ],
      },
    ],
  },
  {
    id: "tb-em",
    title: "电磁学进阶",
    subject: "电磁学",
    author: "POMOS 教研组",
    chapters: [
      {
        id: "em-induction",
        title: "电磁感应",
        points: [
          { id: "p-em-1", title: "法拉第定律", summary: "ε=−dΦ/dt；楞次定律定方向（来拒去留、增反减同）。", keywords: ["电磁感应", "法拉第", "磁通", "楞次"] },
          { id: "p-em-2", title: "动生与自感", summary: "动生 ε=Blv；自感储能 ½LI²，RL 时间常数 τ=L/R。", keywords: ["动生电动势", "自感", "RL电路", "安培力"] },
        ],
        examples: [
          {
            id: "e-em-1",
            topic: "导体棒减速",
            difficulty: 5,
            stem: "U 形导轨间距 L、电阻 R，质量 m 导体棒获初速 v₀ 后撤外力，求速度随时间变化。",
            solution: "安培力 F=B²L²v/R 为阻力，v(t)=v₀·exp(−t/τ)，τ=mR/(B²L²)；最终动能全转焦耳热。",
            source: "电磁学进阶·电磁感应",
          },
        ],
      },
      {
        id: "em-electro",
        title: "静电场",
        points: [
          { id: "p-em-3", title: "高斯定理与电势", summary: "∮E·dA=Q_enc/ε₀；E=−∇V；导体内部 E=0。", keywords: ["高斯定理", "静电场", "电势", "导体"] },
        ],
        examples: [
          {
            id: "e-em-2",
            topic: "均匀带电球壳",
            difficulty: 3,
            stem: "总电荷 Q 均匀分布于半径 R 薄球壳，求壳外与壳内场强。",
            solution: "r>R：E=Q/(4πε₀r²)；r<R：E=0，壳内等势。",
            source: "电磁学进阶·静电场",
          },
        ],
      },
    ],
  },
  {
    id: "tb-modern",
    title: "热·光·近代物理",
    subject: "热学",
    author: "POMOS 教研组",
    chapters: [
      {
        id: "th-termo",
        title: "热力学",
        points: [
          { id: "p-th-1", title: "第一定律与卡诺效率", summary: "ΔU=Q−W；卡诺 η=1−T_c/T_h，实际必低于卡诺。", keywords: ["热力学", "卡诺", "熵", "绝热"] },
        ],
        examples: [
          {
            id: "e-th-1",
            topic: "卡诺效率",
            difficulty: 2,
            stem: "卡诺热机 T_h=600K、T_c=300K，每循环吸热 1200J，求对外做功。",
            solution: "η=1−300/600=0.5；W=0.5×1200=600J；放热 600J。",
            source: "热·光·近代物理·热力学",
          },
        ],
      },
      {
        id: "op-optics",
        title: "波动光学",
        points: [
          { id: "p-op-1", title: "双缝干涉", summary: "主极大 d sinθ=mλ；条纹间距 Δx=λD/d 与 d 成反比。", keywords: ["干涉", "双缝", "光栅", "光学"] },
        ],
        examples: [
          {
            id: "e-op-1",
            topic: "双缝间距变化",
            difficulty: 3,
            stem: "双缝 d=0.5mm、D=1.5m、λ=600nm，求第 2 级亮纹位置；d 增至 1.0mm 时如何变化？",
            solution: "x₂≈2λD/d=3.6mm；d 倍增则 x₂ 减半为 1.8mm（变密）。",
            source: "热·光·近代物理·波动光学",
          },
        ],
      },
      {
        id: "md-quantum",
        title: "近代物理",
        points: [
          { id: "p-md-1", title: "相对论与量子", summary: "γ=1/√(1−v²/c²)；无限深势阱 Eₙ=n²π²ℏ²/(2mL²)。", keywords: ["相对论", "量子", "势阱", "洛伦兹"] },
        ],
        examples: [
          {
            id: "e-md-1",
            topic: "μ子寿命",
            difficulty: 3,
            stem: "μ 子静止寿命 τ₀=2.2μs，以 v=0.99c 射向地面，求地面系平均飞行距离。",
            solution: "γ≈7.09，τ=γτ₀≈15.6μs，L=vτ≈4.6km（远大于自有 0.66km）。",
            source: "热·光·近代物理·近代物理",
          },
        ],
      },
    ],
  },
  {
    id: "tb-math",
    title: "高等数学（物理应用）",
    subject: "高数",
    author: "POMOS 教研组",
    chapters: [
      {
        id: "math-calc",
        title: "极限·级数·常微分方程",
        points: [
          { id: "p-math-1", title: "泰勒展开", summary: "f(x)=Σf⁽ⁿ⁾(a)/n!·(x−a)ⁿ；小量近似 sinx≈x−x³/6。", keywords: ["泰勒展开", "级数", "近似", "高数"] },
          { id: "p-math-2", title: "常微分方程", summary: "分离变量 / 一阶线性 y'+P(x)y=Q(x)；指数衰减 dy/dt=−ky。", keywords: ["微分方程", "常微分", "衰减", "高数"] },
        ],
        examples: [
          {
            id: "e-math-1",
            topic: "RC 暂态的小量展开",
            difficulty: 3,
            stem: "RC 电路充电 q(t)=Cε(1−e^{−t/RC})，求 t≪RC 时电量的近似表达式。",
            solution: "e^{−t/RC}≈1−t/RC+(t/RC)²/2；q≈Cε·(t/RC−(t/RC)²/2)=Cεt/RC−(Cεt²)/(2R²C)。",
            source: "高等数学（物理应用）·极限·级数·常微分方程",
          },
        ],
      },
    ],
  },
  {
    id: "tb-vector",
    title: "矢量分析与场论",
    subject: "矢量分析",
    author: "POMOS 教研组",
    chapters: [
      {
        id: "vec-calc",
        title: "梯度·散度·旋度",
        points: [
          { id: "p-vec-1", title: "三大微分算子", summary: "∇φ 梯度（标量→矢量）；∇·A 散度；∇×A 旋度。", keywords: ["梯度", "散度", "旋度", "矢量分析", "nabla"] },
          { id: "p-vec-2", title: "高斯与斯托克斯", summary: "∫_V∇·AdV=∮_S A·dS；∫_S(∇×A)·dS=∮_C A·dl。", keywords: ["高斯定理", "斯托克斯", "矢量积分", "场论"] },
        ],
        examples: [
          {
            id: "e-vec-1",
            topic: "点电荷电场的散度",
            difficulty: 4,
            stem: "点电荷 q 电场 E=q r̂/(4πε₀r²)，验证 ∇·E=q/ε₀·δ³(r)。",
            solution: "r≠0 时 ∇·(r̂/r²)=0；仅在原点有源，由高斯定理得总通量 q/ε₀，故散度为 δ 源。",
            source: "矢量分析与场论·梯度·散度·旋度",
          },
        ],
      },
    ],
  },
  {
    id: "tb-theomech",
    title: "理论力学",
    subject: "理论力学",
    author: "POMOS 教研组",
    chapters: [
      {
        id: "tm-lagrange",
        title: "分析力学",
        points: [
          { id: "p-tm-1", title: "拉格朗日方程", summary: "d/dt(∂L/∂q̇)−∂L/∂q=0；L=T−V。广义坐标降阶。", keywords: ["拉格朗日", "广义坐标", "分析力学", "理论力学"] },
          { id: "p-tm-2", title: "哈密顿形式", summary: "H=Σpᵢq̇ᵢ−L；正则方程 q̇=∂H/∂p，ṗ=−∂H/∂q。", keywords: ["哈密顿", "正则方程", "相空间", "理论力学"] },
        ],
        examples: [
          {
            id: "e-tm-1",
            topic: "单摆的拉格朗日量",
            difficulty: 4,
            stem: "质量 m 长 l 单摆，以 θ 为广义坐标写出 L 并导出运动方程。",
            solution: "T=½ml²θ̇²，V=mgl(1−cosθ)；L=½ml²θ̇²−mgl(1−cosθ)；得 ml²θ̈+mgl sinθ=0，小角 θ̈+(g/l)θ=0。",
            source: "理论力学·分析力学",
          },
        ],
      },
    ],
  },
  {
    id: "tb-electro",
    title: "电动力学",
    subject: "电动力学",
    author: "POMOS 教研组",
    chapters: [
      {
        id: "ed-maxwell",
        title: "麦克斯韦方程组",
        points: [
          { id: "p-ed-1", title: "真空 Maxwell", summary: "∇·E=ρ/ε₀；∇×E=−∂B/∂t；∇·B=0；∇×B=μ₀J+μ₀ε₀∂E/∂t。", keywords: ["麦克斯韦", "电磁场", "电动力学", "位移电流"] },
          { id: "p-ed-2", title: "波动方程", summary: "真空中 ∇²E−(1/c²)∂²E/∂t²=0，c=1/√(μ₀ε₀)。", keywords: ["电磁波", "波动方程", "真空光速", "电动力学"] },
        ],
        examples: [
          {
            id: "e-ed-1",
            topic: "平面电磁波关系",
            difficulty: 5,
            stem: "真空中沿 x 传播的平面电磁波 E=E₀cos(kx−ωt)ŷ，求 B 的表达式并验证 ∇×E=−∂B/∂t。",
            solution: "由 ∇×E=−∂B/∂t 得 B=(E₀/c)cos(kx−ωt)ẑ；且 k=ω/c、c=1/√(μ₀ε₀)。",
            source: "电动力学·麦克斯韦方程组",
          },
        ],
      },
    ],
  },
];
