// lib/explain/offline.ts
// 离线讲解器：把物理要点扩写为六阶段结构化讲解，预置图 / 动画参数，附教材引用。
// 纯函数 + 轻量检索，无 React 依赖，可被 Node 单测直接加载。
import {
  EXPLAIN_PHASES,
  type ExplainPhase,
  type ExplainStep,
  type PomosExplainV1,
} from "./types";
import { lookupTemplate } from "./maps";
import { validateDiagramSpec, validateAnimationSpec } from "./validate";
import { searchTextbooks } from "../textbookRetriever";
import { findBoardByKeyword, type Board } from "../physicsKB";

interface TopicPhase {
  text: string;
  formulas?: string[];
}
interface ExplainTopic {
  keys: string[];
  title: string;
  board: Board;
  phases: Partial<Record<ExplainPhase, TopicPhase>>;
  template?: string;
  misconception?: string;
}

// 结构化讲解 KB（自包含，与 offlineApi.OFFLINE_KB 解耦；纯离线可用）。
const OFFLINE_EXPLAIN_TOPICS: ExplainTopic[] = [
  {
    keys: ["抛体", "斜抛", "平抛", "projectile", "抛物线"],
    title: "斜抛运动：水平方向为什么匀速？",
    board: "力学",
    template: "抛体",
    misconception: "忽略空气阻力；勿把「初速分解」误作「加速度分解」（加速度始终竖直向下，不随初速方向变）。",
    phases: {
      问题拆解: {
        text: "取抛出点为原点，x 轴水平向右，y 轴竖直向上。将初速 $\\mathbf v_0$ 分解为 $v_{0x}=v_0\\cos\\theta$、$v_{0y}=v_0\\sin\\theta$。",
        formulas: ["v_{0x}=v_0\\cos\\theta", "v_{0y}=v_0\\sin\\theta"],
      },
      概念辨析: {
        text: "水平方向不受力 → $a_x=0$，故水平速度恒定；竖直方向仅受重力 → $a_y=-g$，做匀加速运动。两个方向运动独立叠加。",
        formulas: ["a_x=0", "a_y=-g"],
      },
      数理推导: {
        text: "对两方向分别积分得 $x=v_0\\cos\\theta\\,t$，$y=v_0\\sin\\theta\\,t-\\tfrac12 g t^2$。可见 $x$ 与 $t$ 成正比，即水平匀速。",
        formulas: ["x=v_0\\cos\\theta\\,t", "y=v_0\\sin\\theta\\,t-\\tfrac12 g t^2"],
      },
      图像分析: {
        text: "轨迹为开口向下的抛物线；v-t 图显示 $v_x$ 水平线、$v_y$ 斜直线。",
        formulas: ["v_x=v_0\\cos\\theta", "v_y=v_0\\sin\\theta-gt"],
      },
      结论: {
        text: "水平方向不受力，根据牛顿第一定律，速度保持其初水平分量 $v_0\\cos\\theta$ 不变，即水平匀速。竖直方向为匀加速。斜抛 = 水平匀速 + 竖直匀加速。",
      },
      易错点: {
        text: "常见误判：把初速分解当成加速度分解。加速度只由重力产生，始终竖直向下，不会沿初速方向分解；因此水平方向没有加速度分量。",
      },
    },
  },
  {
    keys: ["牛顿", "newton", "受力", "f=ma", "加速度", "隔离"],
    title: "牛顿第二定律与受力分析",
    board: "力学",
    template: "受力",
    misconception: "非惯性系漏加惯性力；滑轮质量不可忽略时误用平动牛顿第二定律。",
    phases: {
      问题拆解: { text: "明确研究对象（隔离体），建立坐标系，列出所有作用力。" },
      概念辨析: {
        text: "牛顿第二定律 $\\mathbf F = m\\mathbf a$ 是动力学核心：合外力决定加速度，而非速度。",
        formulas: ["\\mathbf F = m\\mathbf a"],
      },
      数理推导: {
        text: "对隔离体列 $\\sum F_x = m a_x$、$\\sum F_y = m a_y$，代入已知量求解。",
        formulas: ["\\sum F_x = m a_x", "\\sum F_y = m a_y"],
      },
      图像分析: { text: "受力分析图展示各力方向；a-t / v-t 图反映加速度与速度变化。" },
      结论: { text: "隔离 → 受力图 → 坐标系 → $\\sum \\mathbf F=m\\mathbf a$，是动力学标准四步。" },
      易错点: { text: "漏画力或虚构力；在非惯性系中忘记引入惯性力。" },
    },
  },
  {
    keys: ["折射", "refraction", "斯涅尔", "snell"],
    title: "折射定律（斯涅尔定律）",
    board: "光学",
    template: "折射",
    misconception: "入射角 / 折射角均从法线量起，而非从界面量起；勿混淆 n₁、n₂ 的位置。",
    phases: {
      问题拆解: { text: "明确两介质折射率 $n_1,n_2$，以界面法线为基准量出入射角与折射角。" },
      概念辨析: { text: "光在界面发生折射是因为不同介质中光速不同；折射角相对法线的偏折由折射率决定。" },
      数理推导: {
        text: "斯涅尔定律 $n_1\\sin\\theta_1 = n_2\\sin\\theta_2$，由费马原理（光程极值）导出。",
        formulas: ["n_1\\sin\\theta_1 = n_2\\sin\\theta_2"],
      },
      图像分析: { text: "光路图显示入射光线、法线、折射光线分居法线两侧；从光疏到光密介质折射角变小。" },
      结论: { text: "折射角满足 $n_1\\sin\\theta_1 = n_2\\sin\\theta_2$；光密→光疏且角足够大时发生全反射。" },
      易错点: { text: "角度必须从法线量起；把 $n_1,n_2$ 写反会导致折射角方向判断错误。" },
    },
  },
  {
    keys: ["电场", "electric", "电荷偏转", "匀强电场"],
    title: "电荷在匀强电场中的偏转",
    board: "电磁学",
    template: "电场",
    misconception: "进入电场后速度方向改变但水平分量不变；偏转角不要与初速方向混淆。",
    phases: {
      问题拆解: { text: "粒子以初速 $v_0$ 垂直电场方向进入匀强电场，分解为垂直与平行电场两方向。" },
      概念辨析: { text: "平行电场方向不受力 → 匀速；垂直方向受恒力 $qE$ → 匀加速，类平抛运动。" },
      数理推导: {
        text: "水平 $x=v_0 t$，竖直 $y=\\tfrac12\\tfrac{qE}{m}t^2$，消去 $t$ 得抛物线轨迹。",
        formulas: ["x=v_0 t", "y=\\tfrac12\\tfrac{qE}{m}t^2"],
      },
      图像分析: { text: "轨迹为抛物线；速度方向逐点改变，水平分量保持 $v_0$。" },
      结论: { text: "电场中带电粒子做类平抛运动，偏移量 $y\\propto qE/m$。" },
      易错点: { text: "误以为进入电场后整体加速；实际仅垂直电场方向加速，平行方向速度恒定。" },
    },
  },
  {
    keys: ["简谐", "shm", "振动", "谐振", "弹簧"],
    title: "简谐振动的运动学特征",
    board: "力学",
    template: "简谐",
    misconception: "把振幅当成最大位移之外的量；混淆相位与初相；回复力正比位移而非速度。",
    phases: {
      问题拆解: { text: "判断系统是否满足「回复力正比于位移反向」，即 $F=-kx$。" },
      概念辨析: { text: "简谐振动是机械能守恒的周期运动，加速度 $a=-\\omega^2 x$ 始终指向平衡位置。" },
      数理推导: {
        text: "由 $\\ddot x+\\omega^2 x=0$ 解得 $x=A\\cos(\\omega t+\\phi)$，其中 $\\omega=\\sqrt{k/m}$。",
        formulas: ["x=A\\cos(\\omega t+\\phi)", "\\omega=\\sqrt{k/m}"],
      },
      图像分析: { text: "x-t 图为余弦曲线；速度、加速度相位依次落后 $\\pi/2$。" },
      结论: { text: "满足 $F=-kx$ 的系统做简谐振动，周期 $T=2\\pi\\sqrt{m/k}$。" },
      易错点: { text: "回复力与位移成正比反向，不是与速度相关；相位关系易错乱。" },
    },
  },
  {
    keys: ["卡诺", "热机", "carnot", "热力学效率", "熵"],
    title: "卡诺循环与效率上限",
    board: "热学",
    template: "卡诺",
    misconception: "实际热机因不可逆损失效率必低于卡诺；W 的符号约定（系统对外做功为正）。",
    phases: {
      问题拆解: { text: "明确高低温热源温度 $T_h,T_c$，考察可逆卡诺循环四步过程。" },
      概念辨析: { text: "卡诺循环由两个等温、两个绝热过程组成，是可逆热机效率的理论上限。" },
      数理推导: {
        text: "卡诺效率 $\\eta=1-T_c/T_h$，仅由两热源温度决定。",
        formulas: ["\\eta=1-\\frac{T_c}{T_h}"],
      },
      图像分析: { text: "p-V 图上为闭合曲线；循环包围面积等于一个周期净功。" },
      结论: { text: "任何实际热机效率都严格低于同温热源的卡诺效率。" },
      易错点: { text: "把 $\\eta$ 写成 $1-T_h/T_c$（分子分母颠倒）；忽略 W 的符号约定。" },
    },
  },
  {
    keys: ["波动", "波", "干涉", "行波", "驻波"],
    title: "行波与干涉的基本关系",
    board: "光学",
    template: "波动",
    misconception: "双缝间距 d 增大条纹变密（非变疏）；驻波节点振幅恒为零。",
    phases: {
      问题拆解: { text: "区分行波与驻波；确定波长 $\\lambda$、频率 $f$、波速 $v$ 的关系。" },
      概念辨析: { text: "行波携能传播，波形以波速 $v$ 平移；驻波由两列反向行波叠加，形成固定波节。" },
      数理推导: {
        text: "波速 $v=\\lambda f=\\omega/k$；双缝主极大 $d\\sin\\theta=m\\lambda$。",
        formulas: ["v=\\lambda f", "d\\sin\\theta=m\\lambda"],
      },
      图像分析: { text: "行波图为平移的正弦曲线；双缝干涉条纹等间距排列。" },
      结论: { text: "行波满足 $v=\\lambda f$；干涉主极大由光程差 $=m\\lambda$ 决定。" },
      易错点: { text: "误以为 d 增大条纹变疏；驻波节点处振幅恒为零而非最大。" },
    },
  },
  {
    keys: ["动量", "momentum", "冲量", "守恒"],
    title: "动量定理与动量守恒",
    board: "力学",
    template: "动量",
    misconception: "动量守恒前提是合外力为零；完全非弹性碰撞动能不守恒但动量守恒。",
    phases: {
      问题拆解: { text: "判断系统所受合外力是否为零，决定是否可用动量守恒。" },
      概念辨析: { text: "动量定理 $\\mathbf F\\Delta t=\\Delta\\mathbf p$；合外力为零时系统总动量守恒。" },
      数理推导: {
        text: "对系统列 $\\sum m_i v_i = \\text{const}$，碰撞问题优先用动量守恒。",
        formulas: ["\\sum \\mathbf p = \\text{const}"],
      },
      图像分析: { text: "碰撞前后 v-t 图可直观看出速度交换与共同速度。" },
      结论: { text: "合外力为零的系统动量守恒；碰撞优先列动量方程。" },
      易错点: { text: "在非孤立系统上套用动量守恒；混淆动能守恒（仅弹性碰撞）与动量守恒。" },
    },
  },
  {
    keys: ["运动学", "匀变速直线运动", "圆周运动", "相对运动", "参考系", "位移与路程", "kinematics", "uniformly accelerated motion", "circular motion", "galilean transformation"],
    title: "运动学：描述运动的语言与坐标变换",
    board: "力学",
    template: "匀加速",
    misconception: "位移是矢量（起点指向终点的有向线段），路程是标量路径长；平均速度=位移/时间，瞬时速度=位移对时间的导数，二者不可混用。",
    phases: {
      问题拆解: {
        text: "建立参考系与坐标系，明确位置矢量 $\\mathbf r(t)$、位移 $\\Delta\\mathbf r=\\mathbf r_2-\\mathbf r_1$、速度 $\\mathbf v=d\\mathbf r/dt$、加速度 $\\mathbf a=d\\mathbf v/dt$；区分位移（矢量）与路程（标量）。",
        formulas: ["\\mathbf v=\\frac{d\\mathbf r}{dt}", "\\mathbf a=\\frac{d\\mathbf v}{dt}"],
      },
      概念辨析: {
        text: "速度是位置对时间的一阶导数，加速度是速度对时间的一阶导数；加速度与速度方向无关，只反映速度变化的快慢与方向。匀速圆周运动速度大小不变但方向在变，故仍有向心加速度。",
        formulas: ["v=\\frac{ds}{dt}", "a_t=\\frac{dv}{dt}", "a_n=\\frac{v^2}{R}"],
      },
      数理推导: {
        text: "匀变速直线运动：$v=v_0+at$，$x=v_0t+\\tfrac12 at^2$，$v^2-v_0^2=2ax$；圆周运动角量与线量关系 $v=\\omega R$，$a_n=\\omega^2 R$。",
        formulas: ["v=v_0+at", "x=v_0t+\\tfrac12 at^2", "v^2-v_0^2=2ax", "v=\\omega R"],
      },
      图像分析: {
        text: "x-t 图斜率=速度，v-t 图斜率=加速度、图线面积=位移；圆周运动用极坐标描述，角速度 $\\omega=d\\theta/dt$。",
        formulas: ["v=\\frac{dx}{dt}", "\\omega=\\frac{d\\theta}{dt}"],
      },
      结论: {
        text: "运动学只描述『怎样动』，不解释『为何动』。掌握位移/速度/加速度的定义与图像语言，是后续动力学与能量分析的基础。",
      },
      易错点: {
        text: "位移≠路程（曲线或往返运动时差异显著）；平均速度≠瞬时速度；加速度为零不代表速度为零（匀速直线运动 a=0 但 v≠0）。",
      },
    },
  },
  {
    keys: ["能量守恒", "功能原理", "动能", "势能", "机械能", "功与功率", "弹性碰撞", "非弹性碰撞", "能量法", "energy conservation", "work-energy theorem", "kinetic energy", "potential energy", "mechanical energy"],
    title: "能量守恒：用能量视角替代牛顿第二定律",
    board: "力学",
    misconception: "只有保守力做功才对应势能变化；非保守力（如摩擦）做功等于机械能的损失。碰撞中动能是否守恒取决于弹性程度，但合外力为零时动量始终守恒。",
    phases: {
      问题拆解: {
        text: "明确系统边界，区分内力/外力、保守力/非保守力；列出各势能（重力、弹性、引力）与动能。",
        formulas: ["E_k=\\frac12 mv^2", "E_p=mgh", "E_p=\\frac12 kx^2"],
      },
      概念辨析: {
        text: "功 $W=\\int\\mathbf F\\cdot d\\mathbf r$，只有力在位移方向分量做功；保守力做功与路径无关，可定义势能 $E_p$ 使 $W_{\\text{保}}=-\\Delta E_p$。",
        formulas: ["W=\\int\\mathbf F\\cdot d\\mathbf r", "W_{\\text{保}}=-\\Delta E_p"],
      },
      数理推导: {
        text: "动能定理 $W_{\\text{总}}=\\Delta E_k$；功能原理 $W_{\\text{非保}}=E_2-E_1$；机械能守恒当且仅当 $W_{\\text{非保}}=0$。碰撞：弹性 $E_k$ 守恒、完全非弹性碰后共速。",
        formulas: ["W_{\\text{总}}=\\Delta E_k", "W_{\\text{非保}}=\\Delta E_{\\text{机}}", "m_1v_1+m_2v_2=(m_1+m_2)v"],
      },
      图像分析: {
        text: "F-x 图面积=功；能量法常将复杂受力过程转为初末状态能量差，避免逐点积分。",
        formulas: ["W=\\int F\\,dx"],
      },
      结论: {
        text: "能量法把『过程』问题化为『状态』比较，往往比列牛顿方程更简洁；合外力为零的系统动量守恒，非保守力不做功时机械能守恒。",
      },
      易错点: {
        text: "内力做功是否计入取决于系统选取；势能零点可任意选取但差值固定；完全非弹性碰撞动能不守恒（转化为内能）。",
      },
    },
  },
  {
    keys: ["刚体转动", "转动惯量", "力矩", "角动量", "定轴转动", "纯滚动", "平行轴定理", "垂直轴定理", "陀螺", "rigid body rotation", "moment of inertia", "torque", "angular momentum", "rolling without slipping"],
    title: "刚体定轴转动：转动惯量与角动量守恒",
    board: "力学",
    misconception: "纯滚动条件 v=ωR（无滑）；转动惯量不仅与质量有关，更与质量分布（到转轴距离）有关；角动量方向由右手定则判定。",
    phases: {
      问题拆解: {
        text: "确定转轴与转动自由度；计算转动惯量 $I$，列出力矩 $\\tau$ 与角动量 $L=I\\omega$。",
        formulas: ["I=\\int r^2\\,dm", "L=I\\omega", "\\tau=\\mathbf r\\times\\mathbf F"],
      },
      概念辨析: {
        text: "刚体定轴转动类比平动：$I$ 对应 $m$、$\\tau$ 对应 $F$、$L$ 对应 $p$、$\\omega$ 对应 $v$。转动动能 $E_k=\\tfrac12 I\\omega^2$。",
        formulas: ["E_k=\\tfrac12 I\\omega^2"],
      },
      数理推导: {
        text: "转动定律 $\\tau=I\\alpha$；平行轴定理 $I=I_c+Md^2$，垂直轴定理（薄板）$I_z=I_x+I_y$；纯滚动 $v=\\omega R$、$a=\\alpha R$。",
        formulas: ["\\tau=I\\alpha", "I=I_c+Md^2", "v=\\omega R"],
      },
      图像分析: {
        text: "力矩-角位移图面积=转动功；角动量守恒常见于无外力矩系统（如旋转椭球变化）。",
        formulas: ["W_{\\text{转}}=\\int\\tau\\,d\\theta"],
      },
      结论: {
        text: "刚体转动用『转动惯量+力矩+角动量』三件套，平动的所有守恒律都有对应转动版本；无外力矩时角动量守恒。",
      },
      易错点: {
        text: "纯滚动必须同时满足 $v=\\omega R$（易漏）；转动惯量计算错误（未用平行轴定理）；角动量方向判断（右手定则）。",
      },
    },
  },
  {
    keys: ["单摆", "共振", "多普勒效应", "相位", "旋转矢量法", "受迫振动", "阻尼振动", "机械振动", "机械波", "oscillation", "resonance", "doppler effect", "simple pendulum", "damped vibration"],
    title: "振动与波：周期运动的描述与传播",
    board: "力学",
    template: "波动",
    misconception: "相位是振动的『瞬时状态』（含初相）；驻波节点振幅恒为零、波腹振幅最大；多普勒效应中速度符号需带正负（靠近为正）。",
    phases: {
      问题拆解: {
        text: "判断振动类型（自由/阻尼/受迫），写出位移方程 $x=A\\cos(\\omega t+\\phi)$；对波明确波长 $\\lambda$、频率 $f$、波速 $v$。",
        formulas: ["x=A\\cos(\\omega t+\\phi)", "v=\\lambda f"],
      },
      概念辨析: {
        text: "简谐振动满足 $a=-\\omega^2 x$（回复力正比位移反向）；波是振动状态的传播，行波携能、驻波由两反向行波叠加形成固定波节。",
        formulas: ["a=-\\omega^2 x"],
      },
      数理推导: {
        text: "弹簧振子 $\\omega=\\sqrt{k/m}$，单摆小角 $\\omega=\\sqrt{g/l}$；旋转矢量法用圆周运动投影表示相位；多普勒 $f' = f\\frac{v\\pm v_o}{v\\mp v_s}$。",
        formulas: ["\\omega=\\sqrt{k/m}", "\\omega=\\sqrt{g/l}", "f'=f\\frac{v\\pm v_o}{v\\mp v_s}"],
      },
      图像分析: {
        text: "x-t 图为正弦/余弦曲线，相位依次决定速度、加速度；驻波波节间距 $\\lambda/2$。",
        formulas: ["\\Delta x_{\\text{节}}=\\lambda/2"],
      },
      结论: {
        text: "振动用振幅/频率/相位三参数描述，波满足 $v=\\lambda f$；共振发生在驱动频率接近固有频率；多普勒效应由相对运动改变观测频率。",
      },
      易错点: {
        text: "相位与初相混淆；驻波节点振幅为零（非最大）；多普勒速度符号（靠近声源/观察者速度取正）。",
      },
    },
  },
  {
    keys: ["静电场", "静电", "库仑定律", "高斯定理", "电势", "电势能", "点电荷", "偶极子", "电容器", "electrostatic", "coulomb", "gauss", "electric potential"],
    title: "静电场：场强、电势与高斯定理",
    board: "电磁学",
    misconception: "电场强度方向是正电荷受力方向（电势降低最快方向）；场强为零处电势不一定为零；高斯面选取要利用对称性。",
    phases: {
      问题拆解: {
        text: "明确源电荷分布，建立电场强度 $\\mathbf E$ 与电势 $V$ 的关系；选取合适高斯面或叠加法。",
        formulas: ["\\mathbf E=\\frac{\\mathbf F}{q}", "V=\\frac{E_p}{q}"],
      },
      概念辨析: {
        text: "电场是物质存在形式，电场强度 $\\mathbf E$ 描述力的属性，电势 $V$ 描述能的属性，二者满足 $\\mathbf E=-\\nabla V$（场强指向电势降落最快方向）。",
        formulas: ["\\mathbf E=-\\nabla V"],
      },
      数理推导: {
        text: "库仑定律 $\\mathbf F=k\\frac{q_1q_2}{r^2}\\hat r$；点电荷场强 $E=k\\frac{Q}{r^2}$；高斯定理 $\\oint\\mathbf E\\cdot d\\mathbf S=Q_{\\text{内}}/\\varepsilon_0$；电容器 $C=\\varepsilon S/d$。",
        formulas: ["\\mathbf F=k\\frac{q_1q_2}{r^2}\\hat r", "E=k\\frac{Q}{r^2}", "\\oint\\mathbf E\\cdot d\\mathbf S=\\frac{Q_{\\text{内}}}{\\varepsilon_0}", "C=\\frac{\\varepsilon S}{d}"],
      },
      图像分析: {
        text: "电场线从正电荷出发终于负电荷，疏密表场强；等势面与电场线垂直。",
      },
      结论: {
        text: "静电场是有势场，高斯定理是求对称分布场强的利器；电势可叠加，电容器储能 $W=\\tfrac12 CV^2$。",
        formulas: ["W=\\tfrac12 CV^2"],
      },
      易错点: {
        text: "场强与电势方向关系误判；高斯面选取不当导致无法化简；介质极化电荷符号错误。",
      },
    },
  },
  {
    keys: ["恒定电流", "电路分析", "欧姆定律", "电阻", "电动势", "基尔霍夫定律", "戴维南定理", "电桥", "RC电路", "RL电路", "circuit", "current", "resistance", "ohm", "kirchhoff", "thevenin"],
    title: "恒定电流：电路分析与等效定理",
    board: "电磁学",
    template: "电路",
    misconception: "电动势是电源把其他能转化为电能的本领（非电势差）；处理含内阻电源时勿漏内阻；暂态过程初始条件决定常数。",
    phases: {
      问题拆解: {
        text: "画出电路拓扑，标出电阻、电源（含内阻）、节点；选择节点电压法或网孔电流法列方程。",
        formulas: ["I=\\frac{U}{R}", "\\mathcal E=IR+Ir"],
      },
      概念辨析: {
        text: "电流密度 $\\mathbf j=\\sigma\\mathbf E$；欧姆定律微分形式 $\\mathbf j=\\sigma\\mathbf E$；电动势 $\\mathcal E$ 反映非静电力做功，沿内电路提升电势。",
        formulas: ["\\mathbf j=\\sigma\\mathbf E"],
      },
      数理推导: {
        text: "基尔霍夫电流定律（节点 $\\sum I=0$）、电压定律（回路 $\\sum\\mathcal E=\\sum IR$）；戴维南等效为电压源+串联电阻；电桥平衡 $R_1R_4=R_2R_3$。",
        formulas: ["\\sum I=0", "\\sum\\mathcal E=\\sum IR", "R_1R_4=R_2R_3"],
      },
      图像分析: {
        text: "RC 充电 $q=C\\mathcal E(1-e^{-t/RC})$，放电 $q=Q_0e^{-t/RC}$；时间常数 $\\tau=RC$。",
        formulas: ["q=C\\mathcal E(1-e^{-t/RC})", "\\tau=RC"],
      },
      结论: {
        text: "直流电路核心是基尔霍夫两定律与等效变换；暂态电路用一阶微分方程，时间常数决定快慢。",
      },
      易错点: {
        text: "电动势与端电压概念混淆；内阻处理遗漏；RC/RL 暂态初始条件（电容电压、电感电流不能突变）设错。",
      },
    },
  },
  {
    keys: ["磁感应强度", "洛伦兹力", "安培力", "毕奥萨伐尔定律", "磁矩", "霍尔效应", "安培环路定理", "magnetostatics", "lorentz force", "ampere force", "magnetic dipole"],
    title: "磁场：安培力、洛伦兹力与毕奥-萨伐尔定律",
    board: "电磁学",
    template: "磁场",
    misconception: "洛伦兹力永远不做功（只改变速度方向、不改变速率）；安培力是洛伦兹力的宏观表现；霍尔电压正负判断载流子类型。",
    phases: {
      问题拆解: {
        text: "明确磁场分布与载流/带电体的几何关系，确定磁场方向（右手定则）与力方向（$\\mathbf F=q\\mathbf v\\times\\mathbf B$）。",
        formulas: ["\\mathbf F=q\\mathbf v\\times\\mathbf B", "\\mathbf F=I\\mathbf l\\times\\mathbf B"],
      },
      概念辨析: {
        text: "磁感应强度 $\\mathbf B$ 描述磁场；洛伦兹力垂直于速度与磁场所成平面，故不做功；安培力是导体中定向运动电荷所受洛伦兹力的宏观合力。",
        formulas: ["\\mathbf F_{\\text{洛}}=q\\mathbf v\\times\\mathbf B"],
      },
      数理推导: {
        text: "毕奥-萨伐尔 $d\\mathbf B=\\frac{\\mu_0}{4\\pi}\\frac{I d\\mathbf l\\times\\hat r}{r^2}$；长直导线 $B=\\frac{\\mu_0 I}{2\\pi r}$；圆环中心 $B=\\frac{\\mu_0 I}{2R}$；带电粒子圆周 $R=\\frac{mv}{qB}$。",
        formulas: ["d\\mathbf B=\\frac{\\mu_0}{4\\pi}\\frac{I d\\mathbf l\\times\\hat r}{r^2}", "B=\\frac{\\mu_0 I}{2\\pi r}", "R=\\frac{mv}{qB}"],
      },
      图像分析: {
        text: "安培环路定理 $\\oint\\mathbf B\\cdot d\\mathbf l=\\mu_0 I_{\\text{内}}$ 用于对称场；磁矩 $\\mathbf m=I\\mathbf S$ 在磁场中受力矩。",
        formulas: ["\\oint\\mathbf B\\cdot d\\mathbf l=\\mu_0 I_{\\text{内}}", "\\mathbf m=I\\mathbf S"],
      },
      结论: {
        text: "磁场对运动电荷施洛伦兹力（不做功），对电流施安培力；对称磁场用安培环路定理，任意电流用毕奥-萨伐尔积分。",
      },
      易错点: {
        text: "误以为洛伦兹力改变速率（其实只改方向）；磁化方向判断错误；霍尔效应中载流子正负导致电压极性相反。",
      },
    },
  },
  {
    keys: ["电磁感应", "法拉第定律", "楞次定律", "自感", "互感", "涡流", "电磁阻尼", "交流电", "动生电动势", "感生电动势", "变压器", "electromagnetic induction", "faraday", "lenz", "self-inductance", "mutual inductance"],
    title: "电磁感应：法拉第定律与楞次定律",
    board: "电磁学",
    template: "磁场",
    misconception: "感应电动势方向由楞次定律『阻碍变化』判定（增反减同/来拒去留）；动生电动势用 $\\mathcal E=Blv$、感生电动势用涡旋电场；自感暂态电流不能突变。",
    phases: {
      问题拆解: {
        text: "判断磁通量变化来源（面积变/磁场变/夹角变），区分动生与感生电动势，确定回路与参考方向。",
        formulas: ["\\Phi=\\int\\mathbf B\\cdot d\\mathbf S"],
      },
      概念辨析: {
        text: "法拉第定律 $\\mathcal E=-d\\Phi/dt$，负号体现楞次定律（感应电流阻碍磁通变化）；动生源于洛伦兹力分量，感生源于变化磁场激发的涡旋电场。",
        formulas: ["\\mathcal E=-\\frac{d\\Phi}{dt}"],
      },
      数理推导: {
        text: "动生 $\\mathcal E=Blv$（导体切割磁感线）；长直螺线管自感 $L=\\mu_0 n^2 V$；RL 电路电流 $i=\\frac{\\mathcal E}{R}(1-e^{-t/\\tau})$，$\\tau=L/R$。",
        formulas: ["\\mathcal E=Blv", "L=\\mu_0 n^2 V", "i=\\frac{\\mathcal E}{R}(1-e^{-t/\\tau})", "\\tau=L/R"],
      },
      图像分析: {
        text: "i-t 图呈指数上升/衰减；变压器靠互感实现电压变换 $U_1/U_2=N_1/N_2$。",
        formulas: ["\\frac{U_1}{U_2}=\\frac{N_1}{N_2}"],
      },
      结论: {
        text: "电磁感应核心是磁通变化率；楞次定律提供方向，能量守恒要求感应电流『反抗』诱因；交流电路常用复数法求解。",
      },
      易错点: {
        text: "动生/感生电动势方向判断错误；自感暂态初始条件（电流不能突变）；互感符号（同名端）混淆。",
      },
    },
  },
  {
    keys: ["热力学", "温度", "热量", "内能", "热力学第一定律", "热力学第二定律", "可逆过程", "理想气体", "状态方程", "thermodynamics", "temperature", "heat", "internal energy", "first law of thermodynamics", "second law of thermodynamics", "ideal gas"],
    title: "热力学：第一定律、第二定律与熵",
    board: "热学",
    template: "pv",
    misconception: "热量是过程量（传递的能量），温度是状态量；等温/绝热/等压/等容过程莫混淆；熵是状态量，孤立系统熵不减。",
    phases: {
      问题拆解: {
        text: "明确研究系统（气体），确定初末状态参量 $p,V,T$，判别过程类型（等温/等压/等容/绝热）。",
        formulas: ["pV=nRT"],
      },
      概念辨析: {
        text: "内能 $U$ 是状态函数（理想气体仅取决于 $T$）；热量 $Q$ 与功 $W$ 是过程量；第一定律 $\\Delta U=Q-W$（系统对外做功为正）。",
        formulas: ["\\Delta U=Q-W"],
      },
      数理推导: {
        text: "理想气体状态方程 $pV=nRT$；等温 $pV=\\text{const}$，绝热 $pV^\\gamma=\\text{const}$（$\\gamma=C_p/C_v$）；循环效率 $\\eta=W/Q_h$。",
        formulas: ["pV=nRT", "pV^\\gamma=\\text{const}", "\\eta=\\frac{W}{Q_h}"],
      },
      图像分析: {
        text: "p-V 图过程曲线下面积=功；循环曲线包围面积=净功；绝热线比等温线更陡。",
      },
      结论: {
        text: "热力学第一定律约束能量收支，第二定律（熵增/不可逆）限定方向与限度；理想气体过程用状态方程 + 过程方程联立。",
      },
      易错点: {
        text: "热量与温度概念混淆（热量非『热的数量』）；四个过程方程记混；误以为熵是过程量（熵是状态量，孤立系统不减）。",
      },
    },
  },
  {
    keys: ["光学", "光的反射", "全反射", "衍射", "偏振", "光程", "费马原理", "薄透镜成像", "半波损失", "optics", "reflection", "diffraction", "polarization", "fermat"],
    title: "光学：几何光学与波动光学基础",
    board: "光学",
    template: "波动",
    misconception: "半波损失发生在光从光疏→光密界面反射时；光程=折射率×几何路程（nL），干涉看光程差而非几何差；偏振方向需明确振动方向。",
    phases: {
      问题拆解: {
        text: "区分几何光学（反射/折射/成像）与波动光学（干涉/衍射/偏振）；确定介质折射率与界面几何。",
        formulas: ["n_1\\sin\\theta_1=n_2\\sin\\theta_2", "\\text{光程}=nL"],
      },
      概念辨析: {
        text: "费马原理：光沿光程取极值的路径传播；惠更斯原理：波前每点作子波源；相干条件为同频、同振动方向、固定相位差。",
        formulas: ["\\delta=\\sum n_i L_i"],
      },
      数理推导: {
        text: "反射定律 $\\theta_i=\\theta_r$；折射定律 $n_1\\sin\\theta_1=n_2\\sin\\theta_2$；双缝主极大 $d\\sin\\theta=m\\lambda$；薄膜 $2n d\\cos r + \\lambda/2 = m\\lambda$。",
        formulas: ["\\theta_i=\\theta_r", "n_1\\sin\\theta_1=n_2\\sin\\theta_2", "d\\sin\\theta=m\\lambda"],
      },
      图像分析: {
        text: "光路图体现反射/折射几何；干涉条纹等间距（双缝 $\\Delta x=\\lambda D/d$）；单缝衍射暗纹 $a\\sin\\theta=k\\lambda$。",
        formulas: ["\\Delta x=\\frac{\\lambda D}{d}", "a\\sin\\theta=k\\lambda"],
      },
      结论: {
        text: "几何光学用费马/折射定律，波动光学用光程差判干涉；全反射条件 $n_1>n_2$ 且 $\\theta_1>\\theta_c$。",
      },
      易错点: {
        text: "半波损失漏加 $\\lambda/2$；光程与几何路程混淆；相干长度不足导致无稳定干涉；偏振方向判断错误。",
      },
    },
  },
  {
    keys: ["近代物理", "光电效应", "康普顿散射", "波粒二象性", "德布罗意波", "不确定关系", "薛定谔方程", "原子结构", "核反应", "质能方程", "相对论效应", "modern physics", "photoelectric effect", "compton", "de broglie", "wave-particle duality", "uncertainty principle", "schrodinger"],
    title: "近代物理：相对论、量子与原子核",
    board: "近代物理",
    misconception: "『相对论质量』概念已过时（用能量-动量关系替代）；康普顿散射波长变长（光子把部分能量交给电子）；核反应 Q 值正为放能。",
    phases: {
      问题拆解: {
        text: "区分相对论效应与量子现象；明确微观过程（光电/康普顿/衰变）的守恒量（能量、动量、电荷、核子数）。",
        formulas: ["E=mc^2", "E^2=p^2c^2+m_0^2c^4"],
      },
      概念辨析: {
        text: "波粒二象性：光子/电子兼具波动与粒子性；德布罗意关系 $\\lambda=h/p$；不确定关系 $\\Delta x\\Delta p\\ge\\hbar/2$ 是原理性限制而非测量误差。",
        formulas: ["\\lambda=\\frac{h}{p}", "\\Delta x\\Delta p\\ge\\frac{\\hbar}{2}"],
      },
      数理推导: {
        text: "光电效应 $h\\nu=W+\\tfrac12 mv^2$；康普顿 $\\Delta\\lambda=\\frac{h}{m_ec}(1-\\cos\\theta)$；氢原子能级 $E_n=-\\frac{13.6\\,\\text{eV}}{n^2}$；质能方程 $E=mc^2$。",
        formulas: ["h\\nu=W+\\tfrac12 mv^2", "\\Delta\\lambda=\\frac{h}{m_ec}(1-\\cos\\theta)", "E_n=-\\frac{13.6\\,\\text{eV}}{n^2}", "E=mc^2"],
      },
      图像分析: {
        text: "氢原子能级图（分立能级、跃迁发光/吸光）；核反应用质量亏损求 Q 值 $Q=\\Delta m c^2$。",
        formulas: ["Q=\\Delta m c^2"],
      },
      结论: {
        text: "近代物理以相对论与量子论为基石：微观过程用能量+动量守恒处理，量子系统状态由薛定谔方程演化，原子能级分立。",
      },
      易错点: {
        text: "沿用『相对论质量』（应改用能量-动量关系）；康普顿波长变化方向（散射后变长）；核反应 Q 值符号（正为放能、负为吸能）。",
      },
    },
  },
];

