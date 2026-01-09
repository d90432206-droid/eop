const { createClient } = require('@supabase/supabase-js');

// ⚠️ 請確認這裡的 URL 與 SERVICE_ROLE_KEY 是正確的
const SUPABASE_URL = 'https://wcgdapjjzpzvjprzudyq.supabase.co';
const SERVICE_ROLE_KEY = '請貼上您的_service_role_secret'; 

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const emails = [
  '106@chuyi.com.tw', '107@chuyi.com.tw', '108@chuyi.com.tw', '109@chuyi.com.tw', '110@chuyi.com.tw',
  '111@chuyi.com.tw', '112@chuyi.com.tw', '113@chuyi.com.tw', '114@chuyi.com.tw', '205@chuyi.com.tw',
  '207@chuyi.com.tw', '208@chuyi.com.tw', '209@chuyi.com.tw', '210@chuyi.com.tw', '211@chuyi.com.tw',
  '301@chuyi.com.tw', '302@chuyi.com.tw', '303@chuyi.com.tw', '304@chuyi.com.tw', '305@chuyi.com.tw',
  '306@chuyi.com.tw', '307@chuyi.com.tw', '308@chuyi.com.tw', '309@chuyi.com.tw', '310@chuyi.com.tw',
  '402@chuyi.com.tw', '403@chuyi.com.tw', '404@chuyi.com.tw', '405@chuyi.com.tw', '406@chuyi.com.tw',
  '408@chuyi.com.tw', '409@chuyi.com.tw', '410@chuyi.com.tw'
];

async function createUsers() {
  console.log('🚀 開始批次建立使用者...');
  
  for (const email of emails) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: email,
      password: '123456',
      email_confirm: true // 自動驗證 Email
    });

    if (error) {
      if (error.message.includes('already registered')) {
        console.log(`✅ [已存在] ${email}`);
      } else {
        console.error(`❌ [失敗] ${email}:`, error.message);
      }
    } else {
      console.log(`✨ [成功] ${email}`);
    }
  }

  console.log('🎉 建立完成！');
}

createUsers();
