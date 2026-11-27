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
2. No projeto, abra **SQL Editor** e rode, **em ordem**, cada arquivo da pasta `supabase/migrations/` (cole o conteúdo e clique **Run**).
3. (Opcional) Faça o mesmo com `supabase/seed.sql` para ter dados de exemplo.
4. Em **Project Settings > API Keys**, copie a *Project URL* (só `https://xxxx.supabase.co`) e a chave *anon / publishable*.
5. Crie uma conta em [vercel.com](https://vercel.com) entrando com o GitHub, importe este repositório e, em **Environment Variables**, preencha
   `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` com os valores do passo 4.
6. Abra `https://seu-projeto.vercel.app/barbearia-do-ze` para ver o salão de exemplo.
7. No Supabase, em **Authentication > URL Configuration**, coloque o endereço da Vercel em **Site URL**
   e adicione `https://seu-projeto.vercel.app/**` em **Redirect URLs** (é para onde o e-mail de confirmação leva).
8. Abra `https://seu-projeto.vercel.app/entrar`, crie sua conta e cadastre o seu salão.

### Login do cliente ("Meus agendamentos")

- **Código por e-mail:** no Supabase, em **Authentication > Emails**, nos modelos *Magic Link* e *Confirm signup*,
  acrescente a linha `Seu código: {{ .Token }}`. Assim o cliente pode digitar o código no app instalado
  (o link do e-mail abre no navegador, fora do app).
- **Entrar com Google:** em **Authentication > Sign In / Providers > Google**, ative e cole o *Client ID* e o
  *Client Secret* criados no Google Cloud (Credenciais > ID do cliente OAuth > Aplicativo da Web, com a
  *Callback URL* que o Supabase mostra).
- O plano grátis do Supabase envia poucos e-mails por hora. Para volume maior, configure um SMTP próprio
  (ex.: Resend) em **Authentication > Emails > SMTP Settings**.

## Rodar no computador (para desenvolvedores)

```bash
cp .env.example .env.local   # e preencha as chaves
npm install
npm run dev
```

## Etapas

1. ✅ Base do app e modelo de dados
2. ✅ Login do dono/profissional (e-mail e senha), cadastro do salão e painel inicial
3. ✅ Gestão: serviços, profissionais, horários, folgas e abertura da agenda
4. ✅ Agendamento do cliente com nome e telefone: serviço → profissional → data → horário livre, confirmação, Google Agenda, lembrete (.ics) e link pessoal para remarcar/desmarcar
5. ✅ Agenda do salão (dia/semana/mês), atendido/falta/desmarcar, agendar pelo balcão, aviso de vaga liberada e "horários livres" para postar
6. ✅ Clientes como leads (sumidos, frequência de retorno, aniversário), cartão fidelidade, WhatsApp com mensagem pronta e ajustes do salão
7. ✅ Área do cliente: "Meus agendamentos" (entra com Google ou código por e-mail), remarcar/desmarcar e app instalável com a cara de cada salão
8. ✅ Página do salão com abas (serviços, equipe, local), mapa, "Como chegar", horário de funcionamento e "Aberto agora"
9. ✅ Avaliações: cliente atendido dá nota ao profissional e ao salão pelo link do agendamento; dono responde e oculta; notas aparecem na página
10. ✅ Pacotes: o dono cria combos com desconto (aparecem na página do salão), vende no balcão pela ficha do cliente e controla o saldo de sessões; o cliente vê o saldo em "Meus agendamentos"
11. Pagamentos (Mercado Pago): sinal em datas especiais, pacote online e cartão salvo
12. Relatórios do mês
