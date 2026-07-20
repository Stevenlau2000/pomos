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
