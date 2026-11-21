-- Aplicado no projeto Supabase "Vinte" a 20/11/2026.
-- Turmas dentro de cada centro, trabalhos de casa (TPC) e entregas dos alunos.

create or replace function privado.sou_explicador_ativo() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.perfis p join public.centros c on c.id = p.centro_id
    where p.id = (select auth.uid()) and p.papel = 'explicador' and p.ativa
      and c.ativo and c.licenca_ate >= current_date
  )
$$;
revoke execute on function privado.sou_explicador_ativo() from public, anon;
grant execute on function privado.sou_explicador_ativo() to authenticated, service_role;

-- ---------- turmas ----------
create table public.turmas (
  id uuid primary key default gen_random_uuid(),
  centro_id uuid not null references public.centros (id) on delete cascade default (privado.meu_centro()),
  nome text not null check (char_length(nome) between 1 and 60),
  criado_em timestamptz not null default now()
);
create index turmas_centro_idx on public.turmas (centro_id);

create table public.turma_alunos (
  turma_id uuid not null references public.turmas (id) on delete cascade,
  aluno_id uuid not null references public.perfis (id) on delete cascade,
  primary key (turma_id, aluno_id)
);
create index turma_alunos_aluno_idx on public.turma_alunos (aluno_id);

-- Turmas do próprio aluno (security definer para não haver recursão nas regras).
create or replace function privado.minhas_turmas() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select turma_id from public.turma_alunos where aluno_id = (select auth.uid())
$$;
revoke execute on function privado.minhas_turmas() from public, anon;
grant execute on function privado.minhas_turmas() to authenticated, service_role;

alter table public.turmas enable row level security;
alter table public.turma_alunos enable row level security;

create policy "turmas: explicador gere as do seu centro" on public.turmas
  for all to authenticated
  using (centro_id = (select privado.meu_centro()) and (select privado.sou_explicador_ativo()))
  with check (centro_id = (select privado.meu_centro()) and (select privado.sou_explicador_ativo()));
create policy "turmas: aluno vê as suas" on public.turmas
  for select to authenticated using (id in (select privado.minhas_turmas()));

create policy "turma_alunos: explicador gere as do seu centro" on public.turma_alunos
  for all to authenticated
  using ((select privado.sou_explicador_ativo())
         and exists (select 1 from public.turmas t where t.id = turma_id and t.centro_id = (select privado.meu_centro())))
  with check ((select privado.sou_explicador_ativo())
         and exists (select 1 from public.turmas t where t.id = turma_id and t.centro_id = (select privado.meu_centro()))
         and exists (select 1 from public.perfis p where p.id = aluno_id and p.papel = 'aluno' and p.centro_id = (select privado.meu_centro())));
create policy "turma_alunos: aluno vê as suas" on public.turma_alunos
  for select to authenticated using (aluno_id = (select auth.uid()));

-- ---------- trabalhos de casa ----------
create table public.trabalhos (
  id uuid primary key default gen_random_uuid(),
  turma_id uuid not null references public.turmas (id) on delete cascade,
  titulo text not null check (char_length(titulo) between 1 and 120),
  disciplina text not null check (disciplina in ('fq', 'mat')),
  questoes text[] not null check (cardinality(questoes) between 1 and 60),
  prazo date,
  criado_por uuid default auth.uid() references auth.users (id) on delete set null,
  criado_em timestamptz not null default now()
);
create index trabalhos_turma_idx on public.trabalhos (turma_id);

create table public.entregas (
  trabalho_id uuid not null references public.trabalhos (id) on delete cascade,
  aluno_id uuid not null default auth.uid() references public.perfis (id) on delete cascade,
  certas integer not null check (certas >= 0),
  total integer not null check (total > 0 and certas <= total),
  detalhe jsonb not null default '{}'::jsonb,
  entregue_em timestamptz not null default now(),
  primary key (trabalho_id, aluno_id)
);

alter table public.trabalhos enable row level security;
alter table public.entregas enable row level security;

create policy "trabalhos: explicador gere os do seu centro" on public.trabalhos
  for all to authenticated
  using ((select privado.sou_explicador_ativo())
         and exists (select 1 from public.turmas t where t.id = turma_id and t.centro_id = (select privado.meu_centro())))
  with check ((select privado.sou_explicador_ativo())
         and exists (select 1 from public.turmas t where t.id = turma_id and t.centro_id = (select privado.meu_centro())));
create policy "trabalhos: aluno vê os das suas turmas" on public.trabalhos
  for select to authenticated using (turma_id in (select privado.minhas_turmas()) and (select privado.tem_acesso()));

create policy "entregas: aluno entrega os seus" on public.entregas
  for insert to authenticated
  with check (aluno_id = (select auth.uid()) and (select privado.tem_acesso())
              and exists (select 1 from public.trabalhos w where w.id = trabalho_id and w.turma_id in (select privado.minhas_turmas())));
create policy "entregas: aluno refaz os seus" on public.entregas
  for update to authenticated
  using (aluno_id = (select auth.uid()))
  with check (aluno_id = (select auth.uid()) and (select privado.tem_acesso()));
create policy "entregas: aluno vê os seus" on public.entregas
  for select to authenticated using (aluno_id = (select auth.uid()));
create policy "entregas: explicador vê os do seu centro" on public.entregas
  for select to authenticated
  using ((select privado.meu_papel()) = 'explicador'
         and exists (select 1 from public.trabalhos w join public.turmas t on t.id = w.turma_id
                     where w.id = trabalho_id and t.centro_id = (select privado.meu_centro())));

revoke all on public.turmas, public.turma_alunos, public.trabalhos, public.entregas from anon;
grant select, insert, update, delete on public.turmas, public.turma_alunos, public.trabalhos to authenticated;
grant select, insert, update on public.entregas to authenticated;
grant select, insert, update, delete on public.turmas, public.turma_alunos, public.trabalhos, public.entregas to service_role;
