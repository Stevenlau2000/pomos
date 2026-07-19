// lib/textbooks.ts
// 10 部教材：PRD（REQ-KB-02）点名的 7 部真实教材 + REQ-PROB-01 学科扩展保留的 3 部（高数/矢量分析/电动力学）。
// 按「学科 → 章节 → 核心知识点 + 典型例题（题干/解析/出处）」结构化，静态随包（开箱即用），
// 由 lecture / 题目生成器经 textbookRetriever 按 subject/title 检索引用，不进用户知识库。
// 体量受控：每章 2–3 知识点 + 1–2 例题，覆盖竞赛核心考点。

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

// ① 舒幼生《力学》（北京大学出版社）
const TB_MECH: Textbook = {
  id: "tb-mech",
  title: "舒幼生《力学》",
  subject: "力学",
  author: "舒幼生",
  chapters: [
    {
      id: "mech-kin",
      title: "质点运动学",
      points: [
        { id: "p-mech-kin-1", title: "位矢·速度·加速度", summary: "r(t)→v=dr/dt→a=dv/dt；自然坐标系 a_t=dv/dt, a_n=v²/ρ。", keywords: ["位矢", "速度", "加速度", "切向加速度", "法向加速度"] },
        { id: "p-mech-kin-2", title: "相对运动", summary: "a_绝对=a_相对+a_牵连+2ω×v_相对（科氏加速度）。", keywords: ["相对运动", "伽利略", "科里奥利"] },
      ],
      examples: [
        {
          id: "e-mech-kin-1",
          topic: "抛体在升降电梯中的轨迹",
          difficulty: 3,
          stem: "电梯以 a 匀加速上升，舱内水平抛出一球初速 v0，求相对地面轨迹。",
          solution: "x=v0 t, y=½(a+g)t²；消 t 得 y=(a+g)x²/(2v0²)，抛物线。",
          source: "舒幼生《力学》第1章",
        },
      ],
    },
    {
      id: "mech-mom",
      title: "牛顿定律与动量",
      points: [
        { id: "p-mech-mom-1", title: "动量定理与守恒", summary: "∫F dt=Δp；∑F_ext=0 时 ∑p_i 守恒。", keywords: ["动量", "动量守恒", "冲量"] },
        { id: "p-mech-mom-2", title: "质心运动", summary: "R_cm=∑m_i r_i/M；M a_cm=∑F_ext。", keywords: ["质心", "质心运动定理"] },
      ],
      examples: [
        {
          id: "e-mech-mom-1",
          topic: "爆破分离",
          difficulty: 3,
          stem: "静止物体炸成 m1,m2 两块，m1 获 v1 向北，求 m2 速度。",
          solution: "0=m1v1+m2v2 ⟹ v2=−m1v1/m2，向南。",
          source: "舒幼生《力学》第2章",
        },
      ],
    },
    {
      id: "mech-eng",
      title: "机械能",
      points: [
        { id: "p-mech-eng-1", title: "动能定理与势能", summary: "W=ΔEk；保守力势能：重力 mgh、弹性 ½kx²、引力 −GMm/r。", keywords: ["动能定理", "势能", "机械能守恒"] },
      ],
      examples: [
        {
          id: "e-mech-eng-1",
          topic: "弹簧振子最大速率",
          difficulty: 2,
          stem: "质量 m 由压缩 x0 的弹簧释放，求过平衡位置速率。",
          solution: "½kx0²=½mv² ⟹ v=x0√(k/m)。",
          source: "舒幼生《力学》第3章",
        },
      ],
    },
    {
      id: "mech-ang",
      title: "角动量",
      points: [
        { id: "p-mech-ang-1", title: "角动量守恒", summary: "L=r×p；∑M_ext=0 时 L 守恒。", keywords: ["角动量", "角动量守恒", "力矩"] },
      ],
      examples: [
        {
          id: "e-mech-ang-1",
          topic: "细杆下摆角速度",
          difficulty: 4,
          stem: "均匀细杆长 L 质量 M 一端铰接水平释放，求竖直时 ω 与铰链力。",
          solution: "Mg·L/2=½(ML²/3)ω²⟹ω=√(3g/L)；质心 a_c=3g/2，F=2.5Mg 向上。",
          source: "舒幼生《力学》第4章",
        },
      ],
    },
    {
      id: "mech-rot",
      title: "刚体定轴转动",
      points: [
        { id: "p-mech-rot-1", title: "转动惯量与平行轴定理", summary: "I=∫r²dm；I=I_cm+md²。", keywords: ["转动惯量", "平行轴定理", "刚体"] },
        { id: "p-mech-rot-2", title: "转动定律", summary: "M=Iα；合外力矩为零时 Iω 守恒。", keywords: ["转动定律", "角动量守恒", "力矩"] },
      ],
      examples: [],
    },
    {
      id: "mech-vib",
      title: "振动与波",
      points: [
        { id: "p-mech-vib-1", title: "简谐振动", summary: "x¨+ω²x=0，x=Acos(ωt+φ)；E=½kA²。", keywords: ["简谐振动", "周期", "振幅"] },
      ],
      examples: [
        {
          id: "e-mech-vib-1",
          topic: "双弹簧对称耦合",
          difficulty: 2,
          stem: "质量 m 被两相同轻弹簧(劲度 k)连于两墙，求小振动角频率。",
          solution: "偏离 x 回复力=−2kx，ω=√(2k/m)。",
          source: "舒幼生《力学》第6章",
        },
      ],
    },
  ],
};