function matchExplainTopic(message: string): ExplainTopic | null {
  const text = (message || "").toLowerCase();
  let best: ExplainTopic | null = null;
  let bestLen = 0;
  for (const topic of OFFLINE_EXPLAIN_TOPICS) {
    for (const kw of topic.keys) {
      const kwl = kw.toLowerCase();
      if (kwl.length > bestLen && text.includes(kwl)) {
        best = topic;
        bestLen = kwl.length;
      }
    }
  }
  return best;
}

function stripPrefix(message: string): string {
  let t = (message || "").trim();
  t = t.replace(
    /^(请|帮我|能否|我想|如何|怎么|为什么|为何|什么是|讲讲|说说|解释一下|讲解一下|分析一下|理解一下)[\s:：]*/i,
    "",
  );
  t = t.replace(/[？?。.!！~～\s]+$/g, "").trim();
  return t;
}
function deriveTitle(message: string): string {
  const t = stripPrefix(message);
  return t ? `「${t}」物理讲解` : "物理讲解";
}
function inferKeyword(message: string): string {
  return stripPrefix(message).slice(0, 2);
}
function genericPhase(phase: ExplainPhase, title: string, board: string): string {
  switch (phase) {
    case "问题拆解":
      return `针对「${title}」，先明确已知量、所求量与约束条件，判断其所属板块为「${board}」。`;
    case "概念辨析":
      return "回顾该问题涉及的核心物理概念，建立清晰的物理图像，区分相关与无关因素。";
    case "数理推导":
      return "列出适用的定律与公式，按「隔离体 → 方程 → 求解」的链路逐步推导，保留符号到最后再代入。";
    case "图像分析":
      return "如适用，画出过程图像（v-t 图、轨迹、光路或 p-V 图等）辅助理解变量关系。";
    case "结论":
      return "综合上述分析给出结论，并用量纲分析与极限特例（如 θ→0、m→∞）做自检。";
    case "易错点":
      return "注意常见误区：符号正负约定、过程方向判断、近似条件（如小角、理想气体）的适用范围。";
    default:
      return "";
  }
}
function genericMisconception(board: string): string {
  return `围绕「${board}」的常见误区：注意符号约定、近似条件与过程方向的判断。`;
}

