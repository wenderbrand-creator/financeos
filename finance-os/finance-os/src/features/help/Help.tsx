import { NAV_FLAT } from "../../app/nav";
import { Icon } from "../../components/icons";
import { useApp } from "../../state/AppContext";

export function Help() {
  const { storeKind, actions } = useApp();
  return (
    <div className="help-grid stagger">
      <div className="card">
        <div className="card-head"><div><h3 className="card-title">Estado dos módulos</h3><div className="card-sub">O que já funciona nesta versão</div></div></div>
        <div style={{ paddingTop: 8 }}>{NAV_FLAT.map(n =>
          <div className="status-row" key={n.id}><span className="nm"><Icon name={n.icon} size={16} />{n.label}</span>
            {n.ready ? <span className="pill pos"><Icon name="check" size={12} sw={2} />Funcional</span> : <span className="pill warn"><Icon name="clock" size={12} sw={2} />Em desenvolvimento</span>}</div>)}</div>
      </div>
      <div className="card">
        <div className="card-head"><div><h3 className="card-title">Como usar</h3></div></div>
        <div className="prose">
          {storeKind && <div style={{ margin: "4px 0 6px" }}><button type="button" className="btn sm" onClick={actions.openWelcome}><Icon name="repeat" size={14} />Rever a introdução</button></div>}
          <h5>Lançamentos</h5><p>Use “Novo lançamento” no topo ou aperte <kbd>N</kbd> em qualquer tela. Status pago entra no saldo atual; pendente aparece em próximos vencimentos e só conta no saldo previsto. Ao excluir, você tem alguns segundos para desfazer.</p>
          <h5>Importar extrato</h5><p>Em Lançamentos, use “Importar extrato” com o PDF, OFX ou CSV baixado do app do banco. O app separa entradas e saídas, sugere categorias (aprendendo com o que você já lançou), marca o que já existe e só grava depois da sua revisão.</p>
          <h5>Importar fatura do cartão</h5><p>Em Cartões de crédito, escolha o cartão e use “Importar fatura” com o PDF da fatura. As compras entram na fatura certa e aparecem ali no cartão. O pagamento da fatura é ignorado, para não contar duas vezes: ele entra quando você importa o extrato da conta.</p>
          <h5>Cartões de crédito</h5><p>Cadastre o cartão com fechamento e vencimento. No novo lançamento, escolha “Pagar com: Cartão de crédito” e, se quiser, as parcelas. A compra conta como gasto no dia e vai para a fatura certa. Ao pagar a fatura, o valor sai da conta como transferência, sem contar duas vezes.</p>
          <h5>Recorrências</h5><p>Ative “Repetir todo mês” para criar aluguel, salário ou parcelas de uma vez. Cada mês vira um lançamento próprio; ao editar ou excluir, escolha entre só aquele mês ou ele e os próximos.</p>
          <h5>Categorias</h5><p>Crie, renomeie, mude a cor ou arquive categorias em Configurações. Categorias em uso não podem ser excluídas, só arquivadas.</p>
          <h5>Mês de referência</h5><p>As setas no topo mudam o mês de todas as telas. Clique no nome do mês para voltar ao mês atual.</p>
          <h5>Ocultar valores</h5><p>O ícone de olho troca todos os valores por asteriscos, útil ao compartilhar a tela.</p>
          <h5>Onde ficam os dados</h5><p>{storeKind === "cloud" ? "Na nuvem, protegidos pelo seu login. Só a sua conta lê e grava esses registros, e você acessa de qualquer dispositivo." : storeKind === "local" ? "Neste navegador (armazenamento local). Exporte backups com frequência: limpar os dados do navegador apaga os registros." : "Somente na memória desta aba. Exporte um backup antes de fechar."}</p>
          <h5>Backup</h5><p>Em Configurações, exporte um arquivo JSON e restaure quando precisar. A restauração valida o arquivo e pede confirmação antes de substituir qualquer coisa.</p>
        </div>
      </div>
    </div>
  );
}
