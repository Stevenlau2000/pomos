"""LLM 接入层（多供应商支持）。

设计要点：
- 支持 OpenAI / DeepSeek / 通义千问 / Kimi / 智谱GLM / Gemini / Claude 等多家模型。
- 所有「OpenAI 兼容」端点（DeepSeek、通义千问、Kimi、智谱GLM、Gemini）共用 openai SDK，
  仅 base_url 与 key 不同；Claude 走原生 anthropic SDK（懒加载）。
- LLM_PROVIDER 显式指定优先级最高；留空时按注册表顺序自动探测已配置的 key。
- 全部 SDK 懒加载：即使未安装对应包，模块导入也不会失败，缺少时对应供应商不可用。
- 无任何可用 key 时，返回离线 mock 文本，保证整条链路不报错。
对应 POMOS 规范的 LLM 接入层（非独立模块）。
"""
from __future__ import annotations

import asyncio

from app.config import settings


# ----------------------------------------------------------------- 供应商注册表
# name -> 配置（env 读取的 key 名、OpenAI 兼容 base_url、默认模型、是否原生 Claude）
PROVIDERS: dict[str, dict] = {
    "openai": {
        "env_key": "openai_api_key",
        "base_url": "https://api.openai.com/v1",
        "default_model": "gpt-4o",
        "native": "openai",
    },
    "deepseek": {
        "env_key": "deepseek_api_key",
        "base_url": "https://api.deepseek.com/v1",
        "default_model": "deepseek-chat",
        "native": "openai",
    },
    "qwen": {
        "env_key": "dashscope_api_key",
        "base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1",
        "default_model": "qwen-max",
        "native": "openai",
    },
    "moonshot": {
        "env_key": "moonshot_api_key",
        "base_url": "https://api.moonshot.cn/v1",
        "default_model": "moonshot-v1-8k",
        "native": "openai",
    },
    "zhipu": {
        "env_key": "zhipu_api_key",
        "base_url": "https://open.bigmodel.cn/api/paas/v4",
        "default_model": "glm-4",
        "native": "openai",
    },
    "gemini": {
        "env_key": "gemini_api_key",
        "base_url": "https://generativelanguage.googleapis.com/v1beta/openai/",
        "default_model": "gemini-1.5-pro",
        "native": "openai",
    },
    "anthropic": {
        "env_key": "anthropic_api_key",
        "base_url": "",
        "default_model": "claude-sonnet-4-20250514",
        "native": "anthropic",
    },
}

# 自动探测优先级（custom 需手动指定，不参与探测）
_AUTO_ORDER = ["openai", "deepseek", "qwen", "moonshot", "zhipu", "gemini", "anthropic"]


def _resolve_provider() -> str | None:
    """解析当前应使用的供应商。

    返回供应商名；若显式指定 custom 且配置了 base_url/key 则返回 custom；
    若显式指定了其它已知供应商（无论是否配 key）则尊重用户意图；
    否则按自动探测顺序找第一个有 key 的供应商；都没有返回 None。
    """
    explicit = (settings.llm_provider or "").strip().lower()

    if explicit == "custom":
        if settings.llm_base_url and settings.llm_api_key:
            return "custom"
        return None  # 配了 custom 但缺参数，等同未配置

    if explicit:
        # 尊重用户显式指定（即便该 key 为空，也按该供应商尝试，失败再 mock）
        return explicit if explicit in PROVIDERS else None

    # 自动探测
    for name in _AUTO_ORDER:
        if getattr(settings, PROVIDERS[name]["env_key"], ""):
            return name
    return None


def active_provider() -> str | None:
    """当前生效的供应商（供 /api/health 展示）。"""
    return _resolve_provider()


def is_mock() -> bool:
    """当前是否处于 mock 模式（无可用供应商 key）。"""
    return _resolve_provider() is None


def active_model() -> str:
    """当前生效的模型名（显式指定优先，否则供应商默认）。"""
    provider = _resolve_provider()
    if not provider:
        return "(mock)"
    if settings.llm_model:
        return settings.llm_model
    if provider == "custom":
        return "(custom-model)"
    return PROVIDERS[provider]["default_model"]


# ----------------------------------------------------------------- 客户端缓存
_openai_clients: dict[str, object] = {}
_anthropic_client: object | None = None


