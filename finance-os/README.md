# Finance OS

Gestão financeira pessoal: painel, orçamento, cartões de crédito com faturas e parcelas, importação de extratos (OFX/CSV), recorrências, categorias e aparência personalizável.

**Stack:** React 18 + TypeScript · Vite 5 · React Router · Supabase (Postgres + Auth) · Vercel.

O app funciona de dois jeitos:

| Modo | Quando | Login | Onde ficam os dados |
|---|---|---|---|
| **Nuvem** | `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` configuradas | Usuário e senha | Banco Supabase, protegido por RLS |
| **Local** | Variáveis ausentes (ou `VITE_STORAGE_MODE=local`) | Nenhum | Armazenamento do navegador |

---

## 1. Rodar no computador

Requisitos: **Node.js 18.18 ou superior** (recomendado 20) e npm.

```bash
npm install
npm run dev        # http://localhost:5173 (modo local, sem login)
npm test           # testes de compatibilidade dos cálculos
npm run build      # verificação de tipos + build de produção em dist/
npm run preview    # serve o build de produção em http://localhost:4173
```

Para testar com o Supabase localmente, copie `.env.example` para `.env.local` e preencha as variáveis (passo 3).

## 2. Criar o repositório no GitHub

1. Crie um repositório vazio no GitHub (ex.: `finance-os`). Ele pode ser **privado**.
2. Na pasta do projeto, rode:

```bash
git init
git add .
git commit -m "Finance OS: projeto inicial"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/finance-os.git
git push -u origin main
```

O `.gitignore` já impede o envio de `node_modules`, `dist` e arquivos `.env`.

## 3. Configurar o Supabase