// ② 叶邦角《电磁学101》（中国科学技术大学出版社）
const TB_EM: Textbook = {
  id: "tb-em",
  title: "叶邦角《电磁学101》",
  subject: "电磁学",
  author: "叶邦角",
  chapters: [
    {
      id: "em-electro",
      title: "静电场",
      points: [
        { id: "p-em-electro-1", title: "库仑定律与电场强度", summary: "F=k q1q2/r² r̂；E=F/q；叠加原理。", keywords: ["库仑", "电场强度", "叠加"] },
        { id: "p-em-electro-2", title: "高斯定理", summary: "∮E·dS=q_enc/ε₀；球/柱/面对称可求 E。", keywords: ["高斯定理", "通量", "对称性"] },
        { id: "p-em-electro-3", title: "电势与导体", summary: "V_a−V_b=∫_a^b E·dl；导体内部 E=0，表面等势。", keywords: ["电势", "导体", "静电平衡"] },
      ],
      examples: [
        {
          id: "e-em-electro-1",
          topic: "均匀带电球壳",
          difficulty: 3,
          stem: "总电荷 Q 均匀分布于半径 R 薄球壳，求壳外与壳内场强。",
          solution: "r>R：E=Q/(4πε₀r²)；r<R：E=0。",
          source: "叶邦角《电磁学101》第2章",
        },
      ],
    },
    {
      id: "em-current",
      title: "恒定电流",
      points: [
        { id: "p-em-current-1", title: "欧姆定律与基尔霍夫", summary: "J=σE；节点 ∑I=0，回路 ∑(IR)=∑ε。", keywords: ["欧姆定律", "基尔霍夫", "电阻"] },
      ],
      examples: [],
    },
    {
      id: "em-mag",
      title: "磁场",
      points: [
        { id: "p-em-mag-1", title: "毕奥-萨伐尔与安培环路", summary: "dB=μ₀Idl×r̂/(4πr²)；∮B·dl=μ₀I_enc。", keywords: ["磁场", "安培环路", "毕奥萨伐尔"] },
        { id: "p-em-mag-2", title: "洛伦兹力", summary: "F=q(E+v×B)；回旋半径 R=mv/(qB)。", keywords: ["洛伦兹力", "回旋", "磁场"] },
      ],
      examples: [],
    },
    {
      id: "em-induction",
      title: "电磁感应",
      points: [
        { id: "p-em-ind-1", title: "法拉第定律与楞次", summary: "ε=−dΦ/dt；楞次定律定方向。", keywords: ["法拉第", "电磁感应", "楞次", "磁通"] },
        { id: "p-em-ind-2", title: "动生与自感", summary: "动生 ε=Blv；自感储能 ½LI²，τ=L/R。", keywords: ["动生电动势", "自感", "RL电路"] },
      ],
      examples: [
        {
          id: "e-em-ind-1",
          topic: "导体棒减速",
          difficulty: 5,
          stem: "U形导轨间距 L 电阻 R，质量 m 导体棒获初速 v0 后撤外力，求 v(t)。",
          solution: "F=B²L²v/R 阻力，v(t)=v0 exp(−t/τ)，τ=mR/(B²L²)。",
          source: "叶邦角《电磁学101》第7章",
        },
      ],
    },
    {
      id: "em-wave",
      title: "电磁波",
      points: [
        { id: "p-em-wave-1", title: "麦克斯韦与光速", summary: "位移电流 ε₀∂E/∂t；真空中 c=1/√(μ₀ε₀)。", keywords: ["电磁波", "麦克斯韦", "位移电流"] },
      ],
      examples: [],
    },
  ],
};