def _get_openai_client(base_url: str, api_key: str):
    """构造（或复用）OpenAI 兼容异步客户端；失败返回 None。"""
    cache_key = f"{base_url}|{api_key[:6]}"
    client = _openai_clients.get(cache_key)
    if client is None:
        try:
            from openai import AsyncOpenAI

            client = AsyncOpenAI(api_key=api_key, base_url=base_url)
            _openai_clients[cache_key] = client
        except Exception:
            return None
    return client


def _get_anthropic_client(api_key: str):
    """构造（或复用）Anthropic 异步客户端；失败返回 None。"""
    global _anthropic_client
    if _anthropic_client is None:
        try:
            from anthropic import AsyncAnthropic

            _anthropic_client = AsyncAnthropic(api_key=api_key)
        except Exception:
            return None
    return _anthropic_client


# ----------------------------------------------------------------- 离线物理教练（无 key 也能用）
# 关键词 -> 主题知识库。每条含 zh/en 双语讲解、核心公式与一道苏格拉底追问。
# 仅在未配置任何 LLM 密钥时启用，保证「开箱即教练」，而非返回占位符。
_OFFLINE_KB: list[dict] = [
    {
        "keys": ["微扰", "perturbation", "微扰论"],
        "zh": "微扰论用于求解哈密顿量 H=H₀+V、且 V 远小于 H₀ 时的近似本征值。\n"
             "• 一阶能量修正：ΔEₙ⁽¹⁾ = ⟨n|V|n⟩（在未微扰本征态 n 上的期望值）。\n"
             "• 一阶波函数修正：|n⟩ → |n⟩ + Σₘ≠ₙ ⟨m|V|n⟩/(Eₙ−Eₘ)·|m⟩。\n"
             "• 简并微扰需先对简并子空间对角化 V，再非简并处理。\n"
             "先问自己：V 相对能级差 Eₙ−Eₘ 是否足够小？哪些态会强烈混合？",
        "en": "Perturbation theory approximates eigenvalues of H=H₀+V when V≪H₀.\n"
             "• 1st-order energy: ΔEₙ⁽¹⁾ = ⟨n|V|n⟩ (expectation in the unperturbed state).\n"
             "• 1st-order state: |n⟩ → |n⟩ + Σₘ≠ₙ ⟨m|V|n⟩/(Eₙ−Eₘ)·|m⟩.\n"
             "• Degenerate case: diagonalise V in the degenerate subspace first.\n"
             "Ask: is V small vs the level spacing Eₙ−Eₘ? Which states mix strongly?",
        "q": "若二级修正 ΔEₙ⁽²⁾ = Σₘ≠ₙ |⟨m|V|n⟩|²/(Eₙ−Eₘ)，当某 Eₘ→Eₙ 时会发生什么？",
    },
    {
        "keys": ["牛顿", "newton", "动力学", "受力", "f=ma", "加速度"],
        "zh": "牛顿第二定律 F=dp/dt；质量恒定时 F=ma，是动力学核心方程。\n"
             "• 隔离物体→画受力图→选坐标系→列 ΣF=ma。\n"
             "• 注意惯性系：非惯性系需引入惯性力（离心/科里奥利）。\n"
             "先问：你选的坐标系是否让分量方程最简单？约束反力方向对吗？",
        "en": "Newton's 2nd law: F=dp/dt; for constant mass F=ma — the heart of dynamics.\n"
             "• Isolate the body → free-body diagram → choose axes → ΣF=ma.\n"
             "• In non-inertial frames add fictitious forces (centrifugal/Coriolis).\n"
             "Ask: does your coordinate choice minimise components? Are constraint directions right?",
        "q": "滑轮质量不可忽略时，张力两侧还相等吗？为什么？",
    },
    {
        "keys": ["动量", "momentum", "冲量", "守恒"],
        "zh": "动量定理 FΔt=Δp；系统合外力为零时总动量守恒 Σp=const。\n"
             "• 碰撞问题优先列动量守恒；是否动能守恒区分弹性/非弹性。\n"
             "• 变质量（火箭）用 dp/dt = u·dm/dt 处理。\n"
             "先问：你取的系统是否合外力为零？有没有隐藏的外冲量？",
        "en": "Impulse-momentum: FΔt=Δp; total momentum conserved when net external force=0.\n"
             "• For collisions use momentum conservation; KE conservation separates elastic/inelastic.\n"
             "• Variable mass (rocket): dp/dt = u·dm/dt.\n"
             "Ask: is your system force-free? Any hidden external impulse?",
        "q": "完全非弹性碰撞后动能去哪了？动量为何仍守恒？",
    },
    {
        "keys": ["能量", "energy", "机械能", "功", "势能", "守恒"],
        "zh": "功能关系 W=ΔE；保守力对应势能 Ep，机械能 E=Ek+Ep 在无耗散时守恒。\n"
             "• 常用：动能 ½mv²、重力 mgh、弹性 ½kx²、引力 −GMm/r。\n"
             "• 含摩擦时机械能→内能，用能量法常比牛顿法更简。\n"
             "先问：哪些力做功？能否用势能把力‘藏’进能量？",
        "en": "Work-energy: W=ΔE; conservative forces have potential Ep; E=Ek+Ep conserved without dissipation.\n"
             "• Ek=½mv², gravitational mgh, spring ½kx², gravitational −GMm/r.\n"
             "• With friction, mechanical energy → internal; energy method is often simpler.\n"
             "Ask: which forces do work? Can you ‘hide’ a force inside a potential?",
        "q": "单摆最低点速度用能量法如何最简求得？小角近似下运动方程是什么？",
    },
    {
        "keys": ["角动量", "angular momentum", "转动", "刚体", "rotate", "torque"],
        "zh": "角动量 L=r×p；对固定点 dL/dt=M（合外力矩）。合外力矩为零时 L 守恒。\n"
             "• 刚体定轴转动：L=Iω，转动定律 M=Iα。\n"
             "• 平行轴定理 I=I_cm+m d²；垂直轴定理（薄板）I_z=I_x+I_y。\n"
             "先问：你取矩的参考点选在哪？取质心可消去平动耦合。",
        "en": "Angular momentum L=r×p; dL/dt=M (net torque) about a fixed point; L conserved if M=0.\n"
             "• Rigid body: L=Iω, M=Iα.\n"
             "• Parallel-axis: I=I_cm+m d²; perpendicular-axis (lamina): I_z=I_x+I_y.\n"
             "Ask: about which point do you take torques? The COM decouples translation.",
        "q": "花样滑冰收臂转速为何增大？若人在转动杆上爬行，L 与 ω 如何变？",
    },
    {
        "keys": ["简谐", "shm", "振动", "谐振", "spring", "周期"],
        "zh": "简谐振动满足 x¨+ω²x=0，解 x=A cos(ωt+φ)，ω=√(k/m)（弹簧）或 √(g/l)（单摆小角）。\n"
             "• 能量 E=½kA² 守恒；相位差：速度比位移超前 π/2。\n"
             "• 受迫振动在 ω→ω₀ 时发生共振。\n"
             "先问：恢复力是否正比于位移？这是判断 SHM 的充要条件。",
        "en": "SHM satisfies x¨+ω²x=0, solution x=A cos(ωt+φ); ω=√(k/m) (spring) or √(g/l) (pendulum, small).\n"
             "• Energy E=½kA² constant; velocity leads displacement by π/2.\n"
             "• Forced oscillation resonates as ω→ω₀.\n"
             "Ask: is the restoring force proportional to displacement? That is SHM's defining test.",
        "q": "两个同频简谐振动同方向叠加，振幅何时最大、何时为零？",
    },
    {
        "keys": ["波动", "波", "干涉", "衍射", "wave", "interference", "光栅"],
        "zh": "行波 y=A cos(kx−ωt)，k=2π/λ，波速 v=ω/k=λf。\n"
             "• 双缝干涉亮纹 d sinθ=mλ；光栅主极大 d sinθ=mλ。\n"
             "• 驻波由反向行波叠加，节点处振幅恒为零。\n"
             "先问：你描述的是行波还是驻波？相位差如何随位置变化？",
        "en": "Travelling wave y=A cos(kx−ωt), k=2π/λ, v=ω/k=λf.\n"
             "• Double-slit bright: d sinθ=mλ; grating principal maxima same form.\n"
             "• Standing waves = counter-propagating waves; nodes have zero amplitude.\n"
             "Ask: travelling or standing? How does phase difference vary with position?",
        "q": "若双缝间距 d 增大，干涉条纹会变密还是变疏？为什么？",
    },
    {
        "keys": ["电路", "circuit", "基尔霍夫", "电阻", "欧姆", "rc", "rl"],
        "zh": "基尔霍夫定律：节点电流代数和为零（KCL）；回路电压代数和为零（KVL）。\n"
             "• 串联 R 相加，并联 1/R=Σ1/Rᵢ；电容 C 并联相加、串联倒数加。\n"
             "• RC 暂态 τ=RC，按指数趋近稳态。\n"
             "先问：能否用等效电阻/戴维南把网络化简？",
        "en": "Kirchhoff: ΣI=0 at a node (KCL); ΣV=0 around a loop (KVL).\n"
             "• Series R add; parallel 1/R=Σ1/Rᵢ; capacitors add in parallel.\n"
             "• RC transient τ=RC, exponential approach to steady state.\n"
             "Ask: can you reduce the network via equivalent resistance / Thevenin?",
        "q": "无穷梯形电阻网络如何用自相似性列方程？",
    },
    {
        "keys": ["电磁感应", "法拉第", "faraday", "磁通", "电感", "lenz"],
        "zh": "法拉第定律 ε=−dΦ/dt；楞次定律决定感应电流阻碍磁通变化的方向。\n"
             "• 自感 L：Φ=LI，储能 ½LI²；RL 电路时间常数 τ=L/R。\n"
             "• 动生电动势 ε=Blv（导体切割磁感线）。\n"
             "先问：磁通量如何变化？感应电场是否保守？",
        "en": "Faraday: ε=−dΦ/dt; Lenz's law sets the direction opposing flux change.\n"
             "• Self-inductance L: Φ=LI, stored ½LI²; RL time constant τ=L/R.\n"
             "• Motional emf ε=Blv.\n"
             "Ask: how does flux change? Is the induced E-field conservative?",
        "q": "两同轴线圈互感 M，次级开路与短路时初级电流有何不同？",
    },
    {
        "keys": ["相对论", "relativity", "洛伦兹", "质能", "时间膨胀", "lorentz"],
        "zh": "狭义相对论两大假设：光速不变 + 物理定律协变。\n"
             "• 时间膨胀 Δt=γΔτ；长度收缩 L=L₀/γ；γ=1/√(1−v²/c²)。\n"
             "• 质能方程 E=γmc²，静能 E₀=mc²；动量 p=γmv。\n"
             "先问：你比较的是同一事件在不同时钟/尺下的测量吗？",
        "en": "Special relativity: constancy of c + covariance of laws.\n"
             "• Time dilation Δt=γΔτ; length contraction L=L₀/γ; γ=1/√(1−v²/c²).\n"
             "• E=γmc², rest energy mc²; momentum p=γmv.\n"
             "Ask: are you comparing measurements of the same event by different clocks/rulers?",
        "q": "双生子佯谬中，谁年轻？为何不能简单用‘对方在动’对称处理？",
    },
    {
        "keys": ["热力学", "熵", "第一定律", "第二定律", "thermal", "热机"],
        "zh": "热力学第一定律 ΔU=Q−W（系统吸热 Q、对外做功 W）。\n"
             "• 理想气体 pV=nRT；等温 ΔU=0、绝热 pV^γ=const。\n"
             "• 第二定律：孤立系统熵不减；卡诺效率 η=1−T_c/T_h。\n"
             "先问：你定义 W 是系统对外还是外界对系统？符号别错。",
        "en": "1st law: ΔU=Q−W (Q into system, W by system).\n"
             "• Ideal gas pV=nRT; isothermal ΔU=0, adiabatic pV^γ=const.\n"
             "• 2nd law: entropy of isolated system never decreases; Carnot η=1−T_c/T_h.\n"
             "Ask: is W done by or on the system? Sign conventions matter.",
        "q": "可逆卡诺循环四步各是什么过程？为何实际热机效率必低于卡诺？",
    },
    {
        "keys": ["量子", "quantum", "薛定谔", "波函数", "势阱", "不确定性", "schrödinger"],
        "zh": "量子态由波函数 ψ 描述，概率密度 |ψ|²；演化服从 iℏ∂ψ/∂t=Ĥψ。\n"
             "• 一维无限深势阱 Eₙ=n²π²ℏ²/(2mL²)；谐振子 Eₙ=(n+½)ℏω。\n"
             "• 不确定性 Δx·Δp≥ℏ/2。\n"
             "先问：边界条件如何决定能级量子化？",
        "en": "Quantum states described by ψ, probability density |ψ|²; evolves by iℏ∂ψ/∂t=Ĥψ.\n"
             "• Infinite well Eₙ=n²π²ℏ²/(2mL²); oscillator Eₙ=(n+½)ℏω.\n"
             "• Uncertainty Δx·Δp≥ℏ/2.\n"
             "Ask: how do boundary conditions quantise the energy levels?",
        "q": "势垒穿透（隧穿）为何违背经典直觉却符合能量守恒？",
    },
    {
        "keys": ["静电", "电场", "高斯", "电容", "gauss", "coulomb", "电势"],
        "zh": "库仑定律 F=k q₁q₂/r²；电场 E=F/q；高斯定理 ∮E·dA=Q_enc/ε₀。\n"
             "• 电势 V：E=−∇V；点电荷 V=kq/r。\n"
             "• 电容 C=Q/V；平行板 C=ε₀S/d。\n"
             "先问：对称性是否允许用高斯定理一步求 E？",
        "en": "Coulomb F=k q₁q₂/r²; field E=F/q; Gauss ∮E·dA=Q_enc/ε₀.\n"
             "• Potential V: E=−∇V; point charge V=kq/r.\n"
             "• Capacitance C=Q/V; parallel plate C=ε₀S/d.\n"
             "Ask: does symmetry let you get E in one step via Gauss's law?",
        "q": "导体静电平衡时内部场强为何为零？表面电荷如何分布？",
    },
    {
        "keys": ["流体", "伯努利", "fluids", "压强", "浮力", "bernoulli"],
        "zh": "静力学 p=ρgh；阿基米德浮力=排开液重。\n"
             "• 伯努利（理想、定常）p+½ρv²+ρgh=const 沿流线守恒。\n"
             "• 连续性方程 S₁v₁=S₂v₂。\n"
             "先问：流动是否理想、定常、不可压缩？伯努利沿哪条流线成立？",
        "en": "Hydrostatics p=ρgh; Archimedes buoyancy = weight of displaced fluid.\n"
             "• Bernoulli (ideal, steady): p+½ρv²+ρgh=const along a streamline.\n"
             "• Continuity S₁v₁=S₂v₂.\n"
             "Ask: is flow ideal, steady, incompressible? Along which streamline does Bernoulli hold?",
        "q": "飞机升力能否仅靠‘流速大压强小’解释？环量起什么作用？",
    },
]


