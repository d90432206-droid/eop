
// ⚠️ 安全性警告：
// 前端應用程式中的環境變數在構建後對於瀏覽器是可見的。
// Supabase Anon Key 設計上是公開的，但請務必啟用 Supabase 資料庫的 RLS (Row Level Security) 
// 以確保資料安全。

// 檢查是否使用 Vite (import.meta.env) 或 Create React App (process.env)
const getEnv = (key: string) => {
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    // @ts-ignore
    return import.meta.env[key];
  }
  // @ts-ignore
  if (typeof process !== 'undefined' && process.env) {
    // @ts-ignore
    return process.env[key];
  }
  return '';
};

export const SUPABASE_CONFIG = {
  url: getEnv('VITE_SUPABASE_URL') || getEnv('REACT_APP_SUPABASE_URL') || '',
  anonKey: getEnv('VITE_SUPABASE_ANON_KEY') || getEnv('REACT_APP_SUPABASE_ANON_KEY') || ''
};

if (!SUPABASE_CONFIG.url || !SUPABASE_CONFIG.anonKey) {
  console.error(
    '❌ Supabase 設定遺失！請在專案根目錄建立 .env 檔案並設定以下變數：\n' +
    'VITE_SUPABASE_URL=您的SupabaseURL\n' +
    'VITE_SUPABASE_ANON_KEY=您的AnonKey'
  );
}
