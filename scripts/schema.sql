-- ding-wifi-gate 密碼網頁開門功能
-- 在 Supabase SQL Editor 執行。可重複執行（IF NOT EXISTS）。

-- 1) 密碼表：管理員建立的臨時訪客密碼
create table if not exists door_codes (
  id          bigint generated always as identity primary key,
  code        text        not null,                 -- 6 位數字密碼
  label       text        not null,                 -- 標籤，例如「媽媽」「清潔阿姨」
  valid_from  timestamptz not null,
  valid_until timestamptz not null,
  is_active   boolean     not null default true,
  created_at  timestamptz not null default now()
);

-- 週期性時段：'once' 用 valid_from/valid_until；'weekly' 用 weekdays + start/end_minute
alter table door_codes add column if not exists recurrence   text     not null default 'once'; -- 'once' | 'weekly'
alter table door_codes add column if not exists weekdays     smallint[];   -- JS getDay() 0=日..6=六
alter table door_codes add column if not exists start_minute smallint;     -- 本地午夜起算分鐘 0-1439
alter table door_codes add column if not exists end_minute   smallint;
-- weekly 密碼不用絕對時間區間，放寬為可空
alter table door_codes alter column valid_from  drop not null;
alter table door_codes alter column valid_until drop not null;

-- 加速驗證查詢
create index if not exists door_codes_code_active_idx
  on door_codes (code, is_active);

-- 2) access_logs 整合網頁開門紀錄
alter table access_logs add column if not exists source  text   not null default 'line'; -- 'line' | 'web'
alter table access_logs add column if not exists code_id bigint references door_codes(id) on delete set null;
-- 網頁開門沒有 LINE user，放寬為可空
alter table access_logs alter column line_user_id drop not null;

create index if not exists access_logs_code_id_idx on access_logs (code_id);

-- 3) 密碼嘗試紀錄：用於 IP 速率限制（防爆力破解）
create table if not exists door_attempts (
  id         bigint generated always as identity primary key,
  ip         text        not null,
  created_at timestamptz not null default now()
);

create index if not exists door_attempts_ip_time_idx
  on door_attempts (ip, created_at);

-- 4) LINE 成員：後台開通 / 申請使用 / 啟動碼
alter table users add column if not exists is_admin           boolean     not null default false; -- 管理員（「誰來了」「後台」只回給管理員）
alter table users add column if not exists requested_at       timestamptz; -- 按「申請使用」或沒權限時按開門的時間 → 等待開通
alter table users add column if not exists requested_via      text;        -- 'apply' | 'open' | 'close' | 'stop'
alter table users add column if not exists dismissed_at       timestamptz; -- 管理員在等待開通按了「忽略」
alter table users add column if not exists activated_via      text;        -- 'manual' | 'code'
alter table users add column if not exists activation_code_id bigint;
alter table users add column if not exists activated_at       timestamptz;

-- 啟動碼：朋友在 LINE 傳 6 位數就能自己開通
create table if not exists activation_codes (
  id          bigint generated always as identity primary key,
  code        text        not null,
  label       text        not null default '', -- 給誰用（只給管理員看）
  max_uses    int,                             -- null = 不限次數
  used_count  int         not null default 0,
  expires_at  timestamptz not null,            -- 過期後不能再兌換，已開通的人不受影響
  revoked_at  timestamptz,                     -- 管理員作廢
  created_at  timestamptz not null default now()
);

create index if not exists activation_codes_code_idx on activation_codes (code);
create index if not exists access_logs_line_user_idx on access_logs (line_user_id, created_at desc);

-- 把自己設成管理員（換成你的 LINE userId，可在 users 表找到）
-- update users set is_admin = true where line_user_id = 'Uxxxxxxxx';

-- 測試用：插入一組現在就能用的密碼（驗證完可刪）
-- insert into door_codes (code, label, valid_from, valid_until)
-- values ('123456', '測試', now() - interval '1 hour', now() + interval '1 day');
