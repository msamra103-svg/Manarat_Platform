const {PGlite}=require('@electric-sql/pglite');const fs=require('fs'),assert=require('node:assert/strict');
(async()=>{const db=new PGlite();await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
create schema auth; create schema storage;
create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create function auth.jwt() returns jsonb language sql as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
grant usage on schema auth to anon,authenticated;grant execute on all functions in schema auth to anon,authenticated;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;grant usage on schema storage to anon,authenticated;grant all on storage.objects to authenticated;grant select on storage.objects to anon;
`);
const root=__dirname+'/../';let sql=fs.readFileSync(__dirname+'/fixtures/legacy-schema.sql','utf8').replace('create extension if not exists pgcrypto;','');await db.exec(sql);await db.exec(`insert into platform_state values('main','{"platform":{"brandName":"legacy"},"attempts":[{"id":"preserve"}]}',now()) on conflict(id) do update set data=excluded.data`);console.log('PASS legacy fixture');
await db.exec(fs.readFileSync(root+'supabase/01_UPGRADE_V17_1.sql','utf8'));assert.equal((await db.query("select data->'attempts'->0->>'id' as id from platform_state where id='v17_0_backup'")).rows[0].id,'preserve');console.log('PASS existing upgrade preserves legacy data');
const owner='11111111-1111-4111-8111-111111111111',a='22222222-2222-4222-8222-222222222222',b='33333333-3333-4333-8333-333333333333';
await db.exec(`insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values ('${owner}','m.samra103@gmail.com',now(),'{}'),('${a}','a@test.invalid',now(),'{"role":"admin"}'),('${b}','b@test.invalid',now(),'{}');`);
assert.equal((await db.query(`select role from profiles where id='${a}'`)).rows[0].role,'teacher');console.log('PASS signup cannot self-assign admin');
await db.exec(`insert into auth.users(id,email,raw_user_meta_data) values ('44444444-4444-4444-8444-444444444444','unverified@test.invalid','{"role":"admin"}')`);

async function as(role,id,email,query){await db.exec(`set role ${role};select set_config('request.jwt.claim.sub','${id||''}',false);select set_config('request.jwt.claims','${JSON.stringify({email:email||''})}',false);`);try{return await db.query(query)}finally{await db.exec(`reset role;select set_config('request.jwt.claim.sub','',false);`)}}
async function denied(role,id,email,q,label){let failed=false;try{await as(role,id,email,q)}catch(e){failed=true}assert(failed,label);console.log('PASS '+label)}
await as('authenticated',owner,'m.samra103@gmail.com',`insert into platform_state values('public','{"platform":{"brandName":"test","ai":{"apiKey":"secret"}},"attempts":[{"student_name":"private"}]}',now()),('main','{"admins":[],"attempts":[{"student_name":"private"}]}',now()) on conflict(id) do update set data=excluded.data`);
const publicRows=(await as('anon',null,null,'select id,data from platform_state')).rows;assert.deepEqual(publicRows.map(r=>r.id),['public']);assert(!JSON.stringify(publicRows).includes('secret'));assert(!JSON.stringify(publicRows).includes('private'));console.log('PASS anonymous sees only sanitized settings');
await denied('anon',null,null,`delete from platform_state`,'anonymous cannot delete state');
await denied('authenticated',a,'a@test.invalid',`update profiles set role='admin' where id='${a}'`,'teacher cannot promote self');
await denied('authenticated',a,'a@test.invalid',`update profiles set school_id=gen_random_uuid() where id='${a}'`,'teacher cannot change administrative school');
await db.exec(`update profiles set status='موقوف' where id='${a}'`);
await denied('authenticated',a,'a@test.invalid',`update profiles set status='نشط' where id='${a}'`,'suspended teacher cannot reactivate self');
await db.exec(`update profiles set status='نشط' where id='${a}'`);

await as('authenticated',a,'a@test.invalid',`insert into manarat_games(id,teacher_id,title,status,data) values('ga','${a}','Test','published','{}')`);
await as('authenticated',a,'a@test.invalid',`update manarat_games set is_public=true where id='ga'`);assert.equal((await db.query("select is_public from manarat_games where id='ga'")).rows[0].is_public,false);await as('authenticated',owner,'m.samra103@gmail.com',`update manarat_games set is_public=true where id='ga'`);assert.equal((await db.query("select is_public from manarat_games where id='ga'")).rows[0].is_public,true);console.log('PASS public-library approval requires admin');
let result=await as('authenticated',b,'b@test.invalid',`update manarat_games set title='stolen' where id='ga' returning id`);assert.equal(result.rows.length,0);console.log('PASS teacher cannot alter another game');
await denied('authenticated',a,'a@test.invalid',`update manarat_games set teacher_id='${b}' where id='ga'`,'teacher cannot transfer ownership');
await as('anon',null,null,`select public.submit_manarat_attempt('{"id":"a1","game_id":"ga","score":80,"student_name":"طالب تجريبي"}')`);
await denied('anon',null,null,'select * from manarat_attempts','anonymous cannot read results');
assert.equal((await as('authenticated',a,'a@test.invalid','select * from manarat_attempts')).rows.length,1);assert.equal((await as('authenticated',b,'b@test.invalid','select * from manarat_attempts')).rows.length,0);console.log('PASS results visible only to owner');
await denied('anon',null,null,`select public.submit_manarat_attempt('{"id":"bad","game_id":"missing","score":80}')`,'unknown game result rejected');
await denied('anon',null,null,`select public.submit_manarat_attempt('{"id":"bad","game_id":"ga","score":800}')`,'invalid score rejected');
await as('authenticated',a,'a@test.invalid',`insert into storage.objects(bucket_id,name) values('manarat-assets','uploads/${a}/image.png')`);
result=await as('authenticated',b,'b@test.invalid',`delete from storage.objects returning id`);assert.equal(result.rows.length,0);console.log('PASS storage owner protection');
await db.exec("create schema extensions; create function extensions.gen_random_bytes(n integer) returns bytea language sql as $$select decode(repeat('ab',n),'hex')$$;");
await db.exec(fs.readFileSync(root+'supabase/02_SCHOOL_V19.sql','utf8'));
await denied('anon',null,null,'select * from school_sessions','school student records inaccessible to anonymous');
await denied('authenticated',a,'a@test.invalid','select * from school_sessions','school data accessible only through checked API');
assert.equal((await as('anon',null,null,'select * from manarat_games')).rows.length,0);
console.log('PASS school migration and private answer keys');

await db.exec(`update platform_state set data=jsonb_set(data,'{admins}','[{"email":"b@test.invalid","active":true}]') where id='main'`);
await db.exec(fs.readFileSync(root+'supabase/03_ADMIN_V19_2.sql','utf8'));
assert.equal((await db.query(`select role from profiles where id='${b}'`)).rows[0].role,'admin');
await db.exec(`update profiles set role='teacher' where id='${b}'`);
assert.equal((await as('authenticated',b,'b@test.invalid','select public.is_admin(auth.uid()) as allowed')).rows[0].allowed,false);
assert.equal((await as('authenticated',owner,'m.samra103@gmail.com','select public.is_admin(auth.uid()) as allowed')).rows[0].allowed,true);
console.log('PASS legacy role migration and immediate revocation');
await db.close();console.log('SQL ALL PASS');})().catch(e=>{console.error(e);process.exit(1)});
