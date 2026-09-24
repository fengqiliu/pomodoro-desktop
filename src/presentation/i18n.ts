// Lightweight i18n. No library — a plain dictionary + t() with {param} interpolation.
// Default language is Chinese (zh). Add a language by extending LANGS and DICT.

export type Lang = "zh" | "en";

import type { NoiseType } from "../domain/settings";
import type { Phase } from "../domain/timer";

export const PHASE_KEY: Record<Phase, string> = {
  focus: "phase.focus",
  short: "phase.short",
  long: "phase.long",
};

export const NOISE_KEY: Record<NoiseType, string> = {
  white: "noise.white",
  brown: "noise.brown",
  pink: "noise.pink",
};

export const LANGS: { code: Lang; label: string }[] = [
  { code: "zh", label: "简体中文" },
  { code: "en", label: "English" },
];

type Dict = Record<string, [zh: string, en: string]>;

const DICT: Dict = {
  // brand
  "app.name": ["Pomodoro", "Pomodoro"],

  // phases
  "phase.focus": ["专注", "Focus"],
  "phase.short": ["短休息", "Short Break"],
  "phase.long": ["长休息", "Long Break"],

  // tabs
  "tab.timer": ["计时", "Timer"],
  "tab.tasks": ["任务", "Tasks"],
  "tab.stats": ["统计", "Stats"],

  // top bar tooltips / aria
  "top.noise": ["白噪音", "White noise"],
  "top.noise.on": ["白噪音 · {type}", "Noise · {type}"],
  "top.theme.toDark": ["切换深色", "Switch to dark"],
  "top.theme.toLight": ["切换浅色", "Switch to light"],
  "top.pin": ["置顶", "Pin on top"],
  "top.unpin": ["取消置顶", "Unpin"],
  "top.settings": ["设置", "Settings"],

  // timer view
  "timer.focusing": ["正在专注", "Focusing on"],
  "control.reset": ["重置", "Reset"],
  "control.skip": ["跳过", "Skip"],
  "stat.todayPomos": ["今日番茄", "Today"],
  "stat.focusMins": ["专注分钟", "Focus min"],
  "stat.toLong": ["距长休息", "To long break"],

  // tasks view
  "task.addPlaceholder": ["添加一个任务…", "Add a task…"],
  "task.addBtn": ["添加", "Add"],
  "task.empty.title": ["还没有任务，添加一个开始专注吧", "No tasks yet — add one to start focusing"],
  "task.empty.icon": ["○", "○"],
  "task.activeHint": ["选为当前专注任务", "Set as current focus task"],
  "task.done.aria": ["完成", "Done"],
  "task.pomoCount": ["已用番茄数", "Pomodoros used"],
  "task.delete": ["删除", "Delete"],
  "task.footer": ["共 {total} 个任务 · 已完成 {done} 个", "{total} tasks · {done} done"],
  "task.clearDone": ["清除已完成", "Clear done"],

  // stats view
  "stats.card.today": ["今日", "Today"],
  "stats.card.weekPomos": ["本周番茄", "Week pomodoros"],
  "stats.card.weekMins": ["本周分钟", "Week minutes"],
  "stats.chart.title": ["近 7 天", "Last 7 days"],
  "stats.chart.pomos": ["番茄数", "Pomodoros"],
  "stats.chart.minutes": ["分钟数", "Minutes"],
  "stats.footer.empty": ["本周还没有专注记录，开始第一个番茄吧 🍅", "No focus this week yet — start your first pomodoro 🍅"],
  "stats.footer.avg": ["平均每天 {avg} 个番茄 · {mins} 分钟", "{avg} pomodoros / day · {mins} min"],

  // weekdays
  "day.0": ["周日", "Sun"],
  "day.1": ["周一", "Mon"],
  "day.2": ["周二", "Tue"],
  "day.3": ["周三", "Wed"],
  "day.4": ["周四", "Thu"],
  "day.5": ["周五", "Fri"],
  "day.6": ["周六", "Sat"],

  // settings modal
  "settings.title": ["设置", "Settings"],
  "settings.section.general": ["通用", "General"],
  "settings.section.noise": ["白噪音", "White noise"],
  "settings.section.hotkey": ["全局快捷键", "Global shortcut"],
  "settings.language": ["语言", "Language"],
  "settings.focus": ["专注时长（分钟）", "Focus length (min)"],
  "settings.short": ["短休息（分钟）", "Short break (min)"],
  "settings.long": ["长休息（分钟）", "Long break (min)"],
  "settings.longEvery": ["每几个番茄后长休息", "Long break every N pomodoros"],
  "settings.sound": ["完成提示音", "Completion sound"],
  "settings.notifications": ["完成时通知", "Notifications"],
  "settings.autoStartBreaks": ["专注后自动进入休息", "Auto-start breaks"],
  "settings.autoStartFocus": ["休息后自动开始专注", "Auto-start focus"],
  "settings.noiseType": ["噪音类型", "Noise type"],
  "settings.noiseType.brown": ["棕噪音（低频，最柔和）", "Brown (low, softest)"],
  "settings.noiseType.white": ["白噪音", "White"],
  "settings.noiseType.pink": ["粉噪音", "Pink"],
  "settings.volume": ["音量", "Volume"],
  "settings.hotkey.startPause": ["开始 / 暂停", "Start / Pause"],
  "settings.hotkey.hint": [
    "桌面端生效。可用修饰键：CommandOrControl、Shift、Alt、Super，普通键如 P / Space。示例：",
    "Desktop only. Modifiers: CommandOrControl, Shift, Alt, Super; keys like P / Space. Example:",
  ],
  "settings.hotkey.error.empty": ["请输入快捷键。", "Enter a shortcut."],
  "settings.hotkey.error.registration": [
    "该快捷键无法注册，请换一个组合键后重试。",
    "This shortcut could not be registered. Try another combination.",
  ],
  "settings.reset": ["恢复默认", "Reset to defaults"],
  "settings.done": ["完成", "Done"],
  "settings.section.data": ["数据", "Data"],
  "settings.export": ["导出数据（复制到剪贴板）", "Export data (copies to clipboard)"],
  "settings.import": ["从剪贴板导入数据", "Import data from clipboard"],
  "settings.import.prompt": [
    "剪贴板不可用，请粘贴备份数据：",
    "Clipboard unavailable — paste your backup:",
  ],

  // toasts
  "toast.exported": ["备份已复制到剪贴板", "Backup copied to clipboard"],
  "toast.copyFailed": ["复制失败，请重试", "Copy failed — please retry"],
  "toast.importFailed": ["导入失败：备份数据无效", "Import failed: invalid backup data"],

  // phase-complete notifications (native system notification)
  "notif.title": ["专注完成", "Focus complete"],
  "notif.title.break": ["休息结束", "Break complete"],
  "notif.body": ["开始 {next}", "Starting {next}"],

  // noise labels (for the top-bar tooltip)
  "noise.white": ["白噪音", "White"],
  "noise.brown": ["棕噪音", "Brown"],
  "noise.pink": ["粉噪音", "Pink"],
};

const INDEX: Record<Lang, 0 | 1> = { zh: 0, en: 1 };

export function translate(lang: Lang, key: string, params?: Record<string, string | number>): string {
  const entry = DICT[key];
  const raw = entry ? entry[INDEX[lang]] : key;
  if (!params) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, k: string) =>
    params[k] !== undefined ? String(params[k]) : `{${k}}`
  );
}

export function weekdayLabel(lang: Lang, dayIndex: number): string {
  return translate(lang, `day.${dayIndex}`);
}
