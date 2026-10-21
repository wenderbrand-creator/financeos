import { BrandMark, Icon } from "../../components/icons";
import { CONTACT_EMAIL, LEGAL_NAME } from "../../services/config";

/* =====================================================================
   Privacy policy and terms of use — public pages (/privacidade, /termos),
   readable without an account. Who answers for the service and the contact
   e-mail come from VITE_LEGAL_NAME and VITE_CONTACT_EMAIL.
   This text is a starting point written for this product; have it reviewed by
   a lawyer before charging customers.
   ===================================================================== */
const UPDATED = "21/10/2026";

export function isLegalPath(path: string) { return /^\/(privacidade|termos)\/?$/.test(path); }

function Contact() {
  return CONTACT_EMAIL
    ? <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
    : <span className="legal-missing">e-mail de contato a definir</span>;
}
const owner = () => LEGAL_NAME || "o responsável pelo Finance OS";

function Privacy() {
  return <>
    <h1>Política de Privacidade</h1>
    <p className="legal-updated">Última atualização: {UPDATED}</p>
    <p>Esta política explica quais dados o Finance OS trata, para quê e quais são os seus direitos, conforme a Lei Geral de Proteção de Dados (Lei nº 13.709/2018, LGPD). O controlador dos dados é {owner()}, que pode ser contatado pelo e-mail <Contact />.</p>

    <h2>Quais dados tratamos</h2>
    <ul>
      <li><b>Dados de conta:</b> seu e-mail e sua senha. A senha é guardada pelo provedor de autenticação de forma cifrada (hash); ninguém da equipe tem acesso a ela.</li>
      <li><b>Dados que você registra:</b> lançamentos (descrição, valor, data, categoria), contas, cartões, limites de orçamento, regras de categoria e preferências de aparência.</li>
      <li><b>Arquivos importados:</b> extratos e faturas em PDF, OFX ou CSV são lidos <b>no seu próprio aparelho</b>. O arquivo não é enviado a nenhum servidor; só os lançamentos que você confirmar na revisão são salvos.</li>
      <li><b>Dados técnicos:</b> registros de acesso (como endereço IP, data e hora e navegador), mantidos pelos provedores de infraestrutura para segurança e prevenção de abuso.</li>
    </ul>
    <p>Não pedimos CPF, número de cartão, senha de banco ou acesso à sua conta bancária.</p>

    <h2>Para que usamos</h2>
    <ul>
      <li>Criar e manter sua conta e mostrar seus próprios dados financeiros (execução do contrato, art. 7º, V).</li>
      <li>Enviar e-mails essenciais: confirmação de cadastro e redefinição de senha (execução do contrato).</li>
      <li>Proteger o serviço contra acessos indevidos e abuso (legítimo interesse, art. 7º, IX).</li>
      <li>Cumprir obrigações legais, quando houver (art. 7º, II).</li>
    </ul>
    <p>Não vendemos seus dados, não os usamos para publicidade e não fazemos análise de crédito.</p>

    <h2>Com quem compartilhamos</h2>
    <p>Apenas com operadores que prestam a infraestrutura do serviço, sob contrato e só para essa finalidade:</p>
    <ul>
      <li><b>Supabase</b>: banco de dados e autenticação.</li>
      <li><b>Vercel</b>: hospedagem do site.</li>
      <li><b>Brevo</b>: envio dos e-mails de confirmação e de senha.</li>
    </ul>
    <p>Esses provedores podem armazenar dados fora do Brasil. A transferência internacional se apoia nas garantias contratuais desses provedores (art. 33 da LGPD).</p>

    <h2>Segurança</h2>
    <p>Cada conta só enxerga os próprios registros, por regras aplicadas no próprio banco de dados. A conexão é sempre cifrada (HTTPS), ações sensíveis pedem a senha de novo e a sessão é encerrada após um período sem uso. Nenhum sistema é totalmente imune a falhas; se ocorrer um incidente que possa trazer risco a você, avisaremos e comunicaremos a ANPD quando exigido.</p>

    <h2>Por quanto tempo guardamos</h2>
    <p>Enquanto sua conta existir. Ao excluir a conta, os dados são apagados do banco de dados na hora. Cópias de segurança dos provedores podem manter os dados por um período limitado até serem substituídas, e registros técnicos de acesso podem ser guardados pelo prazo exigido em lei.</p>

    <h2>Seus direitos</h2>
    <p>Você pode, a qualquer momento:</p>
    <ul>
      <li><b>acessar e levar seus dados:</b> em Configurações → Dados e backup → Exportar backup;</li>
      <li><b>corrigir:</b> editando os próprios lançamentos e configurações;</li>
      <li><b>excluir a conta e todos os dados:</b> em Configurações → Sua conta → Excluir conta e dados;</li>
      <li>pedir informações sobre o tratamento, revogar consentimentos e apresentar reclamação à Autoridade Nacional de Proteção de Dados (ANPD).</li>
    </ul>
    <p>Pedidos que não possam ser feitos pelo próprio app podem ser enviados para <Contact />.</p>

    <h2>Armazenamento no navegador</h2>
    <p>Usamos o armazenamento local do navegador apenas para manter você conectado e lembrar preferências (tema, cor, menu). Não usamos cookies de publicidade nem ferramentas de rastreamento de terceiros.</p>

    <h2>Menores de idade</h2>
    <p>O serviço é destinado a maiores de 18 anos.</p>

    <h2>Mudanças nesta política</h2>
    <p>Se esta política mudar de forma relevante, avisaremos no app antes de a mudança valer.</p>
  </>;
}

