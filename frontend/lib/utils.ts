// lib/utils.ts
// 通用工具：cn() 合并 className（clsx + tailwind-merge），用于 shadcn 风格组件
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** 合并并去重 Tailwind 类名 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
