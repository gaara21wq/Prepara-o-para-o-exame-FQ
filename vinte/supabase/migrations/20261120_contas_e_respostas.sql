-- Aplicado no projeto Supabase "Vinte" (sfypvbxeltbjdieyrksf) a 20/11/2026.
-- Perfis dos utilizadores (1 por conta). Mais tarde: papel (aluno/explicador), centro, turma.
create table public.perfis (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text check (nome is null or char_length(nome) <= 80),
  criado_em timestamptz not null default now()
);

-- Última resposta de cada aluno a cada pergunta (o id da pergunta vem dos ficheiros JSON).
create table public.respostas (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  questao_id text not null check (char_length(questao_id) between 1 and 64),
  tentativas integer not null default 1 check (tentativas >= 0),
  certas integer not null default 0 check (certas >= 0 and certas <= tentativas),
  ultima boolean not null,
  atualizado_em timestamptz not null default now(),
  primary key (user_id, questao_id)
);

alter table public.perfis enable row level security;
alter table public.respostas enable row level security;

-- Cada pessoa só vê e altera os seus próprios dados.
create policy "perfil: ver o próprio" on public.perfis
  for select to authenticated using ((select auth.uid()) = id);
create policy "perfil: alterar o próprio" on public.perfis
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "respostas: ver as próprias" on public.respostas
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "respostas: criar as próprias" on public.respostas
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "respostas: alterar as próprias" on public.respostas
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "respostas: apagar as próprias" on public.respostas
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Acesso pela API só para contas autenticadas (visitantes anónimos não veem nada).
revoke all on public.perfis, public.respostas from anon;
grant select, update on public.perfis to authenticated;
grant select, insert, update, delete on public.respostas to authenticated;

-- Criar o perfil automaticamente quando alguém cria conta.
create function public.criar_perfil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.perfis (id) values (new.id) on conflict do nothing;
  return new;
end;
$$;
revoke execute on function public.criar_perfil() from public, anon, authenticated;

create trigger ao_criar_conta
  after insert on auth.users
  for each row execute function public.criar_perfil();

-- Função do Supabase que ativa RLS em tabelas novas (event trigger). Não precisa de ser chamada pela API.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