def _match_topic(message: str) -> dict | None:
    """在知识库中按关键词匹配最相关主题。

    采用「最长关键词优先」策略，避免「角动量」被「动量」抢匹配等子串误判。
    """
    text = (message or "").lower()
    best: dict | None = None
    best_len = 0
    for topic in _OFFLINE_KB:
        for kw in topic["keys"]:
            kwl = kw.lower()
            if kwl in text and len(kwl) > best_len:
                best = topic
                best_len = len(kwl)
    return best


def offline_tutor(message: str, lang: str = "zh") -> str:
    """离线物理教练：关键词命中返回结构化讲解+苏格拉底追问；否则给通用引导。

    即使未配置任何 LLM 密钥，也能提供有实质内容的物理辅导。
    """
    lang = (lang or "zh").lower()
    topic = _match_topic(message)
    if topic is not None:
        body = topic["zh"] if lang != "en" else topic["en"]
        prefix = "【POMOS 离线教练】" if lang != "en" else "[POMOS offline coach] "
        q_label = "\n\n💡 苏格拉追问：" if lang != "en" else "\n\n💡 Socratic prompt: "
        return f"{prefix}\n{body}{q_label}{topic['q']}"

    # 未命中：给出能力范围与引导，仍保持教练口吻
    if lang == "en":
        return (
            "[POMOS offline coach] I don't yet have a focused note for that query, "
            "but I can coach you on: perturbation theory, Newton's laws, momentum & "
            "energy, rotation & angular momentum, SHM, waves & interference, circuits, "
            "electromagnetic induction, relativity, thermodynamics, quantum basics, "
            "electrostatics, fluids. Tell me the topic or paste a problem and I'll guide "
            "you with physical pictures before formulas."
        )
    return (
        "【POMOS 离线教练】我暂时没有针对该问题的专题笔记，但可以辅导这些方向：\n"
        "微扰论、牛顿定律、动量与能量、转动与角动量、简谐振动、波动与干涉、电路、"
        "电磁感应、相对论、热力学、量子基础、静电场、流体。\n"
        "把题目或想弄清的概念告诉我，我会先帮你建立物理图像，再上公式。"
    )