// ③ 秦允豪《热学》（高等教育出版社）
const TB_THERMO: Textbook = {
  id: "tb-thermo",
  title: "秦允豪《热学》",
  subject: "热学",
  author: "秦允豪",
  chapters: [
    {
      id: "thermo-kin",
      title: "气体动理论",
      points: [
        { id: "p-thermo-kin-1", title: "压强与温度微观本质", summary: "p=⅓nm⟨v²⟩；ε_k=3/2 kT；v_rms=√(3kT/m)。", keywords: ["气体动理论", "温度", "压强", "方均根速率"] },
        { id: "p-thermo-kin-2", title: "麦克斯韦速率分布", summary: "f(v)=4π(m/2πkT)^{3/2} v² e^{−mv²/2kT}；v_p=√(2kT/m)。", keywords: ["麦克斯韦", "速率分布", "最概然速率"] },
      ],
      examples: [
        {
          id: "e-thermo-kin-1",
          topic: "温度升高最概然速率",
          difficulty: 2,
          stem: "理想气体温度由 T 升到 4T，最概然速率如何变？",
          solution: "v_p∝√T，翻倍为 2v_p。",
          source: "秦允豪《热学》第3章",
        },
      ],
    },
    {
      id: "thermo-1st",
      title: "热力学第一定律",
      points: [
        { id: "p-thermo-1st-1", title: "内能·功·热量", summary: "ΔU=Q−W；等容 W=0，等压 W=pΔV，等温 ΔU=0，绝热 pV^γ=const。", keywords: ["热力学第一定律", "内能", "绝热", "等温"] },
      ],
      examples: [
        {
          id: "e-thermo-1st-1",
          topic: "多方过程吸热",
          difficulty: 3,
          stem: "1 mol 理想气体等压升温 ΔT，求吸热与做功。",
          solution: "W=pΔV=RΔT；Q=C_pΔT=(5/2)RΔT。",
          source: "秦允豪《热学》第4章",
        },
      ],
    },
    {
      id: "thermo-2nd",
      title: "热力学第二定律",
      points: [
        { id: "p-thermo-2nd-1", title: "卡诺定理与熵", summary: "η_carnot=1−T_c/T_h；ΔS≥∫dQ/T，可逆取等。", keywords: ["卡诺", "熵", "热力学第二定律", "可逆"] },
      ],
      examples: [
        {
          id: "e-thermo-2nd-1",
          topic: "卡诺效率",
          difficulty: 2,
          stem: "卡诺热机 T_h=600K T_c=300K，每循环吸热 1200J，求对外做功。",
          solution: "η=0.5；W=600J；放热 600J。",
          source: "秦允豪《热学》第6章",
        },
      ],
    },
    {
      id: "thermo-phase",
      title: "相变与输运",
      points: [
        { id: "p-thermo-phase-1", title: "潜热与范德瓦尔斯", summary: "相变潜热 L=Q/m；范德瓦尔斯 (p+a/V_m²)(V_m−b)=RT。", keywords: ["相变", "潜热", "范德瓦尔斯"] },
      ],
      examples: [],
    },
  ],
};