function buildSixPhases(
  topic: ExplainTopic | null,
  sources: string[],
  message: string,
): ExplainStep[] {
  const title = topic?.title ?? deriveTitle(message);
  const board: Board = topic?.board ?? findBoardByKeyword(message) ?? "力学";
  const kw = topic ? (topic.template ?? topic.keys[0]) : inferKeyword(message);
  const tpl = lookupTemplate(kw);
  const sourceRefs = sources.length > 0 ? sources : undefined;
  return EXPLAIN_PHASES.map((phase, i) => {
    const tp = topic?.phases[phase];
    const text = tp?.text ?? genericPhase(phase, title, board);
    const heading = tp ? `${phase}` : phase;
    const diagram =
      phase === "图像分析" && tpl?.diagram ? validateDiagramSpec(tpl.diagram) : null;
    const animation =
      phase === "图像分析" && tpl?.animation ? validateAnimationSpec(tpl.animation) : null;
    const misconception =
      phase === "易错点" ? (topic?.misconception ?? genericMisconception(board)) : null;
    return {
      id: `s${i + 1}`,
      phase,
      heading,
      text,
      formulas: tp?.formulas,
      diagram,
      animation,
      misconception,
      sourceRefs,
    };
  });
}

/** 离线讲解器：六阶段装配 + 预置图 / 动画 + 教材引用（首版，零依赖）。 */
export async function generateExplainOffline(
  message: string,
  _studentId: string,
): Promise<PomosExplainV1> {
  const topic = matchExplainTopic(message);
  const hits = searchTextbooks(message, 4);
  const sources = Array.from(
    new Set(
      hits
        .map((h) => h.example?.source ?? `${h.textbook.title}·${h.chapter.title}`)
        .filter((s): s is string => !!s),
    ),
  );
  const steps = buildSixPhases(topic, sources, message);
  return {
    schema_version: "1.0",
    title: topic?.title ?? deriveTitle(message),
    mode: "offline",
    steps,
    sources: sources.length > 0 ? sources : undefined,
  };
}
