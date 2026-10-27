-- Automatic question -> fastest-correct celebration -> next question.
-- Existing sessions retain the teacher's auto/manual setting; new sessions default to auto.
-- No table is made public, no answer key is returned before reveal, and final awards stay host-controlled.
alter table public.live_rooms alter column auto_advance set default true;
revoke all on public.live_rooms,public.live_players,public.live_answers from public,anon,authenticated;
grant select,insert,update,delete on public.live_rooms,public.live_players,public.live_answers to service_role;
create or replace function public.live_session(p_action text,p_data jsonb,p_actor uuid default null,p_secret text default '')
returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.live_rooms%rowtype; player public.live_players%rowtype; prof public.profiles%rowtype;
 assignment_row public.school_assignments%rowtype; qs jsonb; allq jsonb; q jsonb; board jsonb; mine jsonb; report jsonb; round_winners jsonb:='[]'::jsonb;
 t timestamptz; admin boolean:=false; host boolean:=false; n integer; v integer; elapsed integer; points integer; ok boolean;
 code_new text; skipped integer:=0; maxpoints integer; educational_total integer;
begin
 if p_actor is not null then
  select * into prof from public.profiles where id=p_actor and status<>'موقوف' and role in ('admin','teacher');
  if not found then raise exception 'الحساب غير متاح.'; end if; admin:=prof.role='admin';
 end if;
 if p_action='list' then
  if p_actor is null then raise exception 'سجّل الدخول أولًا.'; end if;
  return coalesce((select jsonb_agg(to_jsonb(x)) from (select id,code,title,phase,created_at,finished_at from public.live_rooms where teacher_id=p_actor or admin order by created_at desc limit 50)x),'[]');
 end if;
 if p_action='create' then
  if p_actor is null then raise exception 'سجّل الدخول أولًا.'; end if;
  select * into assignment_row from public.school_assignments where id=(p_data->>'assignment')::uuid and (teacher_id=p_actor or admin);
  if not found or not assignment_row.active then raise exception 'المهمة غير متاحة أو لا تملك صلاحيتها.'; end if;
  if nullif(assignment_row.settings->>'deadline','')::timestamptz<now() then raise exception 'انتهى موعد المهمة.'; end if;
  select data->'questions' into allq from public.manarat_games where id=assignment_row.game_id and teacher_id=assignment_row.teacher_id;
  select jsonb_agg(jsonb_build_object('text',left(x->>'text',5000),'type',x->>'type','options',
   case when x->>'type'='true_false' then coalesce(x->'options','["صح","خطأ"]'::jsonb) else x->'options' end,
   'correct',(x->>'correct')::int,'points',greatest(1,least(100,coalesce((x->>'points')::int,10))), 'explanation',left(coalesce(x->>'explanation',''),2000)) order by ord) into qs
   from jsonb_array_elements(coalesce(allq,'[]')) with ordinality e(x,ord)
   where x->>'type' in ('multiple_choice','true_false') and (assignment_row.settings->'types' is null or assignment_row.settings->'types' ? (x->>'type'))
   and jsonb_typeof(x->'correct')='number' and (x->>'correct') ~ '^[0-9]+$'
   and jsonb_typeof(coalesce(x->'options','["صح","خطأ"]'::jsonb))='array'
   and jsonb_array_length(coalesce(x->'options','["صح","خطأ"]'::jsonb)) between 2 and 6
   and (x->>'correct')::int<jsonb_array_length(coalesce(x->'options','["صح","خطأ"]'::jsonb));
  if qs is null then raise exception 'لا توجد أسئلة اختيار من متعدد أو صح وخطأ صالحة للمسابقة المباشرة.'; end if;
  qs=(select jsonb_agg(value) from (select value from jsonb_array_elements(qs) limit 100)x);
  skipped:=jsonb_array_length(allq)-jsonb_array_length(qs);
  if (select count(*) from public.live_rooms where teacher_id=p_actor and phase<>'finished' and expires_at>now())>=5 then raise exception 'أنهِ إحدى جلساتك المفتوحة أولًا (الحد ٥).'; end if;
  for n in 1..20 loop
   code_new:=lpad(floor(random()*1000000)::int::text,6,'0');
   insert into public.live_rooms(code,teacher_id,assignment_id,title,questions,duration,speed_bonus,auto_advance)
    values(code_new,p_actor,assignment_row.id,assignment_row.title,qs,greatest(10,least(120,coalesce((p_data->>'duration')::int,30))),coalesce((p_data->>'speed')::boolean,false),coalesce((p_data->>'auto')::boolean,true))
    on conflict(code) do nothing returning * into r;
   exit when r.id is not null;
  end loop;
  if r.id is null then raise exception 'تعذر إنشاء الكود. أعد المحاولة.'; end if;
  return jsonb_build_object('code',r.code,'count',jsonb_array_length(qs),'skipped',skipped);
 end if;
 -- Serialize transitions and submissions in each room. Take the server timestamp AFTER the lock.
 select * into r from public.live_rooms where code=p_data->>'code' for update;
 if not found then raise exception 'كود الجلسة غير صحيح.'; end if;
 t:=clock_timestamp(); host:=p_actor is not null and (r.teacher_id=p_actor or admin);
 if p_actor is not null and not host then raise exception 'هذه الجلسة تخص معلمًا آخر.'; end if;
 if not host then
  if length(p_secret)<>64 then raise exception 'بيانات المشاركة غير صالحة.'; end if;
  select * into player from public.live_players where room_id=r.id and secret_hash=p_secret;
  if p_action='join' and player.id is null then
   if r.locked or r.phase<>'lobby' or r.expires_at<t then raise exception 'أُغلق الانضمام إلى هذه الجلسة.'; end if;
   if length(trim(coalesce(p_data->>'name',''))) not between 2 and 40 then raise exception 'اكتب اسمًا من حرفين إلى ٤٠ حرفًا.'; end if;
   if (select count(*) from public.live_players where room_id=r.id)>=80 then raise exception 'اكتمل عدد المشاركين (٨٠).'; end if;
   insert into public.live_players(room_id,secret_hash,name,avatar) values(r.id,p_secret,trim(p_data->>'name'),case when coalesce(p_data->>'avatar','') ~ '^qatar-(0[1-9]|1[0-2])$' then p_data->>'avatar' else 'qatar-01' end) returning * into player;
  end if;
  if player.id is null or player.blocked then raise exception 'المشاركة غير متاحة. اطلب المساعدة من المعلم.'; end if;
 end if;
 -- No answer key or rank derived from the current answer is released during an open question.
 if r.expires_at<t and r.phase<>'finished' then r.phase:='finished';r.finished_at:=t;r.locked:=true;r.version:=r.version+1;end if;
 if r.phase='question' and t>=r.deadline then r.phase:='reveal';r.deadline:=t+interval '8 seconds';r.version:=r.version+1;end if;
 if r.phase='reveal' and r.auto_advance and t>=r.deadline then
  if r.question_index+1>=jsonb_array_length(r.questions) then r.phase:='finished';r.finished_at:=t;
  else r.question_index:=r.question_index+1;r.phase:='question';r.starts_at:=t+interval '3 seconds';r.deadline:=r.starts_at+make_interval(secs=>r.duration);end if;
  r.version:=r.version+1;
 end if;
 if p_action in ('close_awards','replay_awards') then
  if not host then raise exception 'إنهاء التتويج للمعلم فقط.'; end if;
  if r.phase='finished' and (p_data->>'version')::int=r.version then r.awards_closed:=(p_action='close_awards');r.version:=r.version+1;end if;
 end if;
 if p_action in ('start','next','reveal','pause','resume','lock','kick','finish') then
  if not host then raise exception 'هذا الإجراء للمعلم فقط.'; end if;
  if (p_data->>'version')::integer is distinct from r.version then
   -- Stale/repeated controls only refresh the state; they cannot skip a question.
   null;
  elsif p_action='start' and r.phase='lobby' then
   if not exists(select 1 from public.live_players where room_id=r.id and not blocked) then raise exception 'انتظر انضمام طالب واحد على الأقل.'; end if;
   r.locked:=true;r.phase:='question';r.question_index:=0;r.starts_at:=t+interval '3 seconds';r.deadline:=r.starts_at+make_interval(secs=>r.duration);r.version:=r.version+1;
  elsif p_action='next' and r.phase='reveal' then
   if r.question_index+1>=jsonb_array_length(r.questions) then r.phase:='finished';r.finished_at:=t;
   else r.question_index:=r.question_index+1;r.phase:='question';r.starts_at:=t+interval '3 seconds';r.deadline:=r.starts_at+make_interval(secs=>r.duration);end if;r.version:=r.version+1;
  elsif p_action='reveal' and r.phase='question' then r.phase:='reveal';r.deadline:=t+interval '8 seconds';r.version:=r.version+1;
  elsif p_action='pause' and r.phase='question' and t>=r.starts_at then
   r.remaining_ms:=greatest(0,floor(extract(epoch from r.deadline-t)*1000)::int);r.phase:='paused';r.version:=r.version+1;
  elsif p_action='resume' and r.phase='paused' then
   r.deadline:=t+make_interval(secs=>r.remaining_ms/1000.0);r.starts_at:=r.deadline-make_interval(secs=>r.duration);r.phase:='question';r.version:=r.version+1;
  elsif p_action='lock' and r.phase='lobby' then r.locked:=not r.locked;r.version:=r.version+1;
  elsif p_action='kick' and r.phase<>'finished' then
   update public.live_players set blocked=true where room_id=r.id and id=(p_data->>'player')::uuid;r.version:=r.version+1;
  elsif p_action='finish' and r.phase<>'finished' then r.phase:='finished';r.finished_at:=t;r.locked:=true;r.version:=r.version+1;
  end if;
 end if;
 if p_action='answer' then
  if host then raise exception 'المعلم لا يرسل إجابات الطلاب.'; end if;
  if exists(select 1 from public.live_answers where room_id=r.id and player_id=player.id and question_index=(p_data->>'index')::int) then null;
  elsif r.phase<>'question' or t<r.starts_at or t>=r.deadline or (p_data->>'index')::int is distinct from r.question_index then raise exception 'انتهى وقت السؤال أو توقفت الجلسة.';
  else
   q:=r.questions->r.question_index;v:=(p_data->>'choice')::int;
   if v is null or v<0 or v>=jsonb_array_length(q->'options') then raise exception 'اختيار غير صالح.'; end if;
   ok:=v=(q->>'correct')::int;elapsed:=greatest(0,floor(extract(epoch from t-r.starts_at)*1000)::int);
   points:=case when not ok then 0 when r.speed_bonus then 500+greatest(0,floor(500.0*(1.0-elapsed/(r.duration*1000.0)))::int) else 1000 end;
   insert into public.live_answers(room_id,player_id,question_index,choice,correct,points,education_points,elapsed_ms)
    values(r.id,player.id,r.question_index,v,ok,points,case when ok then (q->>'points')::int else 0 end,elapsed) on conflict do nothing;
  end if;
 end if;
 update public.live_rooms set phase=r.phase,question_index=r.question_index,locked=r.locked,starts_at=r.starts_at,deadline=r.deadline,
 awards_closed=r.awards_closed,remaining_ms=r.remaining_ms,version=r.version,finished_at=r.finished_at where id=r.id and (phase,question_index,locked,version) is distinct from (r.phase,r.question_index,r.locked,r.version);
 select coalesce(sum((x->>'points')::int),0) into educational_total from jsonb_array_elements(r.questions)x;
 select coalesce(jsonb_agg(to_jsonb(z) order by z.rank,z.name,z.id),'[]') into board from (
  select s.*,dense_rank() over(order by s.points desc) rank from (
   select p.id,p.name,p.avatar,coalesce(sum(a.points),0)::int points,count(a.*) filter(where a.correct)::int correct,
    coalesce(sum(a.education_points),0)::int education_points,round(100.0*coalesce(sum(a.education_points),0)/greatest(1,educational_total))::int grade
   from public.live_players p left join public.live_answers a on a.player_id=p.id and a.room_id=r.id
    and (r.phase in ('reveal','finished') or a.question_index<r.question_index)
   where p.room_id=r.id and not p.blocked group by p.id,p.name
  )s
 )z;
 -- Reveal only the fastest correct answers to THIS question. Competition totals
 -- and speed-bonus settings must never choose the question winner. Exact ties share it.
 if r.phase='reveal' then
  select coalesce(jsonb_agg(jsonb_build_object('id',w.id,'name',w.name,'avatar',w.avatar,
    'elapsed_ms',w.elapsed_ms,'points',w.points) order by w.name,w.id),'[]'::jsonb)
   into round_winners from (
    select p.id,p.name,p.avatar,a.elapsed_ms,a.points,
      dense_rank() over(order by a.elapsed_ms) as speed_rank
    from public.live_answers a join public.live_players p on p.id=a.player_id and p.room_id=a.room_id
    where a.room_id=r.id and a.question_index=r.question_index and a.correct and not p.blocked
   ) w where w.speed_rank=1;
 end if;
 if not host then
  select jsonb_build_object('choice',choice,'correct',case when r.phase in ('reveal','finished') then correct else null end,
   'points',case when r.phase in ('reveal','finished') then ans.points else null end) into mine
   from public.live_answers ans where room_id=r.id and player_id=player.id and question_index=r.question_index;
 end if;
 if p_action='report' then
  if not host or r.phase<>'finished' then raise exception 'التقرير متاح للمعلم بعد نهاية الجلسة.'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('name',p.name,'question',a.question_index+1,'choice',a.choice,'correct',a.correct,'points',a.points,'education_points',a.education_points,'elapsed_ms',a.elapsed_ms) order by p.name,a.question_index),'[]') into report
   from public.live_answers a join public.live_players p on p.id=a.player_id where a.room_id=r.id and not p.blocked;
 end if;
 q:=r.questions->r.question_index;
 return jsonb_build_object('code',r.code,'title',r.title,'host',host,'phase',r.phase,'index',r.question_index,'total',jsonb_array_length(r.questions),'duration',r.duration,
  'awards_closed',r.awards_closed,'finished_at',r.finished_at,'speed',r.speed_bonus,'auto',r.auto_advance,'locked',r.locked,'version',r.version,'server_time',t,'starts_at',r.starts_at,'deadline',r.deadline,'remaining_ms',r.remaining_ms,
  'question',case when r.phase in ('question','paused','reveal') then jsonb_build_object('text',q->>'text','options',q->'options','type',q->>'type',
   'correct',case when r.phase='reveal' then q->'correct' else null end,'explanation',case when r.phase='reveal' then q->>'explanation' else null end) else null end,
  'round_winners',round_winners,'reveal_duration',8,'players',board,'me',player.id,'answer',mine,'report',report,'answered',
  (select count(*) from public.live_answers a join public.live_players p on p.id=a.player_id where a.room_id=r.id and a.question_index=r.question_index and not p.blocked));
end; $$;
revoke all on function public.live_session(text,jsonb,uuid,text) from public,anon,authenticated;
grant execute on function public.live_session(text,jsonb,uuid,text) to service_role;
