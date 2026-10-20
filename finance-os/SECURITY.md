# Finance OS — Relatório de segurança

Data: 20/10/2026 · Escopo: código deste repositório (React + Vite + TypeScript), migrações SQL do Supabase e configuração da Vercel.

Este relatório descreve o que foi verificado com evidências. Ele não declara o sistema "100% seguro".

## A. Diagnóstico geral

O núcleo da proteção de dados já estava correto: cada lançamento pertence a um usuário, e o banco (RLS) impede que uma conta leia ou altere dados de outra. Isso foi confirmado por testes que executam ataques reais contra as migrações.

Os problemas encontrados estavam ao redor desse núcleo:
- o fluxo de cadastro não verificava e-mail e permitia descobrir contas existentes;
- não havia recuperação de senha;
- faltavam cabeçalhos de segurança (CSP/HSTS);
- havia dependências com vulnerabilidades conhecidas;
- faltavam restrições de integridade no banco;
- ações destrutivas não pediam a senha novamente.

Todos foram corrigidos no código. Algumas correções só passam a valer depois de configurar o painel do Supabase (seção G).

Nível de confiança: **bom para uso real**, depois de aplicar a migração 0002 e as configurações do Supabase da seção G.

## B. Vulnerabilidades encontradas

| # | Severidade | Onde | Problema | Status |
|---|---|---|---|---|
| 1 | **ALTA** | Cadastro (`services/auth.ts`, Supabase "Confirm email" desligado) | Qualquer pessoa podia criar conta com o e-mail de outra, sem verificação. Contas criadas só com "usuário" não tinham como recuperar a senha. | Corrigido no código: cadastro exige e-mail real e suporta confirmação. **Requer ligar "Confirm email" no Supabase.** |
| 2 | **ALTA** | `package.json` | `react-router-dom` 6.28 (open redirect/XSS), `@supabase/supabase-js` 2.47 (auth-js) e `vite` 5.4.11 com avisos conhecidos. | Corrigido: react-router-dom 6.30.6, supabase-js 2.117.0, vite 5.4.21, vitest 2.1.9. |
| 3 | MÉDIA | Tela de cadastro | Enumeração de contas: a mensagem "Este usuário já existe" revelava quais e-mails estão cadastrados. | Corrigido: cadastro e "esqueci a senha" respondem igual para e-mail existente ou não. |
| 4 | MÉDIA | `vercel.json` | Sem Content-Security-Policy e sem HSTS. Uma falha de XSS poderia ler o token de sessão. | Corrigido: CSP restritiva (`script-src 'self'`), HSTS, COOP, CORP e Permissions-Policy. |
| 5 | MÉDIA | Banco (0001) | `anon` e `authenticated` herdavam todos os privilégios do Supabase, incluindo `TRUNCATE`, que o RLS não cobre. Não era explorável pela API REST, mas violava o privilégio mínimo. | Corrigido na 0002: `anon` sem acesso; `authenticated` só com SELECT/INSERT/UPDATE/DELETE. |
| 6 | MÉDIA | Banco (0001) | Faltavam restrições de integridade: datas absurdas, ids arbitrários, parcelas inconsistentes, configurações de tamanho ilimitado e duplicidade de importação garantida só no navegador. | Corrigido na 0002: CHECKs, índice único de importação, limite de 256 KB nas configurações e de 50 mil lançamentos por conta. |
| 7 | MÉDIA | Configurações | "Apagar todos os dados" e "Restaurar backup" bastava a sessão aberta, sem pedir a senha. | Corrigido: no modo nuvem, essas ações pedem a senha e o servidor a verifica. |
| 8 | MÉDIA | Autenticação | Não havia recuperação de senha. | Corrigido: "Esqueci minha senha" e tela de nova senha (fluxo PKCE). |
| 9 | BAIXA | Senhas | Mínimo de 6 caracteres, sem outras regras. | Corrigido: 8 a 72 caracteres, letras e números, bloqueio de senhas comuns e da senha igual ao e-mail. |
| 10 | BAIXA | Sessão | A sessão ficava aberta indefinidamente num computador compartilhado. | Corrigido: encerramento após 30 min sem uso (`VITE_IDLE_MINUTES`). O "Sair" encerra a sessão em todos os dispositivos. |
| 11 | BAIXA | Mensagens de erro | Erros desconhecidos do servidor apareciam com o texto original. | Corrigido: mensagens neutras na tela; o detalhe técnico fica só no console. |
| 12 | BAIXA | Auditoria | Não havia histórico de alterações financeiras. | Corrigido: tabela `audit_log`, preenchida só pelo banco, que o usuário lê mas não altera. |
| 13 | INFORMATIVA | `VITE_ALLOW_SIGNUP` | Esconder a aba "Criar conta" é só visual: a API continua aceitando cadastro. | Documentado. Para fechar cadastros de verdade, use o painel do Supabase. |

