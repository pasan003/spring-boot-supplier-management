/* Goods Received Notes view — list, step wizard, document detail.
   Flow: select PO -> review ordered items -> enter received qty -> confirm (updates stock). */

const GrnsView = {

  async render(container, params) {
    const [sub, id] = params;
    if (sub === 'new') return GrnsView.renderWizard(container, id ? Number(id) : null);
    if (id) return GrnsView.renderDetail(container, id);
    return GrnsView.renderList(container);
  },

  /* ----------------------------------------------------------
     LIST
     ---------------------------------------------------------- */
  async renderList(container) {
    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Goods Received Notes</h1>
          <p class="page-sub">Records of stock actually received from suppliers. Confirming a GRN increases product stock.</p>
        </div>
        <div class="page-actions">
          <a class="btn btn-primary" href="#/grns/new">+ Create GRN</a>
        </div>
      </div>
      <div id="grn-summary" class="summary-grid"></div>
      <div class="card">
        <div class="toolbar" style="padding:16px 16px 0;">
          <div class="search-box">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input id="grn-search" type="text" placeholder="Search GRN or PO number...">
          </div>
          <select id="grn-filter-status">
            <option value="">All statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="RECEIVED">Received</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
        <div class="table-wrap" id="grn-table-wrap">
          <div class="loading-state"><span class="spinner"></span><span>Loading GRNs...</span></div>
        </div>
      </div>`;

    GrnsView.bindFilters(container);
    GrnsView.loadList(container);
  },

  async loadList(container) {
    const wrap = container.querySelector('#grn-table-wrap');
    try {
      const grns = await API.get('/api/grns');
      GrnsView.renderListData(container, grns);
    } catch (err) {
      wrap.innerHTML = ui.empty('⚠️', 'Could not load GRNs', err.message || 'Unknown error');
    }
  },

  renderListData(container, grns) {
    const today = ui.todayInput();
    const summary = [
      { label: 'Total GRNs', value: grns.length, cls: 'blue', sub: 'all time' },
      { label: 'Received Today', value: grns.filter(g => g.receivedDate === today && g.status === 'RECEIVED').length, cls: 'green', sub: ui.date(today) },
      { label: 'Pending (Draft)', value: grns.filter(g => g.status === 'DRAFT').length, cls: 'amber', sub: 'awaiting confirmation' },
      { label: 'Received', value: grns.filter(g => g.status === 'RECEIVED').length, cls: 'green', sub: 'stock updated' },
      { label: 'Cancelled', value: grns.filter(g => g.status === 'CANCELLED').length, cls: 'red', sub: 'not confirmed' },
    ];
    container.querySelector('#grn-summary').innerHTML = summary.map(s => `
      <div class="stat-card ${s.cls}">
        <div class="stat-label">${s.label}</div>
        <div class="stat-value">${s.value}</div>
        <div class="stat-sub">${s.sub}</div>
      </div>`).join('');

    const q = (container.querySelector('#grn-search').value || '').trim().toLowerCase();
    const status = container.querySelector('#grn-filter-status').value;

    const filtered = grns.filter(g => {
      if (status && g.status !== status) return false;
      if (q && !(`${g.grnNumber} ${g.purchaseOrder?.poNumber || ''}`.toLowerCase().includes(q))) return false;
      return true;
    });

    const wrap = container.querySelector('#grn-table-wrap');

    if (filtered.length === 0) {
      wrap.innerHTML = grns.length === 0
        ? ui.empty('📥', 'No goods received yet',
            'Once a purchase order is approved, receive stock here and the product quantities increase automatically.',
            `<a class="btn btn-primary" href="#/grns/new">+ Create GRN</a>`)
        : ui.empty('🔍', 'No matches', 'No goods received notes match the current filters.');
      return;
    }

    wrap.innerHTML = `
      <table class="table">
        <thead>
          <tr>
            <th>GRN Number</th><th>PO Number</th><th>Supplier</th><th>Received Date</th>
            <th class="num">Items Received</th><th>Status</th><th class="actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.map(g => `
            <tr>
              <td><span class="cell-main">${ui.esc(g.grnNumber)}</span></td>
              <td><a class="cell-main" style="color:var(--primary);text-decoration:none;" href="#/purchase-orders/${g.purchaseOrder?.id}">${ui.esc(g.purchaseOrder?.poNumber || '—')}</a></td>
              <td><span class="cell-main">${ui.esc(g.purchaseOrder?.supplier?.name || '—')}</span></td>
              <td>${ui.date(g.receivedDate)}</td>
              <td class="num strong">${g.totalReceivedQuantity} unit(s)</td>
              <td>${ui.badge(g.status)}</td>
              <td class="actions">
                <a class="link-btn" href="#/grns/${g.id}">View</a>
                ${g.status === 'DRAFT'
                  ? `<button class="link-btn success" data-action="confirm" data-id="${g.id}">Confirm</button>
                     <button class="link-btn danger" data-action="cancel" data-id="${g.id}">Cancel</button>`
                  : ''}
              </td>
            </tr>`).join('')}
        </tbody>
      </table>`;

    wrap.querySelector('tbody').addEventListener('click', (e) => GrnsView.onListAction(container, e));
  },

  bindFilters(container) {
    container.querySelector('#grn-search').addEventListener('input', ui.debounce(() => GrnsView.loadList(container), 250));
    container.querySelector('#grn-filter-status').addEventListener('change', () => GrnsView.loadList(container));
  },

  async onListAction(container, e) {
    const btn = e.target.closest('button');
    if (!btn) return;
    const { action, id } = btn.dataset;

    if (action === 'confirm') {
      const ok = await ui.confirm({
        title: 'Confirm goods receipt',
        message: 'Confirming increases product stock by the received quantities and updates the PO status. This cannot be undone.',
        confirmText: 'Confirm receipt',
      });
      if (!ok) return;
      try {
        const grn = await API.putNoBody(`/api/grns/${id}/confirm`);
        ui.toast(`GRN ${grn.grnNumber} confirmed — stock updated.`);
        GrnsView.loadList(container);
      } catch (err) {
        ui.toast(err.message || 'Unable to confirm the GRN.', 'error');
        GrnsView.loadList(container);
      }
    }

    if (action === 'cancel') {
      const ok = await ui.confirm({
        title: 'Cancel GRN',
        message: 'The draft receipt will be cancelled. Stock is not affected.',
        confirmText: 'Cancel GRN',
        danger: true,
      });
      if (!ok) return;
      try {
        await API.putNoBody(`/api/grns/${id}/cancel`);
        ui.toast('GRN cancelled.');
        GrnsView.loadList(container);
      } catch (err) {
        ui.toast(err.message, 'error');
      }
    }
  },

  /* ----------------------------------------------------------
     WIZARD (create)
     ---------------------------------------------------------- */
  async renderWizard(container, preselectPoId) {
    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Create Goods Received Note</h1>
          <p class="page-sub">Record stock received against an approved purchase order.</p>
        </div>
        <div class="page-actions">
          <a class="btn btn-secondary" href="#/grns">← Back</a>
        </div>
      </div>

      <div class="wizard">
        <div class="wizard-step active" data-step="1"><span class="dot">1</span> Select Purchase Order</div>
        <span class="wizard-arrow">→</span>
        <div class="wizard-step" data-step="2"><span class="dot">2</span> Review Ordered Items</div>
        <span class="wizard-arrow">→</span>
        <div class="wizard-step" data-step="3"><span class="dot">3</span> Enter Received Quantities</div>
        <span class="wizard-arrow">→</span>
        <div class="wizard-step" data-step="4"><span class="dot">4</span> Confirm Receipt</div>
      </div>

      <div id="grn-wizard-root">${ui.loading('Finding receivable purchase orders...')}</div>`;

    let receivable;
    try {
      receivable = await API.get('/api/purchase-orders/receivable');
    } catch (err) {
      container.querySelector('#grn-wizard-root').innerHTML =
        ui.empty('⚠️', 'Could not load purchase orders', err.message || 'Unknown error');
      return;
    }

    const root = container.querySelector('#grn-wizard-root');

    if (receivable.length === 0) {
      root.innerHTML = ui.empty('📦', 'No purchase orders to receive',
        'There are no APPROVED purchase orders with outstanding quantities. Approve an order first.',
        `<a class="btn btn-secondary" href="#/purchase-orders">Go to Purchase Orders</a>`);
      return;
    }

    root.innerHTML = `
      <div class="card card-pad">
        <h2 class="card-title">Step 1 — Choose the purchase order</h2>
        <div class="form-field" style="margin-top:12px;">
          <select id="wizard-po">
            <option value="">Select a purchase order...</option>
            ${receivable.map(po => {
              const outstanding = po.items.reduce((s, i) => s + (i.remainingQuantity ?? 0), 0);
              return `<option value="${po.id}">
                ${ui.esc(po.poNumber)} — ${ui.esc(po.supplier?.name || '')} (${outstanding} units outstanding)
              </option>`;
            }).join('')}
          </select>
        </div>
      </div>
      <div id="wizard-detail"></div>
      <div class="card card-pad" id="wizard-actions" style="display:none;">
        <div class="form-actions" style="margin:0;">
          <a class="btn btn-secondary" href="#/grns">Cancel</a>
          <button class="btn btn-primary" id="wizard-confirm">Confirm Receipt</button>
        </div>
      </div>`;

    const select = root.querySelector('#wizard-po');
    let currentPo = null;
    let loadToken = 0;

    // Live-clamp "receive now" inputs against the outstanding max. Delegated on root once.
    root.addEventListener('input', (e) => {
      if (!e.target.classList.contains('wizard-qty')) return;
      const max = Number(e.target.max);
      if (e.target.value !== '' && Number(e.target.value) > max) {
        e.target.value = max;
        ui.toast(`Maximum receivable is ${max} unit(s) for this product.`, 'info');
      }
    });

    const loadPo = async (poId) => {
      const token = ++loadToken;
      if (!poId) {
        currentPo = null;
        root.querySelector('#wizard-detail').innerHTML = '';
        root.querySelector('#wizard-actions').style.display = 'none';
        return;
      }
      root.querySelector('#wizard-detail').innerHTML = ui.loading('Loading order items...');
      try {
        const po = await API.get(`/api/purchase-orders/${poId}`);
        if (token !== loadToken) return; // a newer selection won the race
        currentPo = po;
        GrnsView.renderWizardDetail(root, po);
        document.querySelectorAll('.wizard-step')[1].classList.add('active');
        document.querySelectorAll('.wizard-step')[2].classList.add('active');
      } catch (err) {
        currentPo = null;
        root.querySelector('#wizard-detail').innerHTML = ui.empty('⚠️', 'Could not load the order', err.message);
      }
    };

    // Attached exactly ONCE per wizard render (reads the current PO at click time,
    // so switching POs can never stack duplicate handlers).
    root.querySelector('#wizard-confirm').addEventListener('click', () => {
      if (currentPo) GrnsView.confirmReceipt(root, currentPo);
    });

    select.addEventListener('change', () => loadPo(select.value));
    if (preselectPoId && receivable.some(p => p.id === preselectPoId)) {
      select.value = preselectPoId;
      loadPo(preselectPoId);
    }
  },

  renderWizardDetail(root, po) {
    const outstandingTotal = po.items.reduce((s, i) => s + (i.remainingQuantity ?? 0), 0);
    root.querySelector('#wizard-detail').innerHTML = `
      <div class="card card-pad" style="margin-top:16px;">
        <h2 class="card-title">Step 2 — Ordered items for ${ui.esc(po.poNumber)}</h2>
        <p class="card-sub">Supplier: ${ui.esc(po.supplier?.name || '')} · Order total: ${ui.money(po.totalAmount)} · ${outstandingTotal} units still outstanding.</p>
        <div class="table-wrap" style="border:1px solid var(--border);border-radius:var(--radius-sm);">
          <table class="table">
            <thead>
              <tr><th>Product</th><th class="num">Ordered</th><th class="num">Already Received</th><th class="num">Remaining</th><th class="num" style="min-width:130px;">Receive Now</th></tr>
            </thead>
            <tbody>
              ${po.items.map(i => `
                <tr>
                  <td><span class="cell-main">${ui.esc(i.product?.name || '—')}</span>
                      <span class="cell-sub">${ui.esc(i.product?.barcode || '')}</span></td>
                  <td class="num strong">${i.quantity}</td>
                  <td class="num">${i.receivedQuantity ?? 0}</td>
                  <td class="num">${i.remainingQuantity ?? i.quantity}</td>
                  <td>
                    <input type="number" class="wizard-qty" min="0" max="${i.remainingQuantity ?? i.quantity}"
                           value="${i.remainingQuantity ?? i.quantity}" data-item-id="${i.id}">
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>`;

    root.querySelector('#wizard-actions').style.display = '';
  },

  async confirmReceipt(root, po) {
    const items = [];
    root.querySelectorAll('.wizard-qty').forEach(input => {
      const value = input.value === '' ? 0 : parseInt(input.value, 10);
      items.push({ purchaseOrderItemId: Number(input.dataset.itemId), receivedQuantity: value });
    });

    if (!items.some(i => i.receivedQuantity > 0)) {
      ui.toast('Enter a received quantity greater than 0 for at least one product.', 'error');
      return;
    }

    const btn = root.querySelector('#wizard-confirm');
    btn.disabled = true;
    btn.textContent = 'Confirming...';

    try {
      // 1) create the DRAFT GRN, then 2) confirm it (validates + updates stock).
      const grn = await API.post('/api/grns', {
        purchaseOrderId: po.id,
        receivedBy: '',
        notes: '',
        items,
      });
      try {
        await API.putNoBody(`/api/grns/${grn.id}/confirm`);
      } catch (confirmErr) {
        // Draft was created but confirmation was rejected — open it so it can be reviewed,
        // fixed or cancelled instead of silently creating a duplicate draft on retry.
        ui.toast(confirmErr.message || 'Confirmation failed — the draft GRN is kept for review.', 'error');
        window.location.hash = `#/grns/${grn.id}`;
        return;
      }
      ui.toast(`GRN ${grn.grnNumber} confirmed — product stock updated.`);
      window.location.hash = `#/grns/${grn.id}`;
    } catch (err) {
      btn.disabled = false;
      btn.textContent = 'Confirm Receipt';
      ui.toast(err.message || 'Unable to confirm the receipt.', 'error');
    }
  },

  /* ----------------------------------------------------------
     DETAIL
     ---------------------------------------------------------- */
  async renderDetail(container, id) {
    container.innerHTML = `<div class="loading-state"><span class="spinner"></span><span>Loading GRN...</span></div>`;
    try {
      const grn = await API.get(`/api/grns/${id}`);
      const po = grn.purchaseOrder;

      container.innerHTML = `
        <div class="page-header">
          <div>
            <h1 class="page-title">Goods Received Note</h1>
            <p class="page-sub">${ui.esc(grn.grnNumber)} · received ${ui.date(grn.receivedDate)}</p>
          </div>
          <div class="page-actions">
            <a class="btn btn-secondary" href="#/grns">← Back to list</a>
          </div>
        </div>

        <div class="document">
          <div class="doc-head">
            <div>
              <h2 class="doc-title">GOODS RECEIVED NOTE</h2>
              <div class="doc-sub">${ui.esc(grn.grnNumber)}</div>
            </div>
            <div class="doc-meta">${ui.badge(grn.status)}</div>
          </div>

          <div class="doc-body">
            <div class="doc-grid">
              <div>
                <div class="doc-label">Purchase order</div>
                <div class="doc-value"><a href="#/purchase-orders/${po?.id}" style="color:var(--primary);text-decoration:none;">${ui.esc(po?.poNumber || '—')}</a></div>
              </div>
              <div>
                <div class="doc-label">Supplier</div>
                <div class="doc-value">${ui.esc(po?.supplier?.name || '—')}</div>
              </div>
              <div>
                <div class="doc-label">Received date</div>
                <div class="doc-value">${ui.date(grn.receivedDate)}</div>
              </div>
              <div>
                <div class="doc-label">Received by</div>
                <div class="doc-value">${ui.esc(grn.receivedBy || '—')}</div>
              </div>
              <div>
                <div class="doc-label">Total received</div>
                <div class="doc-value">${grn.totalReceivedQuantity} unit(s)</div>
              </div>
            </div>

            <div class="doc-section-title">Received items</div>
            <div class="table-wrap" style="border:1px solid var(--border);border-radius:var(--radius-sm);">
              <table class="table">
                <thead>
                  <tr>
                    <th>Product</th><th class="num">Ordered</th><th class="num">Received</th><th class="num">Difference</th>
                  </tr>
                </thead>
                <tbody>
                  ${grn.items.map(i => {
                    const diff = i.receivedQuantity - (i.purchaseOrderItem?.quantity ?? 0);
                    const diffClass = diff === 0 ? 'muted' : (diff < 0 ? '' : 'strong');
                    const diffColor = diff < 0 ? 'var(--warning)' : (diff === 0 ? 'var(--text-3)' : 'var(--success)');
                    return `
                      <tr>
                        <td><span class="cell-main">${ui.esc(i.product?.name || '—')}</span>
                            <span class="cell-sub">${ui.esc(i.product?.barcode || '')}</span></td>
                        <td class="num">${i.purchaseOrderItem?.quantity ?? '—'}</td>
                        <td class="num strong">${i.receivedQuantity}</td>
                        <td class="num ${diffClass}" style="color:${diffColor};font-weight:700;">${diff > 0 ? '+' : ''}${diff}</td>
                      </tr>`;
                  }).join('')}
                </tbody>
              </table>
            </div>

            <div class="doc-total">
              <span class="total-label">Total received</span>
              <span class="total-value">${grn.totalReceivedQuantity} unit(s)</span>
            </div>

            ${grn.notes ? `
              <div class="doc-notes">
                <span class="doc-label">Notes</span>
                ${ui.esc(grn.notes)}
              </div>` : ''}
          </div>
        </div>

        <div class="card card-pad" style="margin-top:18px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">
          <span style="color:var(--text-2);font-size:.88rem;">
            ${grn.status === 'RECEIVED'
              ? '✅ This receipt is confirmed — product stock has been updated.'
              : grn.status === 'DRAFT'
                ? 'This receipt is still a draft. Confirming it will update product stock.'
                : 'This receipt was cancelled — stock was not affected.'}
          </span>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            ${grn.status === 'DRAFT' ? `
              <button class="btn btn-primary" id="grn-confirm">Confirm Receipt</button>
              <button class="btn btn-danger" id="grn-cancel">Cancel GRN</button>` : ''}
          </div>
        </div>`;

      if (container.querySelector('#grn-confirm')) {
        container.querySelector('#grn-confirm').addEventListener('click', async (e) => {
          const ok = await ui.confirm({
            title: 'Confirm goods receipt',
            message: 'Confirming increases product stock by the received quantities and updates the PO status. This cannot be undone.',
            confirmText: 'Confirm receipt',
          });
          if (!ok) return;
          e.target.disabled = true;
          try {
            await API.putNoBody(`/api/grns/${grn.id}/confirm`);
            ui.toast('Receipt confirmed — stock updated.');
            GrnsView.renderDetail(container, grn.id);
          } catch (err) {
            e.target.disabled = false;
            ui.toast(err.message || 'Unable to confirm the GRN.', 'error');
          }
        });
      }

      if (container.querySelector('#grn-cancel')) {
        container.querySelector('#grn-cancel').addEventListener('click', async (e) => {
          const ok = await ui.confirm({
            title: 'Cancel GRN',
            message: 'This draft receipt will be cancelled. Stock is not affected.',
            confirmText: 'Cancel GRN',
            danger: true,
          });
          if (!ok) return;
          e.target.disabled = true;
          try {
            await API.putNoBody(`/api/grns/${grn.id}/cancel`);
            ui.toast('GRN cancelled.');
            GrnsView.renderDetail(container, grn.id);
          } catch (err) {
            e.target.disabled = false;
            ui.toast(err.message, 'error');
          }
        });
      }
    } catch (err) {
      container.innerHTML = ui.empty('⚠️', 'Could not load GRN', err.message || 'Unknown error',
        `<a class="btn btn-secondary" href="#/grns">← Back to list</a>`);
    }
  },
};