// ④ 钟锡华《光学》（北京大学出版社）
const TB_OPTICS: Textbook = {
  id: "tb-optics",
  title: "钟锡华《光学》",
  subject: "光学",
  author: "钟锡华",
  chapters: [
    {
      id: "opt-geo",
      title: "几何光学",
      points: [
        { id: "p-opt-geo-1", title: "费马原理与成像", summary: "光程极值 δ∫n dl=0；薄透镜 1/u+1/v=1/f。", keywords: ["费马原理", "透镜", "成像", "几何光学"] },
      ],
      examples: [
        {
          id: "e-opt-geo-1",
          topic: "透镜放大率",
          difficulty: 2,
          stem: "物距 u=30cm 焦距 f=10cm，求像距与放大率。",
          solution: "1/v=1/10−1/30=1/15⟹v=15cm；m=−v/u=−0.5（倒立缩小）。",
          source: "钟锡华《光学》第1章",
        },
      ],
    },
    {
      id: "opt-interfere",
      title: "干涉",
      points: [
        { id: "p-opt-int-1", title: "杨氏双缝与等厚", summary: "双缝主极大 d sinθ=mλ；牛顿环 r_m=√(mλR)。", keywords: ["干涉", "双缝", "牛顿环", "光程差"] },
      ],
      examples: [
        {
          id: "e-opt-int-1",
          topic: "双缝间距变化",
          difficulty: 3,
          stem: "双缝 d=0.5mm D=1.5m λ=600nm，求第2级亮纹；d 增至1.0mm 时如何变？",
          solution: "x₂≈2λD/d=3.6mm；d 倍增则 x₂ 减半为 1.8mm。",
          source: "钟锡华《光学》第4章",
        },
      ],
    },
    {
      id: "opt-diffract",
      title: "衍射",
      points: [
        { id: "p-opt-diff-1", title: "夫琅禾费与光栅", summary: "单缝暗纹 a sinθ=mλ；光栅 d sinθ=mλ，分辨本领 R=mN。", keywords: ["衍射", "单缝", "光栅", "分辨本领"] },
      ],
      examples: [],
    },
    {
      id: "opt-polar",
      title: "偏振",
      points: [
        { id: "p-opt-pol-1", title: "马吕斯与布儒斯特", summary: "I=I₀cos²θ；布儒斯特角 tanθ_B=n₂/n₁。", keywords: ["偏振", "马吕斯", "布儒斯特角", "双折射"] },
      ],
      examples: [],
    },
  ],
};

