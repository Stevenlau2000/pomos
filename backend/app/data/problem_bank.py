"""POMOS 竞赛题库（静态示例数据）。

≥6 道示例竞赛题，每题含 id / board / difficulty(1-5) / topic / 考点 / statement /
solution / source。中英文双语字段（topic_zh/en、kpoint_zh/en、statement_zh/en、
solution_zh/en），由 m09 的 ``localize_problem`` 按语言选取。
纯数据，无外部依赖。
"""
from __future__ import annotations

from typing import Any, Dict, List

PROBLEM_BANK: List[Dict[str, Any]] = [
    {
        "id": "p01",
        "board": "力学",
        "difficulty": 4,
        "topic_zh": "刚体转动",
        "topic_en": "Rigid Body Rotation",
        "kpoint_zh": "转动惯量 / 角动量守恒",
        "kpoint_en": "Moment of inertia / angular momentum conservation",
        "statement_zh": (
            "质量为 m、长为 L 的均匀细杆可绕一端水平轴自由转动。初始杆竖直静止，"
            "一质量为 m 的泥丸以水平速度 v 击中杆的中点并粘住。求碰后瞬间杆的角速度。"
        ),
        "statement_en": (
            "A uniform rod of mass m and length L pivots freely about one end. Initially "
            "vertical and at rest, a lump of mass m strikes its midpoint horizontally with "
            "speed v and sticks. Find the angular velocity just after impact."
        ),
        "solution_zh": (
            "对轴取角动量守恒：碰前泥丸角动量 = m v (L/2)；杆转动惯量 I = (1/3)mL²，"
            "泥丸粘住后总转动惯量 I' = (1/3)mL² + m(L/2)² = (7/12)mL²。"
            "由 m v (L/2) = I' ω 得 ω = 6v / (7L)。"
        ),
        "solution_en": (
            "Conserve angular momentum about the pivot: initial = m v (L/2). Rod I = (1/3)mL²; "
            "after sticking, I' = (1/3)mL² + m(L/2)² = (7/12)mL². "
            "Thus m v (L/2) = I' ω ⇒ ω = 6v / (7L)."
        ),
        "source": "CPhO 复赛真题",
    },
    {
        "id": "p02",
        "board": "力学",
        "difficulty": 3,
        "topic_zh": "振动与波 / 动量",
        "topic_en": "Oscillation & Waves / Momentum",
        "kpoint_zh": "简谐运动 / 动量守恒",
        "kpoint_en": "Simple harmonic motion / momentum conservation",
        "statement_zh": (
            "两相同弹簧振子质量均为 m、劲度系数 k，静止于光滑水平面。一质量为 m 的滑块以速度 v "
            "撞上其一并粘连。求系统的最大弹性势能。"
        ),
        "statement_en": (
            "Two identical spring oscillators (mass m, stiffness k) rest on a smooth "
            "horizontal plane. A block of mass m moving at speed v collides and sticks to one. "
            "Find the maximum elastic potential energy of the system."
        ),
        "solution_zh": (
            "碰撞瞬间动量守恒得共同速度 v/2，动能 (1/2)(2m)(v/2)² = mv²/4。"
            "该动能全部转化为弹簧最大弹性势能：E_max = mv²/4。"
        ),
        "solution_en": (
            "Momentum conservation gives common speed v/2; KE = (1/2)(2m)(v/2)² = mv²/4. "
            "This is fully converted to spring PE at maximum compression: E_max = mv²/4."
        ),
        "source": "CPhO 预赛改编",
    },
    {
        "id": "p03",
        "board": "电磁学",
        "difficulty": 5,
        "topic_zh": "电磁感应",
        "topic_en": "Electromagnetic Induction",
        "kpoint_zh": "法拉第定律 / 动生电动势 / 能量转化",
        "kpoint_en": "Faraday's law / motional EMF / energy conversion",
        "statement_zh": (
            "U 形导轨间距 L，电阻 R，置于垂直纸面向里的匀强磁场 B 中。一导体棒以恒定速度 v "
            "沿导轨向右滑动。求棒所受安培力大小及维持匀速所需外力功率。"
        ),
        "statement_en": (
            "A U-shaped rail of width L and resistance R sits in a uniform B field into the "
            "page. A conducting bar slides right at constant speed v. Find the magnetic drag "
            "force on the bar and the external power needed to keep it moving."
        ),
        "solution_zh": (
            "动生电动势 ε = BLv，电流 I = ε/R = BLv/R。安培力 F = BIL = B²L²v/R（向左阻碍运动）。"
            "外力功率 P = F v = B²L²v²/R。"
        ),
        "solution_en": (
            "Motional EMF ε = BLv, current I = BLv/R. Magnetic force F = BIL = B²L²v/R (leftward). "
            "External power P = F v = B²L²v²/R."
        ),
        "source": "CPhO 复赛真题",
    },
    {
        "id": "p04",
        "board": "电磁学",
        "difficulty": 3,
        "topic_zh": "静电场 / 磁场",
        "topic_en": "Electrostatic / Magnetic Field",
        "kpoint_zh": "高斯定理 / 洛伦兹力",
        "kpoint_en": "Gauss's law / Lorentz force",
        "statement_zh": (
            "半径为 R 的均匀带电球面总电荷 Q。求球内、球外电场分布；"
            "若一电荷 q 以速度 v 垂直于磁场 B 射入，求圆周运动半径。"
        ),
        "statement_en": (
            "A uniformly charged spherical shell (radius R, total charge Q). Find E inside "
            "and outside; if charge q enters a B field perpendicularly at speed v, find the "
            "circular orbit radius."
        ),
        "solution_zh": (
            "由高斯定理：球内 E=0，球外 E = kQ/r²。洛伦兹力提供向心力 qvB = mv²/r，"
            "得半径 r = mv/(qB)。"
        ),
        "solution_en": (
            "Gauss's law: E=0 inside, E = kQ/r² outside. Lorentz force gives qvB = mv²/r ⇒ "
            "r = mv/(qB)."
        ),
        "source": "CPhO 预赛",
    },
    {
        "id": "p05",
        "board": "热学",
        "difficulty": 3,
        "topic_zh": "热力学过程",
        "topic_en": "Thermodynamic Process",
        "kpoint_zh": "理想气体状态方程 / 热力学第一定律",
        "kpoint_en": "Ideal gas law / first law of thermodynamics",
        "statement_zh": (
            "1 mol 单原子理想气体从状态 (p₀, V₀, T₀) 经等压过程膨胀到 2V₀。"
            "求吸收的热量与内能增量（设 Cv = 3R/2）。"
        ),
        "statement_en": (
            "1 mol of monatomic ideal gas at (p₀, V₀, T₀) expands isobarically to 2V₀. "
            "Find heat absorbed and internal energy change (Cv = 3R/2)."
        ),
        "solution_zh": (
            "等压膨胀 ΔT = T₀（因 V 加倍、p 不变）。ΔU = nCvΔT = (3/2)RT₀。"
            "做功 W = p₀ΔV = p₀V₀ = RT₀。由 ΔU = Q - W 得 Q = (5/2)RT₀。"
        ),
        "solution_en": (
            "Isobaric: ΔT = T₀ (V doubles, p fixed). ΔU = nCvΔT = (3/2)RT₀. "
            "Work W = p₀ΔV = p₀V₀ = RT₀. First law ΔU = Q - W ⇒ Q = (5/2)RT₀."
        ),
        "source": "CPhO 预赛改编",
    },
    {
        "id": "p06",
        "board": "光学",
        "difficulty": 4,
        "topic_zh": "波动光学 / 近代物理",
        "topic_en": "Wave Optics / Modern Physics",
        "kpoint_zh": "干涉 / 光子能量",
        "kpoint_en": "Interference / photon energy",
        "statement_zh": (
            "双缝间距 d，屏距 D，波长 λ 的单色光入射，求中央明纹两侧第 k 级明纹间距。"
            "若改用光子能量 E 的光，求对应波长。"
        ),
        "statement_en": (
            "Double slit (spacing d, screen distance D) lit by wavelength λ. Find the spacing "
            "between the k-th bright fringes on both sides of center. If light of photon "
            "energy E is used instead, find its wavelength."
        ),
        "solution_zh": (
            "第 k 级明纹位置 x_k = kλD/d，两侧间距 Δx = 2kλD/d。光子能量 E = hc/λ，"
            "故 λ = hc/E。"
        ),
        "solution_en": (
            "k-th bright fringe at x_k = kλD/d; spacing between both sides Δx = 2kλD/d. "
            "Photon energy E = hc/λ ⇒ λ = hc/E."
        ),
        "source": "CPhO 复赛改编",
    },
]
