# Agenda Salão

Sistema de agendamento para salões de cabeleireiro, barbearias, manicures e design de sobrancelhas.
O cliente agenda por um link (aberto no navegador do celular, sem precisar de loja de apps), e o dono do salão faz toda a gestão.

## Como funciona

- **Link do salão**: cada salão tem um endereço próprio, por exemplo `seusite.com/barbearia-do-ze`. É esse link que vai no WhatsApp, no Instagram e no status.
- **Sem loja de apps**: é um site que pode ser "instalado" na tela inicial do celular (PWA). Atualizações chegam sozinhas, sem Play Store ou App Store.
- **Perfis**: dono (gestão completa), profissional (a própria agenda) e cliente (entra só com o telefone).

## Tecnologia

- [Next.js](https://nextjs.org) + TypeScript + Tailwind (o site)
- [Supabase](https://supabase.com) (banco de dados Postgres, login por telefone, segurança por linha)
- [Vercel](https://vercel.com) (hospedagem)

## Estrutura

| Pasta | O que tem |
| --- | --- |
| `supabase/migrations/` | Modelo de dados: salões, profissionais, serviços, horários, bloqueios, clientes, agendamentos e regras de segurança |
| `supabase/seed.sql` | Dados de exemplo (Barbearia do Zé) |
| `src/app/` | Páginas do site |
| `src/lib/` | Conexão com o Supabase e funções de apoio |

### Regras que já ficam garantidas no banco

- Dois agendamentos nunca se sobrepõem para o mesmo profissional.
- O cliente só agenda dentro do horário de trabalho, fora de folgas/bloqueios e só em datas com agenda aberta
  (agenda sempre aberta para N dias **ou** abertura semanal, ex.: toda segunda às 00:00).
- O cliente só desmarca sozinho até X horas antes (configurável por salão).
- Cliente só vê os próprios agendamentos; o salão vê só os próprios clientes.
- Cada telefone vira um cliente (lead) com histórico, frequência de retorno e próximo agendamento (`client_stats`).

## Configurar (passo a passo)

1. Crie uma conta grátis em [supabase.com](https://supabase.com) e um projeto novo (região São Paulo).
2. No projeto, abra **SQL Editor**, cole o conteúdo de `supabase/migrations/20261127000000_modelo_inicial.sql` e clique **Run**.
3. (Opcional) Faça o mesmo com `supabase/seed.sql` para ter dados de exemplo.
4. Em **Project Settings > API**, copie a *Project URL* e a chave *anon public*.
5. Crie uma conta em [vercel.com](https://vercel.com) entrando com o GitHub, importe este repositório e, em **Environment Variables**, preencha
   `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` com os valores do passo 4.
6. Abra `https://seu-projeto.vercel.app/barbearia-do-ze` para ver o salão de exemplo.

## Rodar no computador (para desenvolvedores)

```bash
cp .env.example .env.local   # e preencha as chaves
npm install
npm run dev
```

## Etapas

1. ✅ Base do app e modelo de dados
2. Login (dono/profissional por e-mail, cliente por telefone) e cadastro do salão
3. Gestão: serviços, profissionais, horários, folgas e abertura da agenda
4. Agendamento do cliente: serviço → profissional → data → horário livre, confirmação, Google Agenda e lembrete (.ics)
5. Agenda do salão (dia/semana/mês), desmarcar/remarcar, aviso de vaga liberada e "horários livres" para postar
6. Clientes como leads (sumidos há 30+ dias, frequência 7/15/30), botões de WhatsApp com mensagem pronta
7. Relatórios do mês