// ⑤ 杨福家《原子物理学》（高等教育出版社）
const TB_ATOM: Textbook = {
  id: "tb-atom",
  title: "杨福家《原子物理学》",
  subject: "近代物理",
  author: "杨福家",
  chapters: [
    {
      id: "atom-state",
      title: "原子的量子态",
      points: [
        { id: "p-atom-state-1", title: "卢瑟福与玻尔模型", summary: "核式模型；玻尔量子化 L=nℏ；氢光谱 1/λ=R_H(1/n₁²−1/n₂²)。", keywords: ["卢瑟福", "玻尔", "氢原子", "里德伯"] },
      ],
      examples: [
        {
          id: "e-atom-state-1",
          topic: "氢原子巴耳末系",
          difficulty: 3,
          stem: "求氢 n=3→2 跃迁光子波长（R_H≈1.097×10⁷ m⁻¹）。",
          solution: "1/λ=R_H(1/4−1/9)=5R_H/36⟹λ≈656nm（Hα 红）。",
          source: "杨福家《原子物理学》第2章",
        },
      ],
    },
    {
      id: "atom-quantum",
      title: "量子力学初步",
      points: [
        { id: "p-atom-q-1", title: "不确定关系与势阱", summary: "ΔxΔp≥ℏ/2；一维无限深势阱 E_n=n²π²ℏ²/(2ma²)。", keywords: ["不确定关系", "薛定谔", "势阱", "波函数"] },
      ],
      examples: [
        {
          id: "e-atom-q-1",
          topic: "μ子寿命",
          difficulty: 3,
          stem: "μ子静止寿命 τ₀=2.2μs，以 v=0.99c 射向地面，求地面系平均飞行距离。",
          solution: "γ≈7.09，τ=γτ₀≈15.6μs，L≈4.6km。",
          source: "杨福家《原子物理学》第4章",
        },
      ],
    },
    {
      id: "atom-alkali",
      title: "碱金属与多电子",
      points: [
        { id: "p-atom-alk-1", title: "量子数亏损与泡利", summary: "有效量子数 n*=n−δ；泡利不相容原理限制壳层电子数 2(2l+1)。", keywords: ["碱金属", "量子数亏损", "泡利", "壳层"] },
      ],
      examples: [],
    },
    {
      id: "atom-mag",
      title: "磁场中的原子",
      points: [
        { id: "p-atom-mag-1", title: "空间量子化与塞曼", summary: "斯特恩-盖拉赫证实空间量子化；正常塞曼 Δν=eB/(4πm)。", keywords: ["斯特恩盖拉赫", "塞曼", "空间量子化"] },
      ],
      examples: [],
    },
    {
      id: "atom-nucleus",
      title: "原子核",
      points: [
        { id: "p-atom-nuc-1", title: "衰变与结合能", summary: "N=N₀e^{−λt}，τ=1/λ；比结合能 B/A。", keywords: ["放射性", "半衰期", "结合能", "核反应"] },
      ],
      examples: [],
    },
  ],
};

// ⑥ 赵凯华《新概念物理教程》（高等教育出版社，多卷系列教材）
const TB_XINGAINIAN: Textbook = {
  id: "tb-xingainian",
  title: "赵凯华《新概念物理教程》",
  subject: "力学",
  author: "赵凯华",
  chapters: [
    {
      id: "xgl-conserv",
      title: "质点系与守恒律",
      points: [
        { id: "p-xgl-conserv-1", title: "对称性与三大守恒", summary: "平移对称→动量守恒；转动对称→角动量守恒；时间平移对称→能量守恒。", keywords: ["对称性", "守恒律", "诺特定理", "动量", "能量"] },
        { id: "p-xgl-conserv-2", title: "质心与相对运动", summary: "质心系总动量零；两体问题化为约化质量 μ=m₁m₂/(m₁+m₂)。", keywords: ["质心", "约化质量", "两体问题"] },
      ],
      examples: [],
    },
    {
      id: "xgl-rot",
      title: "刚体与转动",
      points: [
        { id: "p-xgl-rot-1", title: "转动惯量张量", summary: "I_ij=∫(r²δ_ij−x_i x_j)dm；主轴系对角化。", keywords: ["转动惯量", "张量", "主轴"] },
      ],
      examples: [
        {
          id: "e-xgl-rot-1",
          topic: "细杆绕端转动惯量",
          difficulty: 3,
          stem: "均匀细杆长 L 质量 M，求绕一端垂直轴 I。",
          solution: "I=∫₀^L x²(M/L)dx=ML²/3。",
          source: "赵凯华《新概念物理教程·力学》",
        },
      ],
    },
    {
      id: "xgl-vibrel",
      title: "振动·波·相对论时空",
      points: [
        { id: "p-xgl-vibrel-1", title: "简正模与波速", summary: "耦合振子简正频率；弦波速 v=√(T/μ)。", keywords: ["简正模", "波速", "耦合振动"] },
        { id: "p-xgl-vibrel-2", title: "相对论时空观", summary: "时间膨胀 Δt=γΔτ；长度收缩 L=L₀/γ；同时性的相对性。", keywords: ["相对论", "时间膨胀", "长度收缩", "洛伦兹变换"] },
      ],
      examples: [],
    },
  ],
};