1. Crie um projeto em [supabase.com](https://supabase.com). Escolha a região **South America (São Paulo)** para menor latência.
2. **Banco de dados:** abra **SQL Editor → New query**, cole todo o conteúdo de `supabase/migrations/0001_finance_os.sql` e clique em **Run**.
   - Isso cria as tabelas `user_settings` e `transactions`, os índices e as regras de segurança (RLS): cada usuário só lê e altera as próprias linhas.
3. **Login com usuário e senha:** em **Authentication → Sign In / Providers → Email**:
   - mantenha **Email** ativado;
   - **desative "Confirm email"**. O app permite usuário sem e-mail real (ex.: `wender`), então não há e-mail de confirmação a receber;
   - não é preciso ativar Google nem outro provedor.
4. **Chaves públicas:** em **Project Settings → API** (ou **Data API / API Keys**), copie:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public key** (ou *publishable key*) → `VITE_SUPABASE_ANON_KEY`

> ⚠️ **Nunca** use a chave `service_role` / *secret* no frontend nem na Vercel. Ela ignora as regras de segurança. O app só precisa da chave pública: a proteção vem do RLS.

Os nomes dos menus do Supabase mudam de vez em quando. Se não encontrar algum, procure por "Confirm email" ou "API keys" nas configurações do projeto.

## 4. Publicar na Vercel

1. Em [vercel.com](https://vercel.com), clique em **Add New → Project** e importe o repositório do GitHub.
2. A Vercel detecta **Vite** sozinha. Confira:
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`
3. Em **Environment Variables**, adicione para *Production* e *Preview*:

| Nome | Valor |
|---|---|
| `VITE_SUPABASE_URL` | URL do projeto Supabase |
| `VITE_SUPABASE_ANON_KEY` | chave pública (anon) |
| `VITE_ALLOW_SIGNUP` | `true` (só até criar seu usuário) |

4. Clique em **Deploy**.

O `vercel.json` já cuida de três coisas:
- **Rotas internas:** atualizar `/orcamento` ou `/cartoes` funciona, porque todas as rotas apontam para `index.html`.
- **Cache longo** para os arquivos de `assets/`.
- **Cabeçalhos de segurança:** sem iframes de terceiros e sem câmera, microfone ou localização.

> Variáveis `VITE_*` entram no build. Depois de alterar alguma na Vercel, faça **Redeploy**.

## 5. Criar seu usuário e fechar os cadastros

1. Abra o site publicado, vá em **Criar conta**, escolha um usuário (ex.: `wender`) e uma senha com pelo menos 6 caracteres.
2. Depois de entrar, **feche os cadastros** para ninguém mais criar conta:
   - na Vercel, mude `VITE_ALLOW_SIGNUP` para `false` e faça **Redeploy** (a aba "Criar conta" some);
   - no Supabase, em **Authentication → Sign In / Providers**, desative **Allow new users to sign up**.
3. Usuários sem `@` são guardados no Supabase como `usuario@users.financeos.app`. Nenhum e-mail é enviado; é só um identificador interno. Para mudar o sufixo, use `VITE_USERNAME_DOMAIN` antes de criar contas.

> **Esqueceu a senha?** Como não há e-mail real, redefina em **Supabase → Authentication → Users → (seu usuário) → Reset password / Update user**.

## 6. Trazer seus dados do Claude Artifact

Seus dados do Artifact ficam no claude.ai. Um site em outro domínio não consegue ler esses dados direto, então a migração é feita por backup, sem apagar nada no Artifact:

1. No **Finance OS do Claude**, vá em **Configurações → Dados e backup → Exportar backup**. Guarde o arquivo `.json`.
2. No **Finance OS publicado**, entre com seu usuário e vá em **Configurações → Dados e backup → Restaurar backup**.
3. O app valida o arquivo, mostra quantos lançamentos e contas vai importar e pede confirmação.
4. Depois de gravar, ele **relê os dados do servidor e confere** quantidade e totais por mês, conta e tipo. Você vê "Dados conferidos" ou a lista de diferenças.

Se você usou o modo local antes de configurar o Supabase, a seção **Configurações → Sua conta** oferece **Enviar dados deste navegador para a nuvem**, com a mesma conferência. Os dados locais não são apagados.

## 7. Estrutura do projeto

```
src/
  main.tsx, Root.tsx, App.tsx    entrada, login e shell do app (rotas /inicio, /orcamento, /cartoes …)
  app/nav.ts                     menu e módulos
  domain/                        regras financeiras puras: dinheiro (centavos), datas, resumos, cartões,
                                 séries, categorias, backup, dados de demonstração
  import/                        leitura de OFX/CSV, categorização e detecção de duplicados
  storage/                       adaptadores: local (navegador), memória (demo) e Supabase
  services/                      config, cliente Supabase, login, preferências, download
  components/                    ícones, gráficos SVG, modal, inputs, layout (menu lateral)
  features/                      telas: dashboard, overview, ledger, cards, import, settings, tx-form, help, auth
  styles/                        design system: tokens, temas, componentes, páginas, responsivo
  test/                          testes de compatibilidade (golden) com o app original
supabase/migrations/             SQL do banco com RLS
```

**Testes de compatibilidade:** `src/test/golden/expected.json` foi gerado rodando o **app original do Artifact** com a data fixa em 19/10/2026. `npm test` roda o mesmo cenário nesta versão e exige resultados idênticos em 27 grupos:
- resumos mensais, saldos e categorias;
- faturas e limite dos cartões;
- parcelas e recorrências;
- leitura de OFX/CSV, categorização e detecção de duplicados;
- backup e formatação de valores.

Se alguma mudança alterar um cálculo, o teste acusa.

## 8. Segurança

- No frontend só existem valores públicos (URL e anon key). Não há segredos no código.
- Todas as tabelas têm **Row Level Security**: as políticas exigem `auth.uid() = user_id` para ler e gravar.
- Valores monetários são sempre **centavos inteiros** (`bigint`), com validação no banco (`amount_cents > 0`).
- O app nunca apaga nem sobrescreve dados ao iniciar. Restaurações pedem confirmação, conferem o resultado e voltam ao estado anterior se falharem no meio.

## 9. Próximos passos sugeridos

- **WhatsApp:** a lógica de valores e categorização (`src/domain`, `src/import`) é TypeScript puro, sem dependência de navegador. Ela pode ser reaproveitada numa Supabase Edge Function que receba mensagens da WhatsApp Cloud API e crie lançamentos pendentes de confirmação.
- **Tipagem mais rígida:** o projeto compila em TypeScript, mas ainda com regras flexíveis (`strict: false`), para portar o código sem mudar o comportamento. O próximo passo é endurecer os tipos aos poucos, começando por `src/domain`, que tem os testes de referência como rede de segurança.
