-- Importa (ou atualiza) o banco de questões a partir do repositório no GitHub.
-- Correr de novo sempre que questoes.json ou questoes-mat.json mudarem (depois do git push).
-- Nota: quando o repositório passar a privado, o import tem de ser feito de outra forma (ex.: script com a chave secret).
create extension if not exists http with schema extensions;

insert into public.questoes (id, disciplina, dados)
select q->>'id', 'fq', q
from jsonb_array_elements((select content::jsonb from extensions.http_get('https://raw.githubusercontent.com/gaara21wq/Prepara-o-para-o-exame-FQ/main/questoes.json'))) q
on conflict (id) do update set disciplina = excluded.disciplina, dados = excluded.dados;

insert into public.questoes (id, disciplina, dados)
select q->>'id', 'mat', q
from jsonb_array_elements((select content::jsonb from extensions.http_get('https://raw.githubusercontent.com/gaara21wq/Prepara-o-para-o-exame-FQ/main/questoes-mat.json'))) q
on conflict (id) do update set disciplina = excluded.disciplina, dados = excluded.dados;

drop extension http;