def _mock_reply(prompt: str) -> str:
    """纯错误回退（非离线教练路径）：从 prompt 抽取用户输入给离线教练。"""
    import re

    m = re.search(r"学生说：(.*?)\n", prompt or "", re.S)
    msg = m.group(1) if m else (prompt or "")
    return offline_tutor(msg, "zh")


# ----------------------------------------------------------------- 核心接口
async def chat_completion(prompt: str, system: str | None = None) -> str:
    """统一的聊天补全接口，返回纯文本回复。

    自动选择供应商；调用异常或无可用的 key 时退化为 mock，保证链路可用。
    """
    provider = _resolve_provider()
    if provider is None:
        return _mock_reply(prompt)

    messages: list[dict] = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    # --- custom：OpenAI 兼容自定义端点 ---
    if provider == "custom":
        client = _get_openai_client(settings.llm_base_url, settings.llm_api_key)
        if client is None:
            return _mock_reply(prompt)
        return await _call_openai(
            client, settings.llm_model or "gpt-4o", messages
        )

    cfg = PROVIDERS[provider]
    api_key = getattr(settings, cfg["env_key"], "")

    # --- Claude 原生通道 ---
    if cfg["native"] == "anthropic":
        client = _get_anthropic_client(api_key)
        if client is None:
            return _mock_reply(prompt)
        return await _call_anthropic(client, settings.llm_model or cfg["default_model"], messages, system)

    # --- OpenAI 兼容通道 ---
    client = _get_openai_client(cfg["base_url"], api_key)
    if client is None:
        return _mock_reply(prompt)
    return await _call_openai(
        client, settings.llm_model or cfg["default_model"], messages
    )