// ⑦ 梁昆淼《理论力学》（高等教育出版社）
const TB_THEOMECH: Textbook = {
  id: "tb-theomech",
  title: "梁昆淼《理论力学》",
  subject: "理论力学",
  author: "梁昆淼",
  chapters: [
    {
      id: "tm-dyn",
      title: "质点动力学",
      points: [
        { id: "p-tm-dyn-1", title: "动量·角动量·能量", summary: "牛顿第二定律矢量式；冲量矩定理；机械能守恒条件。", keywords: ["动量", "角动量", "能量守恒", "牛顿"] },
        { id: "p-tm-dyn-2", title: "有心力运动", summary: "比耐公式 u''+u=−F(1/u)/(mh²u²)；平方反比得圆锥曲线轨道。", keywords: ["有心力", "比耐公式", "开普勒", "轨道"] },
      ],
      examples: [
        {
          id: "e-tm-dyn-1",
          topic: "圆轨道速度",
          difficulty: 3,
          stem: "质量 m 在中心力 F=−k/r² 下作半径 r 圆轨道，求速率。",
          solution: "mv²/r=k/r²⟹v=√(k/(mr))。",
          source: "梁昆淼《理论力学》第3章",
        },
      ],
    },
    {
      id: "tm-lagrange",
      title: "分析力学",
      points: [
        { id: "p-tm-lag-1", title: "拉格朗日方程", summary: "L=T−V；d/dt(∂L/∂q̇)−∂L/∂q=0；广义坐标降阶。", keywords: ["拉格朗日", "广义坐标", "分析力学"] },
        { id: "p-tm-lag-2", title: "哈密顿正则方程", summary: "H=Σpᵢq̇ᵢ−L；q̇=∂H/∂p，ṗ=−∂H/∂q。", keywords: ["哈密顿", "正则方程", "相空间"] },
      ],
      examples: [
        {
          id: "e-tm-lag-1",
          topic: "单摆的拉格朗日量",
          difficulty: 4,
          stem: "质量 m 长 l 单摆，以 θ 为广义坐标写出 L 并导出方程。",
          solution: "T=½ml²θ̇²，V=mgl(1−cosθ)；得 ml²θ̈+mgl sinθ=0，小角 θ̈+(g/l)θ=0。",
          source: "梁昆淼《理论力学》第8章",
        },
      ],
    },
    {
      id: "tm-micro",
      title: "微振动",
      points: [
        { id: "p-tm-micro-1", title: "多自由度小振动", summary: "解本征值问题 |K−ω²M|=0 得简正频率与简正模。", keywords: ["微振动", "简正模", "本征值", "耦合"] },
      ],
      examples: [],
    },
  ],
};

// 保留：REQ-PROB-01 学科扩展（高数 / 矢量分析 / 电动力学），为题目学科扩展服务。
const TB_MATH: Textbook = {
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
};

const TB_VECTOR: Textbook = {
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
};

const TB_ELECTRO: Textbook = {
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
};

export const TEXTBOOKS: Textbook[] = [
  TB_MECH,
  TB_EM,
  TB_THERMO,
  TB_OPTICS,
  TB_ATOM,
  TB_XINGAINIAN,
  TB_THEOMECH,
  TB_MATH,
  TB_VECTOR,
  TB_ELECTRO,
];
