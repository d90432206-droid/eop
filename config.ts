// ⚠️ VITE 環境變數設定重要說明：
// Vite 在打包生產環境時，只會針對「明確寫出的變數名稱」進行靜態字串替換。
// 例如：import.meta.env.VITE_SUPABASE_URL 會被替換成 "https://..."
// ❌ 不能使用動態存取 (如 import.meta.env[key])，這在 Production 會讀不到值。

// 1. 明確宣告變數 (讓 Vite 能夠靜態替換)
// @ts-ignore
const VITE_URL = import.meta.env.VITE_SUPABASE_URL;
// @ts-ignore
const VITE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// 2. 輔助函式：安全讀取 process.env (相容 Create React App 或其他環境)
const getProcessEnv = (key: string) => {
  try {
    // @ts-ignore
    if (typeof process !== 'undefined' && process.env) {
      // @ts-ignore
      return process.env[key];
    }
  } catch (e) {
    // 忽略錯誤
  }
  return '';
};

// 3. 組合最終設定 (優先使用 Vite 變數 -> 其次 Process 變數)
const FINAL_URL = VITE_URL || getProcessEnv('VITE_SUPABASE_URL') || getProcessEnv('REACT_APP_SUPABASE_URL') || '';
const FINAL_KEY = VITE_KEY || getProcessEnv('VITE_SUPABASE_ANON_KEY') || getProcessEnv('REACT_APP_SUPABASE_ANON_KEY') || '';

export const SUPABASE_CONFIG = {
  url: FINAL_URL,
  anonKey: FINAL_KEY
};

// 4. 除錯檢查 (在瀏覽器 Console 顯示狀態)
if (!SUPABASE_CONFIG.url || !SUPABASE_CONFIG.anonKey) {
  console.error('❌ Supabase 設定嚴重錯誤：找不到 API URL 或 Anon Key。請檢查 .env 或 Vercel Environment Variables 設定。');
} else {
  // 僅在開發環境或除錯時顯示，確認有讀到值
  console.log('✅ Supabase 設定已載入', {
    url: SUPABASE_CONFIG.url,
    keyLoaded: !!SUPABASE_CONFIG.anonKey,
    keyLength: SUPABASE_CONFIG.anonKey?.length
  });
}