function Terms() {
  return <>
    <h1>Termos de Uso</h1>
    <p className="legal-updated">Última atualização: {UPDATED}</p>
    <p>Estes termos regem o uso do Finance OS{LEGAL_NAME ? `, oferecido por ${LEGAL_NAME}` : ""}. Ao criar uma conta, você declara que leu e concorda com eles e com a <a href="/privacidade">Política de Privacidade</a>.</p>

    <h2>O serviço</h2>
    <p>O Finance OS é uma ferramenta para organizar finanças pessoais: registrar receitas e despesas, acompanhar cartões de crédito, importar extratos e definir limites de gasto. Os números mostrados são calculados a partir do que você registra ou importa.</p>

    <h2>Não é aconselhamento financeiro</h2>
    <p>O Finance OS não é banco, corretora nem consultoria. As informações servem para a sua organização e não substituem orientação profissional. Decisões financeiras são de sua responsabilidade.</p>

    <h2>Sua conta</h2>
    <ul>
      <li>Você precisa ter 18 anos ou mais e informar um e-mail válido.</li>
      <li>Mantenha sua senha em segredo; a conta é pessoal e intransferível.</li>
      <li>Você é responsável pelos dados que registra e por conferir os lançamentos importados antes de confirmá-los.</li>
    </ul>

    <h2>Uso permitido</h2>
    <p>Não é permitido tentar acessar dados de outras pessoas, sobrecarregar ou atacar o serviço, automatizar cadastros ou usar o Finance OS para qualquer fim ilegal. Contas que fizerem isso podem ser suspensas.</p>

    <h2>Disponibilidade</h2>
    <p>Trabalhamos para manter o serviço no ar e seus dados seguros, mas podem ocorrer interrupções para manutenção ou por falhas de terceiros. Recomendamos exportar backups periodicamente em Configurações.</p>

    <h2>Responsabilidade</h2>
    <p>Na extensão permitida pela lei, não respondemos por decisões tomadas com base nas informações do app, por lançamentos incorretos registrados ou importados por você, nem por indisponibilidades causadas por terceiros. Nada nestes termos limita direitos que o Código de Defesa do Consumidor garante a você.</p>

    <h2>Planos e pagamentos</h2>
    <p>Se houver planos pagos, preço, forma de cobrança e cancelamento serão informados com clareza antes da contratação.</p>

    <h2>Encerramento</h2>
    <p>Você pode excluir sua conta quando quiser em Configurações → Sua conta. Podemos encerrar contas que violem estes termos, com aviso quando possível.</p>

    <h2>Mudanças</h2>
    <p>Podemos atualizar estes termos. Mudanças relevantes serão avisadas no app com antecedência.</p>

    <h2>Lei e foro</h2>
    <p>Aplica-se a lei brasileira. Fica eleito o foro do domicílio do usuário.</p>

    <h2>Contato</h2>
    <p>Dúvidas sobre estes termos: <Contact />.</p>
  </>;
}

export function LegalPage({ path }: { path: string }) {
  const kind = path.startsWith("/termos") ? "terms" : "privacy";
  return (
    <div className="legal-wrap">
      <header className="legal-top">
        <a href="/" className="legal-brand"><BrandMark /><span className="brand-name">Finance <span>OS</span></span></a>
        <nav><a href="/privacidade" aria-current={kind === "privacy" ? "page" : undefined}>Privacidade</a><a href="/termos" aria-current={kind === "terms" ? "page" : undefined}>Termos</a></nav>
      </header>
      <main className="legal prose">{kind === "terms" ? <Terms /> : <Privacy />}
        <p className="legal-back"><a href="/"><Icon name="left" size={14} />Voltar ao Finance OS</a></p></main>
    </div>
  );
}