Credenciais: não foi encontrada nenhuma chave secreta no código, nos arquivos versionados nem no bundle. O `.env` está no `.gitignore`. O frontend usa apenas a chave pública (anon/publishable).

## C. Correções realizadas (arquivos)

- **`supabase/migrations/0002_security_hardening.sql` (novo):**
  - privilégios mínimos e políticas RLS separadas por operação;
  - `FORCE RLS` e `user_id` preenchido pelo servidor;
  - CHECKs de integridade e índice único de importação;
  - limite de uso por conta;
  - `audit_log`;
  - funções `SECURITY DEFINER` com `search_path` fixo e sem permissão de execução pública;
  - exclusão da conta apaga também o histórico (LGPD).
  - É não destrutiva e pode ser executada mais de uma vez.
- **`src/services/auth.ts`:**
  - cadastro por e-mail real e política de senha;
  - mensagens sem enumeração e erros neutros;
  - recuperação de senha, reautenticação e logout global.
- **`src/services/supabaseClient.ts`:** fluxo PKCE e leitura dos links de e-mail.
- **`src/features/auth/AuthScreen.tsx`:** e-mail no cadastro, "Esqueci minha senha", tela "Confira seu e-mail" e tela de nova senha.
- **`src/Root.tsx`:** evento de recuperação de senha, limpeza do código do link na barra de endereço e encerramento por inatividade.
- **`src/components/ui/Modal.tsx`** e **`src/features/settings/Settings.tsx`:** senha obrigatória para apagar tudo e restaurar backup.
- **`src/services/config.ts`**, **`src/vite-env.d.ts`**, **`.env.example`:** `VITE_IDLE_MINUTES`.
- **`vercel.json`:** CSP, HSTS, COOP, CORP, Permissions-Policy e `no-cache` no `index.html`.
- **`scripts/check-bundle.mjs` (novo):** roda automaticamente depois do build e falha se encontrar `service_role`, `sb_secret_`, chave privada ou source map.
- **`package.json`:** dependências atualizadas e scripts `test:db` e `test:all`.
- **Testes novos:** `src/test/security.test.ts` e `supabase/tests/rls.test.mjs`.

## D. Banco de dados

Estado depois da migração 0002:

| Tabela | RLS | FORCE | anon | authenticated | Políticas |
|---|---|---|---|---|---|
| `transactions` | sim | sim | nenhum privilégio | S/I/U/D | select, insert, update e delete restritos a `auth.uid() = user_id` |
| `user_settings` | sim | sim | nenhum | S/I/U/D | idem |
| `user_usage` | sim | sim | nenhum | só SELECT | só a própria linha; o contador é mantido por trigger |
| `audit_log` | sim | sim | nenhum | só SELECT | só o próprio histórico; o usuário não escreve nem apaga |

Não há views nem funções RPC expostas. As duas funções `SECURITY DEFINER` são de trigger, com `search_path = ''` e `EXECUTE` revogado de `public`, `anon` e `authenticated`.

SQL injection: o app não monta SQL. Todo acesso passa pelo PostgREST com parâmetros, e o React escapa todo texto exibido. Não há `dangerouslySetInnerHTML`, `eval` nem `innerHTML` no código.

## E. Testes

| Suíte | Resultado |
|---|---|
| `npm test`: cálculos (golden), limite de cartão, senha, e-mail e cabeçalhos | **38/38 aprovados** |
| `npm run test:db`: 45 ataques ao banco num PostgreSQL real em memória (PGlite), emulando os papéis e os privilégios padrão do Supabase | **45/45 aprovados** |
| Mesma suíte contra o banco **antes** da 0002 (só a 0001) | Isolamento entre usuários **aprovado**; 11 falhas de endurecimento (TRUNCATE, integridade, duplicidade, tamanho), corrigidas pela 0002 |
| `postbuild`: varredura do bundle | Aprovado. Também validado com uma chave `service_role` falsa inserida de propósito, que fez o build falhar como esperado. |
| E2E no navegador, com os cabeçalhos de produção e um Supabase Auth simulado | Aprovado. Cadastro exige e-mail e senha forte; cadastro de e-mail existente e de e-mail novo mostram a mesma tela; senha errada dá mensagem neutra; recuperação responde igual para e-mail inexistente; "Apagar tudo" com senha errada é bloqueado; logout remove o token e as rotas privadas voltam ao login; **zero violações de CSP**. |

