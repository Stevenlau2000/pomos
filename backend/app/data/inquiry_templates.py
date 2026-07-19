"""POMOS 科学探究实验模板（静态示例数据）。

≥3 个实验模板，每含 id / name / goal / design_steps / uncertainty_model(A类/B类) /
fitting_method。中英文双语字段，由 m11 按语言与关键词选取。
纯数据，无外部依赖。
"""
from __future__ import annotations

from typing import Any, Dict, List

INQUIRY_TEMPLATES: List[Dict[str, Any]] = [
    {
        "id": "inq_g",
        "name": "重力加速度测量",
        "name_en": "Measurement of g",
        "goal": "测量当地重力加速度 g",
        "goal_en": "Measure local gravitational acceleration g",
        "keywords": ["重力", "g", "自由落体", "单摆", "加速度", "gravity", "pendulum"],
        "design_steps": [
            "选择方法（单摆 / 自由落体 / 复摆）",
            "测量摆长 L 或下落高度 h 与对应时间 t（多次重复）",
            "记录仪器允差（米尺、秒表）",
            "代入公式 g = 4π²L/T² 或 g = 2h/t²",
            "改变参数重复，取多组取平均",
        ],
        "design_steps_en": [
            "Choose method (pendulum / free-fall / physical pendulum)",
            "Measure length L or drop height h and corresponding time t (multiple runs)",
            "Record instrument tolerance (ruler, stopwatch)",
            "Apply g = 4π²L/T² or g = 2h/t²",
            "Vary parameters and average over several trials",
        ],
        "uncertainty_model": {
            "A类": "多次测量标准差 s/√n",
            "B类": "仪器允差 Δ/√3",
        },
        "fitting_method": "等间距数据优先用逐差法；必要时对 T²-L 作最小二乘拟合。",
        "fitting_method_en": (
            "Use the successive-difference method for equally spaced data; "
            "if needed, least-squares fit of T² vs L."
        ),
    },
    {
        "id": "inq_r",
        "name": "电阻测量",
        "name_en": "Resistance Measurement",
        "goal": "测定未知电阻的阻值",
        "goal_en": "Determine the resistance of an unknown resistor",
        "keywords": ["电阻", "电路", "欧姆", "伏安", "resistance", "circuit", "ohm"],
        "design_steps": [
            "设计伏安法或电桥电路",
            "连接电表并选取合适量程（内/外接法）",
            "读取多组电压 U 与电流 I",
            "由 R = U/I 计算，或作 U-I 图取斜率",
            "评估电表内阻引入的系统误差",
        ],
        "design_steps_en": [
            "Design a voltmeter-ammeter or bridge circuit",
            "Connect meters and choose proper ranges (internal/external connection)",
            "Record several pairs of voltage U and current I",
            "Compute R = U/I, or take the slope of the U-I graph",
            "Estimate systematic error from meter internal resistance",
        ],
        "uncertainty_model": {
            "A类": "多次测量的 U、I 标准差传播",
            "B类": "电表准确度等级对应的允差 Δ/√3",
        },
        "fitting_method": "用最小二乘法拟合 U-I 直线，斜率即电阻，并给出不确定度。",
        "fitting_method_en": (
            "Least-squares fit of the U-I line; the slope is R, with propagated uncertainty."
        ),
    },
    {
        "id": "inq_n",
        "name": "折射率测量",
        "name_en": "Refractive Index Measurement",
        "goal": "测量玻璃砖 / 液体的折射率",
        "goal_en": "Measure the refractive index of glass / liquid",
        "keywords": ["折射", "光", "光学", "全反射", "refraction", "optics", "refractive"],
        "design_steps": [
            "布置光的入射与出射光路",
            "测量入射角 i 与折射角 r（或多组数据）",
            "记录角度测量的仪器允差",
            "由 n = sin i / sin r 计算折射率",
            "用最小二乘拟合 sin i - sin r 直线验证",
        ],
        "design_steps_en": [
            "Set up incident and emergent light paths",
            "Measure incident angle i and refracted angle r (several data sets)",
            "Record instrument tolerance of angle measurement",
            "Compute n = sin i / sin r",
            "Verify with a least-squares fit of sin i vs sin r",
        ],
        "uncertainty_model": {
            "A类": "多组角度测量的标准差",
            "B类": "分光计 / 量角仪允差 Δ/√3",
        },
        "fitting_method": "对 sin i - sin r 作最小二乘线性拟合，斜率即折射率 n。",
        "fitting_method_en": (
            "Least-squares linear fit of sin i vs sin r; the slope is the refractive index n."
        ),
    },
]