async def _call_openai(client, model: str, messages: list[dict]) -> str:
    """调用 OpenAI 兼容 chat.completions。"""
    try:
        resp = await client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=settings.llm_temperature,
            max_tokens=settings.llm_max_tokens,
        )
        return resp.choices[0].message.content or ""
    except Exception:
        return _mock_reply("")


async def _call_anthropic(client, model: str, messages: list[dict], system: str | None) -> str:
    """调用 Anthropic Messages API。"""
    try:
        # 把 messages 拆成 system + user/assistant 交替
        conv = []
        for m in messages:
            if m["role"] == "system":
                continue
            conv.append({"role": m["role"], "content": m["content"]})
        resp = await client.messages.create(
            model=model,
            max_tokens=settings.llm_max_tokens,
            system=system or "",
            messages=conv,
        )
        if resp.content and len(resp.content) > 0:
            return resp.content[0].text
        return ""
    except Exception:
        return _mock_reply("")


# ----------------------------------------------------------------- 流式补全
def _chunk_text(text: str, size: int = 6) -> list[str]:
    """把完整文本切成小块，用于离线（mock）模式模拟打字机式流式输出。"""
    chunks: list[str] = []
    buf = ""
    for ch in text or "":
        buf += ch
        if ch in "。！？!?；;\n" or len(buf) >= size:
            chunks.append(buf)
            buf = ""
    if buf:
        chunks.append(buf)
    return chunks


