export const NAV = [
  { group: "Painel", items: [
    { id: "inicio", label: "Início", icon: "grid", ready: true },
    { id: "visao", label: "Visão geral", icon: "chart", ready: true },
    { id: "orcamento", label: "Lançamentos", icon: "arrows", ready: true },
    { id: "cartoes", label: "Cartões de crédito", icon: "card", ready: true },
  ]},
  { group: "Conta", items: [
    { id: "config", label: "Configurações", icon: "sliders", ready: true },
    { id: "ajuda", label: "Ajuda", icon: "help", ready: true },
  ]},
  // modules still being built: one collapsed group, so they don't crowd the menu
  { group: "Em breve", soon: true, items: [
    { id: "reserva", label: "Reserva de emergência", icon: "shield" },
    { id: "metas", label: "Metas", icon: "target" },
    { id: "investimentos", label: "Investimentos", icon: "trend" },
    { id: "patrimonio", label: "Patrimônio", icon: "landmark" },
    { id: "calculadoras", label: "Calculadoras", icon: "calc" },
  ]},
] as { group: string; soon?: boolean; items: { id: string; label: string; icon: string; ready?: boolean }[] }[];
export const NAV_FLAT = NAV.flatMap(g => g.items);

export const PENDING = {
  reserva: { title: "Reserva de emergência", lead: "Quanto você precisa guardar para atravessar meses sem renda, e quanto já tem.", steps: [
    ["Custo de vida essencial", "Calculado a partir das despesas de moradia, alimentação, saúde e transporte já registradas."],
    ["Nível de proteção", "6 meses para renda fixa, 12 meses para renda variável, com meta ajustável."],
    ["Onde está a reserva", "Lista de aplicações com valores e liquidez, somando o total protegido."],
    ["Progresso", "Percentual atingido e quanto falta, atualizado a cada aporte."]] },
  metas: { title: "Metas", lead: "Objetivos com valor, prazo e aportes, ligados aos seus lançamentos.", steps: [
    ["Nova meta", "Nome, valor total, prazo opcional e onde o dinheiro será guardado."],
    ["Aportes", "Cada aporte vira um lançamento vinculado, sem contagem duplicada no saldo."],
    ["Ritmo necessário", "Quanto guardar por mês para chegar no prazo."],
    ["Conclusão", "Histórico das metas atingidas."]] },
  investimentos: { title: "Investimentos", lead: "Carteira por classe de ativo, com aportes, resgates e rentabilidade registrada por você.", steps: [
    ["Ativos e classes", "Renda fixa, ações, fundos, previdência e outros."],
    ["Movimentações", "Aportes e resgates integrados às contas financeiras."],
    ["Alocação", "Distribuição por classe e por instituição."],
    ["Rentabilidade", "Calculada a partir dos valores informados; nada é estimado automaticamente."]] },
  patrimonio: { title: "Patrimônio", lead: "Bens e dívidas em um só lugar, para acompanhar seu patrimônio líquido ao longo do tempo.", steps: [
    ["Bens", "Imóveis, veículos, equipamentos e saldos de contas."],
    ["Dívidas", "Financiamentos e parcelamentos com saldo devedor."],
    ["Patrimônio líquido", "Bens menos dívidas, com histórico mensal."],
    ["Integração", "Saldos de contas e investimentos entram automaticamente."]] },
  calculadoras: { title: "Calculadoras", lead: "Ferramentas de simulação que usam centavos inteiros e regras explícitas.", steps: [
    ["Juros compostos", "Aportes mensais, taxa e prazo."],
    ["Reserva ideal", "A partir do custo de vida essencial."],
    ["Parcelado ou à vista", "Comparação com custo de oportunidade."],
    ["Independência financeira", "Patrimônio necessário para uma renda desejada."]] },
};
