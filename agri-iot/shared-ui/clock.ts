import { useEffect, useState } from "react";

const pad = (value: number) => String(value).padStart(2, "0");
const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

/**
 * 页面顶栏的日期时间（web 与 ops 共用）。
 *
 * 两端原先都写死 "2026-10-25 周日"：不管哪天打开，页面都停在演示那一天，
 * 大屏上"数据每 30 秒刷新"同理 —— 没有任何轮询，只有手动点刷新。
 */
export function useClock(intervalMs = 30_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return {
    date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${WEEKDAYS[now.getDay()]}`,
    time: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
  };
}