async def _stream_openai(client, model: str, messages: list[dict]):
    """OpenAI 兼容流式：yield 文本增量。异常时退化为 mock 文本，保证链路不中断。"""
    try:
        stream = await client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=settings.llm_temperature,
            max_tokens=settings.llm_max_tokens,
            stream=True,
        )
        async for chunk in stream:
            if not chunk.choices:
                continue
            delta = chunk.choices[0].delta.content
            if delta:
                yield delta
    except Exception:
        for c in _chunk_text(_mock_reply("")):
            yield c


async def _stream_anthropic(client, model: str, messages: list[dict], system: str | None):
    """Claude 原生流式：yield 文本增量。"""
    try:
        conv = [
            {"role": m["role"], "content": m["content"]}
            for m in messages
            if m["role"] != "system"
        ]
        async with client.messages.stream(
            model=model,
            max_tokens=settings.llm_max_tokens,
            system=system or "",
            messages=conv,
        ) as stream:
            async for text in stream.text_stream:
                yield text
    except Exception:
        for c in _chunk_text(_mock_reply("")):
            yield c


async def chat_completion_stream(prompt: str, system: str | None = None):
    """流式聊天补全，异步 yield 文本增量（str）。

    - 无可用密钥（mock/offline）：将离线教练文本分块 yield，模拟流式。
    - 已配置密钥：调用真实供应商 stream 接口，按 delta 透传。
    """
    provider = _resolve_provider()
    if provider is None:
        for c in _chunk_text(_mock_reply(prompt)):
            yield c
        return

    messages: list[dict] = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    if provider == "custom":
        client = _get_openai_client(settings.llm_base_url, settings.llm_api_key)
        if client is None:
            for c in _chunk_text(_mock_reply(prompt)):
                yield c
            return
        async for chunk in _stream_openai(client, settings.llm_model or "gpt-4o", messages):
            yield chunk
        return

    cfg = PROVIDERS[provider]
    api_key = getattr(settings, cfg["env_key"], "")

    if cfg["native"] == "anthropic":
        client = _get_anthropic_client(api_key)
        if client is None:
            for c in _chunk_text(_mock_reply(prompt)):
                yield c
            return
        async for chunk in _stream_anthropic(
            client, settings.llm_model or cfg["default_model"], messages, system
        ):
            yield chunk
        return

    client = _get_openai_client(cfg["base_url"], api_key)
    if client is None:
        for c in _chunk_text(_mock_reply(prompt)):
            yield c
        return
    async for chunk in _stream_openai(
        client, settings.llm_model or cfg["default_model"], messages
    ):
        yield chunk


