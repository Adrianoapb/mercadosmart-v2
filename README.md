# 🛒 MercadoSmart

**Aplicativo offline de controle de compras de supermercado com relatórios avançados, controle de estoque e modo família.**

---

## ✅ Funcionalidades Implementadas

### 🏠 Dashboard
- Resumo financeiro do mês (total gasto, n° de compras, média/compra)
- Alerta de itens com estoque baixo
- Última compra com detalhes
- Gráfico de pizza: gastos por categoria
- Gráfico de barras: evolução mensal (6 meses)
- Top 5 produtos mais comprados
- Card de economia (quando preço caiu vs. média histórica)
- Saudação contextual (bom dia/tarde/noite)
- Dados demo pré-carregados na primeira execução

### 🛒 Lista de Compras Inteligente
- Adicionar itens manualmente com autocomplete inteligente
- Entrada por voz (Web Speech API) com parsing automático
- Categorização automática por categoria
- Ordenação agrupada por categoria (simulando organização de mercado)
- Filtro por categoria com chips
- Barra de busca em tempo real
- Progresso visual da lista (itens marcados/total)
- Preço unitário, quantidade e total automático
- Variação de preço (▲ sobe, ▼ desce comparado ao histórico)
- Histórico de preços por produto no modal
- Preço médio automático preenchido do histórico
- Sugestões automáticas de itens frequentes
- Edição e exclusão com animação de swipe
- Modal de finalização com nome e supermercado

### 💰 Controle de Preços
- Histórico de preço por produto (últimas 20 compras)
- Preço médio calculado automaticamente
- Badge de variação no item da lista (% de subida/descida)
- Informação de preço no autocomplete

### 📋 Histórico de Compras
- Lista de todas as compras finalizadas
- Filtro por mês com navegação
- Busca por nome, mercado ou produto
- Detalhes completos da compra (modal)
- Reutilizar lista (atualiza preços para médias atuais)
- Duplicar compra no histórico
- Excluir compra

### 📦 Controle de Estoque
- Adicionar produtos com unidade, quantidade e alerta personalizado
- Atualizar quantidade com botões +/−
- Status visual: ✅ OK / ⚠️ Baixo / ❌ Esgotado
- Filtros: Todos, Baixo, OK, Esgotado
- Banner de alerta para itens com problemas
- Decremento automático ao finalizar compra (opcional)

### 📊 Relatórios Avançados
- Filtro por período: 1 mês, 3 meses, 6 meses, 1 ano
- Cards de resumo: total, n° compras, média, maior compra
- Gráfico de barras horizontal: gastos por categoria
- Gráfico de linha: evolução mensal de gastos
- Tabela de produtos mais caros (top 8)
- Lista de variação de preços por produto
- Exportar relatório em PDF (jsPDF)
- Exportar todos os dados em JSON

### 👨‍👩‍👧 Modo Família (Offline)
- Gerar QR Code da lista atual para compartilhar
- Escanear QR Code com câmera (jsQR)
- Importar lista por colar texto (dados copiados)
- Copiar dados de compartilhamento
- Exportar backup completo (JSON)
- Importar backup de arquivo JSON

### ⚙️ Configurações
- Tema claro/escuro (persistido)
- Moeda configurável (R$, $, €, £)
- Ordenação por categoria (toggle)
- Sugestões automáticas (toggle)
- Alertas de estoque (toggle + limite configurável)
- Gerenciar categorias (adicionar/excluir)
- Reset completo de dados

---

## 🗂️ Estrutura do Projeto

```
index.html              → Estrutura principal do app
css/
  style.css             → Estilos completos (dark/light theme)
  animations.css        → Animações e transições
js/
  db.js                 → Banco de dados local (localStorage)
  utils.js              → Utilitários, formatação, PDF, download
  categories.js         → Gerenciamento de categorias
  charts.js             → Gráficos (Chart.js)
  list.js               → Lista de compras (principal)
  dashboard.js          → Dashboard com resumos
  history.js            → Histórico de compras
  stock.js              → Controle de estoque
  reports.js            → Relatórios avançados
  family.js             → Modo família, QR Code, backup
  settings.js           → Configurações
  app.js                → Inicialização, dados demo, SW
sw.js                   → Service Worker (cache offline)
```

---

## 💾 Armazenamento de Dados

**100% offline com localStorage:**

| Chave | Conteúdo |
|-------|----------|
| `ms_settings` | Configurações do usuário |
| `ms_categories` | Categorias customizadas |
| `ms_current_list` | Lista de compras ativa |
| `ms_purchases` | Histórico de compras finalizadas |
| `ms_stock` | Itens do estoque doméstico |
| `ms_price_history` | Histórico de preços por produto |
| `ms_product_history` | Frequência de uso por produto |

---

## 🔗 Navegação

| Página | Descrição |
|--------|-----------|
| `#` → pageDashboard | Tela inicial com resumos e gráficos |
| `#` → pageList | Lista de compras ativa |
| `#` → pageHistory | Histórico de compras finalizadas |
| `#` → pageStock | Controle de estoque doméstico |
| `#` → pageReports | Relatórios e exportações |
| Settings → Família | Modo família (QR Code e backup) |

---

## 📱 Tecnologias

- **Frontend:** HTML5, CSS3, JavaScript ES6+ (Vanilla)
- **Armazenamento:** localStorage (offline)
- **Gráficos:** Chart.js 4.4.0
- **QR Code (gerar):** QRCode.js
- **QR Code (ler):** jsQR
- **PDF:** jsPDF 2.5.1
- **Voz:** Web Speech API (nativa)
- **Offline:** Service Worker (Cache API)
- **Tema:** CSS Variables (dark/light)

---

## 🚀 Próximos Passos

- [ ] Notificações push via Service Worker
- [ ] Modo offline completo sem dependência de CDN (bundle local)
- [ ] Sincronização via Bluetooth (Web Bluetooth API)
- [ ] Scanner de código de barras de produtos
- [ ] Importação de lista via CSV
- [ ] Widget de estoque na tela inicial
- [ ] Recorrência de compras (assinatura mensal)
- [ ] Comparação de preços entre supermercados
- [ ] Integração com listas compartilhadas por família via URL
- [ ] Exportação para APK via Capacitor.js / Ionic


## Atualizações 1.3.0
- orçamento mensal offline
- reposição inteligente baseada em histórico
- leitura local de código de barras (quando suportado pelo navegador)
- categoria automática e comparativo por mercado
- notificações locais ao abrir o app
