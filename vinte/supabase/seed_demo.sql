-- Centro de demonstração (só de leitura). Pode ser corrido outra vez: apaga e recria o centro demo.
-- Contas: demo / vinte-demo (explicador) e demo-aluno / vinte-demo (aluno).
do $$
declare
  v_centro uuid;
  v_pass text := extensions.crypt('vinte-demo', extensions.gen_salt('bf'));
  v_expl uuid;
  v_t11 uuid; v_t12 uuid;
  v_w uuid;
  r record; a record;
  v_ids uuid[] := '{}';
  v_nomes text[] := array['Aluno Demonstração','Ana Ferreira','Bruno Costa','Carolina Sousa','Diogo Martins','Inês Rodrigues','João Pereira','Mariana Lopes','Tiago Almeida'];
  v_users text[] := array['demo-aluno','demo.ana','demo.bruno','demo.carolina','demo.diogo','demo.ines','demo.joao','demo.mariana','demo.tiago'];
  i int; v_id uuid; v_skill float; v_qs text[]; v_det jsonb; v_cert int; q text;
begin
  -- limpar demo anterior
  delete from auth.users where id in (select p.id from public.perfis p join public.centros c on c.id = p.centro_id where c.demo);
  delete from public.centros where demo;

  insert into public.centros (nome, max_alunos, licenca_ate, ativo, demo)
  values ('Centro de Explicações (demonstração)', 30, '2099-12-31', true, true) returning id into v_centro;

  -- função auxiliar inline para criar utilizador
  for i in 0 .. array_length(v_users, 1) loop
    v_id := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      email_change_token_current, phone_change, phone_change_token, reauthentication_token)
    values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
      (case when i = 0 then 'demo' else v_users[i] end) || '@contas.vinte.invalid', v_pass, now(),
      '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '', '', '', '', '');
    insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (v_id::text, v_id, jsonb_build_object('sub', v_id::text, 'email', (case when i = 0 then 'demo' else v_users[i] end) || '@contas.vinte.invalid', 'email_verified', true),
      'email', now(), now(), now());
    if i = 0 then
      v_expl := v_id;
      insert into public.perfis (id, nome, nome_utilizador, papel, centro_id, ativa, deve_mudar_palavra_passe)
      values (v_id, 'Prof.ª Demonstração', 'demo', 'explicador', v_centro, true, false)
      on conflict (id) do update set nome = excluded.nome, nome_utilizador = excluded.nome_utilizador, papel = excluded.papel,
        centro_id = excluded.centro_id, ativa = true, deve_mudar_palavra_passe = false;
    else
      v_ids := v_ids || v_id;
      insert into public.perfis (id, nome, nome_utilizador, papel, centro_id, ativa, deve_mudar_palavra_passe, criado_por, criado_em)
      values (v_id, v_nomes[i], v_users[i], 'aluno', v_centro, true, false, v_expl, now() - interval '60 days')
      on conflict (id) do update set nome = excluded.nome, nome_utilizador = excluded.nome_utilizador, papel = 'aluno',
        centro_id = excluded.centro_id, ativa = true, deve_mudar_palavra_passe = false, criado_por = excluded.criado_por, criado_em = excluded.criado_em;
    end if;
  end loop;

  insert into public.turmas (centro_id, nome, criado_em) values (v_centro, '11.º ano — Física e Química A', now() - interval '60 days') returning id into v_t11;
  insert into public.turmas (centro_id, nome, criado_em) values (v_centro, '12.º ano — Matemática A', now() - interval '60 days') returning id into v_t12;
  -- aluno demo nas duas turmas; os outros repartidos
  insert into public.turma_alunos values (v_t11, v_ids[1]), (v_t12, v_ids[1]);
  for i in 2 .. 6 loop insert into public.turma_alunos values (v_t11, v_ids[i]); end loop;
  for i in 6 .. 9 loop insert into public.turma_alunos values (v_t12, v_ids[i]); end loop;

  -- respostas: cada aluno com um "nível" e temas mais fortes/fracos
  for a in select ta.aluno_id, case when ta.turma_id = v_t11 then 'fq' else 'mat' end as disc from public.turma_alunos ta where ta.turma_id in (v_t11, v_t12) loop
    v_skill := 0.45 + random() * 0.4;
    insert into public.respostas (user_id, questao_id, tentativas, certas, ultima, atualizado_em)
    select a.aluno_id, x.id, x.t, case when x.ok then least(x.t, 1 + (random() * (x.t - 1))::int) else (random() * (x.t - 1))::int end, x.ok, x.quando
    from (
      select q.id, 1 + (random() < 0.25)::int as t,
             random() < greatest(0.1, least(0.95, v_skill + s.ajuste)) as ok,
             now() - (random() * 56) * interval '1 day' as quando
      from public.questoes q
      join (select dados->>'subtema_cod' as cod, (random() - 0.5) * 0.5 as ajuste from public.questoes where disciplina = a.disc group by 1) s
        on s.cod = q.dados->>'subtema_cod'
      where q.disciplina = a.disc and random() < 0.35
    ) x
    on conflict (user_id, questao_id) do nothing;
  end loop;

  -- trabalhos de casa
  for r in select * from (values
      (v_t11, 'fq', 'TPC — Mecânica', 'F11.', -20, true),
      (v_t11, 'fq', 'TPC — Equilíbrio químico', 'Q11.2', -6, true),
      (v_t11, 'fq', 'Revisões — Energia', 'F10.', 7, false),
      (v_t12, 'mat', 'TPC — Probabilidades', 'M3.', -18, true),
      (v_t12, 'mat', 'TPC — Funções exponenciais', 'M6.', -4, true),
      (v_t12, 'mat', 'Revisões — Trigonometria', 'M5', 9, false)) as t(turma, disc, titulo, pref, dias, entregue) loop
    select array_agg(id) into v_qs from (select id from public.questoes where disciplina = r.disc and dados->>'subtema_cod' like r.pref || '%' order by random() limit 8) z;
    insert into public.trabalhos (turma_id, titulo, disciplina, questoes, prazo, criado_por, criado_em)
    values (r.turma, r.titulo, r.disc, v_qs, (current_date + r.dias), v_expl, now() + (r.dias - 7) * interval '1 day') returning id into v_w;
    if r.entregue then
      for a in select aluno_id from public.turma_alunos where turma_id = r.turma loop
        continue when random() < 0.15;
        v_det := '{}'; v_cert := 0;
        foreach q in array v_qs loop
          if random() < 0.65 then v_det := v_det || jsonb_build_object(q, true); v_cert := v_cert + 1;
          else v_det := v_det || jsonb_build_object(q, false); end if;
        end loop;
        insert into public.entregas (trabalho_id, aluno_id, certas, total, detalhe, entregue_em)
        values (v_w, a.aluno_id, v_cert, array_length(v_qs, 1), v_det, now() + (r.dias - 1 - random() * 3) * interval '1 day');
      end loop;
    end if;
  end loop;
end $$;
