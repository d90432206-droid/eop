// ⚠️ 重要修正：
// Vite 打包時只會針對「明確寫出的變數名稱」進行靜態替換。
// 不能使用動態 Key (例如 import.meta.env[key])，這在 Vercel 上會讀不到。

// @ts-ignore
const VITE_URL = import.meta.env.VITE_SUPABASE_URL;
// @ts-ignore
const VITE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const SUPABASE_CONFIG = {
  // 優先使用 Vite 注入的變數
  url: VITE_URL || '',
  anonKey: VITE_KEY || ''
};

// 安全性檢查：如果沒有讀到變數，嘗試從 process.env 讀取 (相容舊版或其他打包工具)
if (!SUPABASE_CONFIG.url && typeof process !== 'undefined' && process.env) {
  // @ts-ignore
  SUPABASE_CONFIG.url = process.env.VITE_SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL || '';
}
if (!SUPABASE_CONFIG.anonKey && typeof process !== 'undefined' && process.env) {
  // @ts-ignore
  SUPABASE_CONFIG.anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY || '';
}

// 除錯資訊 (在瀏覽器 Console 可見)
if (!SUPABASE_CONFIG.url || !SUPABASE_CONFIG.anonKey) {
  console.error(
    '❌ Supabase 連線失敗：環境變數未載入。\n' +
    '請確認 Vercel Settings -> Environment Variables 已設定 VITE_SUPABASE_URL 與 VITE_SUPABASE_ANON_KEY，' +
    '並且在設定後已執行過 Redeploy。'
  );
} else {
  // 隱碼處理，僅確認有載入
  console.log('✅ Supabase Config Loaded.');
}