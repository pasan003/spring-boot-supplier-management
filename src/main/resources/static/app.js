/* App entry point: hash router + dashboard view.
   Routes:
     #/dashboard           overview
     #/products            product CRUD + barcode scan
     #/suppliers           supplier CRUD
     #/purchase-orders     PO list | /new | /:id | /:id/edit
     #/grns                GRN list | /new[/:poId] | /:id
*/

/* ----------------------------------------------------------
   Dashboard
   ---------------------------------------------------------- */
const DashboardView = {

  async render(container) {
    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Dashboard</h1>
          <p class="page-sub">Overview of your supermarket — products, suppliers and order flow.</p>
        </div>
        <div class="quick-actions">
          <a class="btn btn-primary" href="#/purchase-orders/new">+ Purchase Order</a>
          <a class="btn btn-secondary" href="#/grns/new">+ Goods Received</a>
        </div>
      </div>
      <div id="dash-cards" class="summary-grid">${ui.loading('Loading dashboard...')}</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:18px;margin-top:18px;">
        <div class="card" id="dash-po-card">
          <div class="card-pad"><h2 class="card-title">Recent purchase orders</h2><div id="dash-po">${ui.loading()}</div></div>
        </div>
        <div class="card" id="dash-grn-card">
          <div class="card-pad"><h2 class="card-title">Recent goods received</h2><div id="dash-grn">${ui.loading()}</div></div>
        </div>
      </div>`;

    try {
      const [products, suppliers, pos, grns] = await Promise.all([
        ProductsView.loadProducts(),
        SuppliersView.loadSuppliers(),
        API.get('/api/purchase-orders'),
        API.get('/api/grns'),
      ]);

      const activeSuppliers = suppliers.filter(s => s.active).length;
      const awaiting = pos.filter(o => o.status === 'APPROVED' || o.status === 'PARTIALLY_RECEIVED').length;
      const completed = pos.filter(o => o.status === 'RECEIVED').length;
      const today = ui.todayInput();
      const grnsToday = grns.filter(g => g.receivedDate === today).length;

      const cards = [
        { label: 'Products', value: products.length, cls: 'blue', sub: 'in catalogue' },
        { label: 'Active Suppliers', value: activeSuppliers, cls: 'slate', sub: `${suppliers.length} total` },
        { label: 'Purchase Orders', value: pos.length, cls: 'amber', sub: `${pos.filter(o => o.status === 'DRAFT' || o.status === 'PENDING').length} pending approval` },
        { label: 'Awaiting Delivery', value: awaiting, cls: 'purple', sub: 'approved, not fully received' },
        { label: 'Orders Completed', value: completed, cls: 'green', sub: 'fully received' },
        { label: 'GRNs Today', value: grnsToday, cls: 'green', sub: `${grns.length} total receipts` },
      ];

      container.querySelector('#dash-cards').innerHTML = cards.map(c => `
        <div class="stat-card ${c.cls}">
          <div class="stat-label">${c.label}</div>
          <div class="stat-value">${c.value}</div>
          <div class="stat-sub">${c.sub}</div>
        </div>`).join('');

      container.querySelector('#dash-po').innerHTML = pos.length === 0
        ? ui.empty('📋', 'No purchase orders yet', 'Create one to start the supplier workflow.', `<a class="btn btn-primary btn-sm" href="#/purchase-orders/new">+ Create Purchase Order</a>`)
        : `<div class="table-wrap"><table class="table">
            <thead><tr><th>PO</th><th>Supplier</th><th class="num">Total</th><th>Status</th></tr></thead>
            <tbody>${pos.slice(0, 5).map(po => `
              <tr>
                <td><a class="cell-main" style="color:var(--primary);text-decoration:none;" href="#/purchase-orders/${po.id}">${ui.esc(po.poNumber)}</a></td>
                <td>${ui.esc(po.supplier?.name || '—')}</td>
                <td class="num strong">${ui.money(po.totalAmount)}</td>
                <td>${ui.badge(po.status)}</td>
              </tr>`).join('')}
            </tbody></table></div>`;

      container.querySelector('#dash-grn').innerHTML = grns.length === 0
        ? ui.empty('📥', 'No goods received yet', 'Received stock will appear here.', `<a class="btn btn-secondary btn-sm" href="#/grns/new">+ Create GRN</a>`)
        : `<div class="table-wrap"><table class="table">
            <thead><tr><th>GRN</th><th>PO</th><th class="num">Received</th><th>Status</th></tr></thead>
            <tbody>${grns.slice(0, 5).map(g => `
              <tr>
                <td><a class="cell-main" style="color:var(--primary);text-decoration:none;" href="#/grns/${g.id}">${ui.esc(g.grnNumber)}</a></td>
                <td>${ui.esc(g.purchaseOrder?.poNumber || '—')}</td>
                <td class="num strong">${g.totalReceivedQuantity}</td>
                <td>${ui.badge(g.status)}</td>
              </tr>`).join('')}
            </tbody></table></div>`;
    } catch (err) {
      container.querySelector('#dash-cards').innerHTML =
        `<div style="grid-column:1/-1;">${ui.empty('⚠️', 'Could not load dashboard', err.message || 'Unknown error')}</div>`;
    }
  },
};

/* ----------------------------------------------------------
   Router
   ---------------------------------------------------------- */
const views = {
  dashboard: DashboardView,
  products: ProductsView,
  suppliers: SuppliersView,
  'purchase-orders': PurchaseOrdersView,
  grns: GrnsView,
};

function parseHash() {
  const hash = window.location.hash.replace(/^#\/?/, '');
  const parts = hash.split('/').filter(Boolean);
  return { view: parts[0] || 'dashboard', params: parts.slice(1) };
}

async function render() {
  const { view, params } = parseHash();
  const container = document.getElementById('app-view');
  const current = views[view];

  document.querySelectorAll('.nav-link').forEach(a =>
    a.classList.toggle('active', a.dataset.view === view));
  window.scrollTo(0, 0);

  if (!current) {
    container.innerHTML = ui.empty('🧭', 'Page not found',
      'The page you are looking for does not exist.',
      '<a class="btn btn-secondary" href="#/dashboard">Go to Dashboard</a>');
    return;
  }

  try {
    await current.render(container, params);
  } catch (err) {
    container.innerHTML = ui.empty('⚠️', 'Something went wrong', err.message || 'Unexpected error');
  }
}

window.addEventListener('hashchange', render);
window.addEventListener('DOMContentLoaded', render);
