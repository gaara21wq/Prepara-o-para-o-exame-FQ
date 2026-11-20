-- Aplicado no projeto Supabase "Vinte" a 20/11/2026.
-- Modelo fechado (como na PAP): só o explicador cria contas de alunos; acesso depende da licença do centro.

-- ---------- centros ----------
create table public.centros (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(nome) between 2 and 120),
  max_alunos integer not null check (max_alunos between 1 and 2000),
  licenca_ate date not null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
alter table public.centros enable row level security;

-- ---------- perfis: papel, centro, estado ----------
alter table public.perfis
  add column nome_utilizador text unique check (nome_utilizador ~ '^[a-z0-9][a-z0-9._-]{2,39}$'),
  add column papel text not null default 'aluno' check (papel in ('admin', 'explicador', 'aluno')),
  add column centro_id uuid references public.centros (id) on delete set null,
  add column ativa boolean not null default false,
  add column deve_mudar_palavra_passe boolean not null default true,
  add column criado_por uuid references auth.users (id) on delete set null;
create index perfis_centro_idx on public.perfis (centro_id);

-- ---------- funções auxiliares (evitam recursão nas regras) ----------
create function public.meu_papel() returns text
language sql stable security definer set search_path = '' as $$
  select papel from public.perfis where id = (select auth.uid())
$$;

create function public.meu_centro() returns uuid
language sql stable security definer set search_path = '' as $$
  select centro_id from public.perfis where id = (select auth.uid())
$$;

-- Conta ativa e (admin, ou centro ativo com licença dentro do prazo).
create function public.tem_acesso() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.perfis p
    left join public.centros c on c.id = p.centro_id
    where p.id = (select auth.uid())
      and p.ativa
      and (p.papel = 'admin' or (c.ativo and c.licenca_ate >= current_date))
  )
$$;

-- Depois de mudar a password no primeiro login.
create function public.marcar_palavra_passe_mudada() returns void
language sql volatile security definer set search_path = '' as $$
  update public.perfis set deve_mudar_palavra_passe = false where id = (select auth.uid())
$$;

revoke execute on function public.meu_papel(), public.meu_centro(), public.tem_acesso(),
  public.marcar_palavra_passe_mudada() from public, anon;
grant execute on function public.meu_papel(), public.meu_centro(), public.tem_acesso(),
  public.marcar_palavra_passe_mudada() to authenticated;

-- ---------- regras: centros ----------
create policy "centro: ver o próprio (ou admin)" on public.centros
  for select to authenticated
  using (id = (select public.meu_centro()) or (select public.meu_papel()) = 'admin');
grant select on public.centros to authenticated;

-- ---------- regras: perfis ----------
-- O aluno não pode mudar o próprio papel, centro ou estado: só o nome (as contas são geridas pela Edge Function).
drop policy "perfil: alterar o próprio" on public.perfis;
revoke update on public.perfis from authenticated;
grant update (nome) on public.perfis to authenticated;
create policy "perfil: alterar o próprio nome" on public.perfis
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "perfil: explicador vê os do seu centro" on public.perfis
  for select to authenticated
  using ((select public.meu_papel()) = 'explicador' and centro_id = (select public.meu_centro()));
create policy "perfil: admin vê todos" on public.perfis
  for select to authenticated using ((select public.meu_papel()) = 'admin');

-- ---------- regras: respostas ----------
-- Só quem tem acesso (licença ativa) grava respostas.
drop policy "respostas: criar as próprias" on public.respostas;
drop policy "respostas: alterar as próprias" on public.respostas;
create policy "respostas: criar as próprias" on public.respostas
  for insert to authenticated with check ((select auth.uid()) = user_id and (select public.tem_acesso()));
create policy "respostas: alterar as próprias" on public.respostas
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and (select public.tem_acesso()));
-- O explicador vê as respostas dos alunos do seu centro (painel da turma).
create policy "respostas: explicador vê as do seu centro" on public.respostas
  for select to authenticated
  using (
    (select public.meu_papel()) = 'explicador'
    and exists (select 1 from public.perfis p where p.id = respostas.user_id and p.centro_id = (select public.meu_centro()))
  );

-- ---------- perguntas (só para quem tem acesso) ----------
create table public.questoes (
  id text primary key,
  disciplina text not null check (disciplina in ('fq', 'mat')),
  dados jsonb not null
);
create index questoes_disciplina_idx on public.questoes (disciplina);
alter table public.questoes enable row level security;
create policy "questões: só com licença ativa" on public.questoes
  for select to authenticated using ((select public.tem_acesso()));
revoke all on public.questoes from anon;
grant select on public.questoes to authenticated;

-- ---------- perfil novo: começa inativo e sem centro ----------
-- (uma conta criada fora da Edge Function não tem acesso a nada)
create or replace function public.criar_perfil()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.perfis (id, ativa) values (new.id, false) on conflict do nothing;
  return new;
end;
$$;
revoke execute on function public.criar_perfil() from public, anon, authenticated;

-- As funções usadas pelas regras RLS passam para um schema que não está exposto na API.
create schema if not exists privado;
revoke all on schema privado from public, anon;
grant usage on schema privado to authenticated;
alter function public.meu_papel() set schema privado;
alter function public.meu_centro() set schema privado;
alter function public.tem_acesso() set schema privado;

-- A Edge Function usa o papel service_role (ignora RLS), mas precisa de permissões nas tabelas
-- (o projeto foi criado sem "grant API access to new tables automatically").
grant usage on schema public to service_role;
grant select, insert, update, delete on public.perfis, public.respostas, public.centros, public.questoes to service_role;
grant usage on schema privado to service_role;
