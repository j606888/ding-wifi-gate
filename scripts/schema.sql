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

-- 測試用：插入一組現在就能用的密碼（驗證完可刪）
-- insert into door_codes (code, label, valid_from, valid_until)
-- values ('123456', '測試', now() - interval '1 hour', now() + interval '1 day');