Cobertos pela suíte do banco: rota privada sem login, leitura e alteração de dados de outro usuário, exclusão não autorizada, `user_id` forjado, dados inválidos, manipulação de valores, privilégios elevados e isolamento.

**Não executados** (sem acesso a estes ambientes):
- testes contra o seu projeto Supabase real;
- sessão expirada no servidor real;
- inspeção do deploy em produção na Vercel.

Para reproduzir, veja a seção H.

## F. Riscos residuais

- **Token de sessão no `localStorage`.** É o padrão do supabase-js em apps de navegador. A CSP reduz muito o risco de XSS, mas não elimina. A alternativa seria um backend com cookie `HttpOnly`.
- **Totais calculados no navegador.** Isso não é um risco de acesso: o usuário só lê e altera os próprios dados, e o banco valida cada lançamento. Um usuário pode "falsificar" apenas os próprios números.
- **Configurações gravadas inteiras.** Duas abas editando categorias ao mesmo tempo prevalece a última gravação. Os lançamentos não são afetados.
- **Contas e categorias dentro de um JSON.** O banco não valida se o `account_id` de um lançamento existe nas configurações. O impacto fica restrito à própria conta do usuário.
- **Ferramentas de desenvolvimento.** `vite` e `vitest` ainda têm avisos que só se resolvem em versões major. Afetam só o computador de quem desenvolve, não o site publicado.
- **Limites de envio de e-mail.** O SMTP padrão do Supabase envia poucos e-mails por hora. Para uso comercial, configure um SMTP próprio.
- **MFA (verificação em duas etapas)** ainda não implementado. É recomendado como próximo passo.
- **CAPTCHA no cadastro e no login** depende de configuração no Supabase (Turnstile/hCaptcha).

## G. Preparação para produção

**No Supabase (painel):**
- [ ] SQL Editor: rodar `supabase/migrations/0002_security_hardening.sql` e depois as consultas de verificação do fim do arquivo (devem retornar 0 linhas).
- [ ] Authentication → Sign In / Providers → Email: **ligar "Confirm email"**.
- [ ] Authentication → URL Configuration:
  - **Site URL** = o domínio da Vercel;
  - **Redirect URLs** = esse mesmo domínio com `/**`.
- [ ] Authentication → Password: tamanho mínimo **8**. "Leaked password protection", se o plano permitir.
- [ ] Authentication → Rate Limits: revisar. Attack Protection: ativar CAPTCHA, se possível.
- [ ] Authentication → Emails: configurar SMTP próprio e traduzir os modelos de e-mail para português.
- [ ] Advisors → Security Advisor: deve aparecer sem alertas críticos.

**Na Vercel:**
- [ ] Só existem `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (publishable), `VITE_ALLOW_SIGNUP` e, se quiser, `VITE_IDLE_MINUTES`. **Nenhuma** chave secret ou service_role.
- [ ] Depois do deploy, conferir os cabeçalhos em [securityheaders.com](https://securityheaders.com).

**Já atendido no código:** RLS e privilégios, integridade, CSP/HSTS, sem source maps, varredura do bundle, recuperação de senha, cadastro sem enumeração, reautenticação, inatividade, logout global e auditoria.

## H. Próximas ações

1. Aplicar a 0002 e os itens da seção G, antes de cadastrar clientes reais.
2. Testar no projeto real com duas contas de teste:
   - entrar como A, copiar o `id` de um lançamento de B (pelo Table Editor) e tentar ler, alterar e apagar via console do navegador com o token de A;
   - o esperado é retornar 0 linhas ou erro.
3. Implementar MFA (TOTP) nas configurações da conta.
4. Publicar uma política de privacidade e termos de uso (LGPD): finalidade, retenção e canal para exclusão de dados.
5. Revisar este relatório a cada mudança no banco e rodar `npm run test:all` antes de cada deploy.
