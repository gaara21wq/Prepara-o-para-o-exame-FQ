-- Centro de demonstração só de leitura.
-- Quem entra numa conta de um centro com demo = true vê tudo, mas não consegue alterar nada:
-- políticas RESTRICTIVE bloqueiam escritas, a Edge Function "contas" recusa ações
-- e um trigger em auth.users impede que mudem a password ou o email das contas demo.

alter table public.centros add column if not exists demo boolean not null default false;

create or replace function privado.sou_demo()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.perfis p join public.centros c on c.id = p.centro_id
    where p.id = (select auth.uid()) and c.demo
  )
$$;
revoke all on function privado.sou_demo() from public, anon;
grant execute on function privado.sou_demo() to authenticated, service_role;

do $$
declare t text;
begin
  foreach t in array array['turmas', 'turma_alunos', 'trabalhos', 'entregas', 'respostas', 'perfis'] loop
    execute format('drop policy if exists "demo: sem inserir" on public.%I', t);
    execute format('drop policy if exists "demo: sem alterar" on public.%I', t);
    execute format('drop policy if exists "demo: sem apagar" on public.%I', t);
    execute format('create policy "demo: sem inserir" on public.%I as restrictive for insert to authenticated with check (not (select privado.sou_demo()))', t);
    execute format('create policy "demo: sem alterar" on public.%I as restrictive for update to authenticated using (not (select privado.sou_demo())) with check (not (select privado.sou_demo()))', t);
    execute format('create policy "demo: sem apagar" on public.%I as restrictive for delete to authenticated using (not (select privado.sou_demo()))', t);
  end loop;
end $$;

-- Impede mudar a password/email das contas de demonstração (mesmo pela API de autenticação).
create or replace function privado.proteger_contas_demo()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.perfis p join public.centros c on c.id = p.centro_id
             where p.id = old.id and c.demo) then
    new.encrypted_password := old.encrypted_password;
    new.email := old.email;
    new.email_change := old.email_change;
    new.email_change_token_new := old.email_change_token_new;
  end if;
  return new;
end $$;
revoke all on function privado.proteger_contas_demo() from public, anon, authenticated;

drop trigger if exists proteger_contas_demo on auth.users;
create trigger proteger_contas_demo before update on auth.users
  for each row execute function privado.proteger_contas_demo();