# ----------------------------------------------------------------- 连接探针
async def probe_connection() -> tuple[bool, str]:
    """探测当前供应商连接是否真实可用（不做 mock 回退）。

    返回 (是否成功, 详情)。未配置任何密钥时返回 (False, 离线模式提示)。
    供前端「设置 → 测试连接」使用。
    """
    provider = _resolve_provider()
    if provider is None:
        return (False, "未配置任何 LLM 密钥，当前为离线教练模式（仍可提供物理辅导）。")

    messages = [{"role": "user", "content": "Reply with the single word OK."}]

    if provider == "custom":
        client = _get_openai_client(settings.llm_base_url, settings.llm_api_key)
        if client is None:
            return (False, "custom 客户端创建失败（base_url/key 无效？）")
        try:
            r = await _call_openai(client, settings.llm_model or "gpt-4o", messages)
            return (True, f"{provider}: {r[:60]}")
        except Exception as exc:  # noqa: BLE001
            return (False, f"{provider} 调用失败: {str(exc)[:160]}")

    cfg = PROVIDERS[provider]
    api_key = getattr(settings, cfg["env_key"], "")

    if cfg["native"] == "anthropic":
        client = _get_anthropic_client(api_key)
        if client is None:
            return (False, "anthropic SDK 未安装")
        try:
            r = await _call_anthropic(client, settings.llm_model or cfg["default_model"], messages, "reply OK")
            return (True, f"{provider}: {r[:60]}")
        except Exception as exc:  # noqa: BLE001
            return (False, f"{provider} 调用失败: {str(exc)[:160]}")

    client = _get_openai_client(cfg["base_url"], api_key)
    if client is None:
        return (False, "openai SDK 未安装")
    try:
        r = await _call_openai(client, settings.llm_model or cfg["default_model"], messages)
        return (True, f"{provider}: {r[:60]}")
    except Exception as exc:  # noqa: BLE001
        return (False, f"{provider} 调用失败: {str(exc)[:160]}")
