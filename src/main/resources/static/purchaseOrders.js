/* Purchase Orders view — list, create/edit form, document-style detail. */

const PurchaseOrdersView = {

  async render(container, params) {
    const [sub, id] = params;
    if (sub === 'new') return PurchaseOrdersView.renderForm(container);
    if (id) {
      if (sub === 'edit') return PurchaseOrdersView.renderForm(container, id);
      return PurchaseOrdersView.renderDetail(container, id);
    }
    return PurchaseOrdersView.renderList(container);
  },

  /* ----------------------------------------------------------
     LIST
     ---------------------------------------------------------- */
  async renderList(container) {
    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Purchase Orders</h1>
          <p class="page-sub">Orders you place with suppliers. Approve them, then receive goods via a GRN.</p>
        </div>
        <div class="page-actions">
          <a class="btn btn-primary" href="#/purchase-orders/new">+ Create Purchase Order</a>
        </div>
      </div>
      <div id="po-summary" class="summary-grid"></div>
      <div class="card">
        <div class="toolbar" style="padding:16px 16px 0;">
          <div class="search-box">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input id="po-search" type="text" placeholder="Search PO number or supplier...">
          </div>
          <select id="po-filter-status">
            <option value="">All statuses</option>
            ${['DRAFT', 'PENDING', 'APPROVED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED']
              .map(s => `<option value="${s}">${s.replaceAll('_', ' ')}</option>`).join('')}
          </select>
          <select id="po-filter-supplier"><option value="">All suppliers</option></select>
        </div>
        <div class="table-wrap" id="po-table-wrap">
          <div class="loading-state"><span class="spinner"></span><span>Loading purchase orders...</span></div>
        </div>
      </div>`;

    PurchaseOrdersView.bindListFilters(container);
    PurchaseOrdersView.loadList(container);
  },

  async loadList(container) {
    const wrap = container.querySelector('#po-table-wrap');
    try {
      const [orders, suppliers] = await Promise.all([
        API.get('/api/purchase-orders'),
        SuppliersView.loadSuppliers().catch(() => []),
      ]);

      // Rebuild the supplier dropdown but keep the user's current selection.
      const supplierFilter = container.querySelector('#po-filter-supplier');
      const previous = supplierFilter.value;
      supplierFilter.innerHTML = '<option value="">All suppliers</option>' +
        suppliers.map(s => `<option value="${s.id}">${ui.esc(s.name)}</option>`).join('');
      if (previous && [...supplierFilter.options].some(o => o.value === previous)) {
        supplierFilter.value = previous;
      }

      PurchaseOrdersView.renderListData(container, orders);
    } catch (err) {
      wrap.innerHTML = ui.empty('⚠️', 'Could not load purchase orders', err.message || 'Unknown error');
    }
  },

  renderListData(container, orders) {
    // Summary cards
    const count = (status) => orders.filter(o => o.status === status).length;
    const summary = [
      { label: 'Total POs', value: orders.length, cls: 'blue', sub: 'all time' },
      { label: 'Pending', value: count('DRAFT') + count('PENDING'), cls: 'amber', sub: 'not yet approved' },
      { label: 'Approved', value: count('APPROVED'), cls: 'blue', sub: 'awaiting delivery' },
      { label: 'Partially Received', value: count('PARTIALLY_RECEIVED'), cls: 'purple', sub: 'some stock arrived' },
      { label: 'Completed', value: count('RECEIVED'), cls: 'green', sub: 'fully received' },
      { label: 'Cancelled', value: count('CANCELLED'), cls: 'red', sub: 'not delivered' },
    ];
    container.querySelector('#po-summary').innerHTML = summary.map(s => `
      <div class="stat-card ${s.cls}">
        <div class="stat-label">${s.label}</div>
        <div class="stat-value">${s.value}</div>
        <div class="stat-sub">${s.sub}</div>
      </div>`).join('');

    const q = (container.querySelector('#po-search').value || '').trim().toLowerCase();
    const status = container.querySelector('#po-filter-status').value;
    const supplierId = container.querySelector('#po-filter-supplier').value;
    const supplierName = container.querySelector('#po-filter-supplier').selectedOptions[0]?.textContent || '';

    const filtered = orders.filter(o => {
      if (status && o.status !== status) return false;
      if (supplierId && String(o.supplier?.id) !== supplierId) return false;
      if (q && !(`${o.poNumber} ${o.supplier?.name || ''}`.toLowerCase().includes(q))) return false;
      return true;
    });

    const wrap = container.querySelector('#po-table-wrap');

    if (filtered.length === 0) {
      wrap.innerHTML = orders.length === 0
        ? ui.empty('📋', 'No purchase orders yet',
            'Create your first purchase order to start the supplier workflow.',
            `<a class="btn btn-primary" href="#/purchase-orders/new">+ Create Purchase Order</a>`)
        : ui.empty('🔍', 'No matches', `No purchase orders match the current filters. (Supplier: ${ui.esc(supplierName) || 'any'})`);
      return;
    }

    wrap.innerHTML = `
      <table class="table">
        <thead>
          <tr>
            <th>PO Number</th><th>Supplier</th><th>Order Date</th><th>Expected Delivery</th>
            <th class="num">Items</th><th class="num">Total</th><th>Status</th><th class="actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.map(PurchaseOrdersView.rowHtml).join('')}
        </tbody>
      </table>`;

    wrap.querySelector('tbody').addEventListener('click', (e) => PurchaseOrdersView.onListAction(container, e));
  },

  rowHtml(po) {
    const actions = [`<button class="link-btn" data-action="view" data-id="${po.id}">View</button>`];
    if (po.status === 'DRAFT' || po.status === 'PENDING') {
      actions.push(`<button class="link-btn" data-action="edit" data-id="${po.id}">Edit</button>`);
    }
    if (po.status === 'DRAFT' || po.status === 'PENDING') {
      actions.push(`<button class="link-btn success" data-action="approve" data-id="${po.id}">Approve</button>`);
    }
    if (po.status === 'APPROVED' || po.status === 'PARTIALLY_RECEIVED') {
      actions.push(`<a class="link-btn success" href="#/grns/new/${po.id}">Receive</a>`);
    }
    if (po.status === 'DRAFT' || po.status === 'PENDING' || po.status === 'APPROVED') {
      actions.push(`<button class="link-btn danger" data-action="cancel" data-id="${po.id}">Cancel</button>`);
    }

    return `
      <tr>
        <td><span class="cell-main">${ui.esc(po.poNumber)}</span></td>
        <td><span class="cell-main">${ui.esc(po.supplier?.name || '—')}</span></td>
        <td>${ui.date(po.orderDate)}</td>
        <td>${ui.date(po.expectedDeliveryDate)}</td>
        <td class="num">${po.items.length}</td>
        <td class="num strong">${ui.money(po.totalAmount)}</td>
        <td>${ui.badge(po.status)}</td>
        <td class="actions">${actions.join('')}</td>
      </tr>`;
  },

  bindListFilters(container) {
    container.querySelector('#po-search').addEventListener('input', ui.debounce(() => PurchaseOrdersView.loadList(container), 250));
    container.querySelector('#po-filter-status').addEventListener('change', () => PurchaseOrdersView.loadList(container));
    container.querySelector('#po-filter-supplier').addEventListener('change', () => PurchaseOrdersView.loadList(container));
  },

  async onListAction(container, e) {
    const btn = e.target.closest('button');
    if (!btn) return;
    const { action, id } = btn.dataset;

    if (action === 'view') { window.location.hash = `#/purchase-orders/${id}`; return; }
    if (action === 'edit') { window.location.hash = `#/purchase-orders/${id}/edit`; return; }

    if (action === 'approve') {
      const ok = await ui.confirm({
        title: 'Approve purchase order',
        message: 'Approving makes the order ready for receiving goods via a GRN.',
        confirmText: 'Approve',
      });
      if (!ok) return;
      try {
        await API.putNoBody(`/api/purchase-orders/${id}/approve`);
        ui.toast('Purchase order approved.');
      } catch (err) { ui.toast(err.message, 'error'); }
    }

    if (action === 'cancel') {
      const ok = await ui.confirm({
        title: 'Cancel purchase order',
        message: 'This will mark the order as cancelled. This cannot be undone.',
        confirmText: 'Cancel order',
        danger: true,
      });
      if (!ok) return;
      try {
        await API.putNoBody(`/api/purchase-orders/${id}/cancel`);
        ui.toast('Purchase order cancelled.');
      } catch (err) { ui.toast(err.message, 'error'); }
    }

    const orders = await API.get('/api/purchase-orders');
    PurchaseOrdersView.renderListData(container, orders);
  },

  /* ----------------------------------------------------------
     CREATE / EDIT FORM
     ---------------------------------------------------------- */
  async renderForm(container, poId) {
    const isEdit = !!poId;
    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">${isEdit ? 'Edit Purchase Order' : 'Create Purchase Order'}</h1>
          <p class="page-sub">${isEdit ? 'Update the order while it is still DRAFT or PENDING.' : 'Order products from a supplier — prices are taken from the product catalogue and can be adjusted.'}</p>
        </div>
        <div class="page-actions">
          <a class="btn btn-secondary" href="${isEdit ? `#/purchase-orders/${poId}` : '#/purchase-orders'}">← Back</a>
        </div>
      </div>
      <div id="po-form-root">${ui.loading('Preparing order form...')}</div>`;

    try {
      const [products, suppliers, existing] = await Promise.all([
        ProductsView.loadProducts(),
        SuppliersView.loadSuppliers(),
        isEdit ? API.get(`/api/purchase-orders/${poId}`) : Promise.resolve(null),
      ]);

      const root = container.querySelector('#po-form-root');

      if (products.length === 0) {
        root.innerHTML = ui.empty('📦', 'No products available',
          'Add some products to the catalogue before creating a purchase order.',
          `<a class="btn btn-primary" href="#/products">Go to Products</a>`);
        return;
      }
      if (suppliers.length === 0) {
        root.innerHTML = ui.empty('🏢', 'No suppliers available',
          'Add a supplier before creating a purchase order.',
          `<a class="btn btn-primary" href="#/suppliers">Go to Suppliers</a>`);
        return;
      }

      root.innerHTML = `
        <div class="card card-pad">
          <h2 class="card-title">Supplier & dates</h2>
          <div class="form-grid" style="margin-top:12px;">
            <div class="form-field">
              <label for="po-supplier">Supplier *</label>
              <select id="po-supplier" required>
                <option value="">Select supplier...</option>
                ${suppliers.map(s => `
                  <option value="${s.id}" ${existing && existing.supplier?.id === s.id ? 'selected' : ''}>
                    ${ui.esc(s.name)} (${ui.esc(s.code)})${s.active ? '' : ' — inactive'}
                  </option>`).join('')}
              </select>
            </div>
            <div class="form-field">
              <label for="po-order-date">Order date *</label>
              <input id="po-order-date" type="date" value="${existing ? ui.esc(existing.orderDate) : ui.todayInput()}">
            </div>
            <div class="form-field">
              <label for="po-expected-date">Expected delivery</label>
              <input id="po-expected-date" type="date" value="${existing ? ui.esc(existing.expectedDeliveryDate || '') : ''}">
            </div>
          </div>
        </div>

        <div class="card card-pad">
          <div class="card-title-row" style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px;">
            <h2 class="card-title" style="margin:0;">Products</h2>
            <button type="button" class="btn btn-secondary btn-sm" id="add-item-btn">+ Add product</button>
          </div>
          <div class="items-editor">
            <div class="items-head">
              <span>Product</span><span>Quantity</span><span>Unit Price</span><span>Amount</span><span></span>
            </div>
            <div id="item-rows"></div>
          </div>
          <div class="totals-box">
            <div class="totals-row"><span>Subtotal</span><strong id="t-subtotal">${ui.money(0)}</strong></div>
            <div class="totals-grand"><span>Total</span><span id="t-total">${ui.money(0)}</span></div>
          </div>
        </div>

        <div class="card card-pad">
          <h2 class="card-title">Notes</h2>
          <div class="form-field" style="margin-top:10px;">
            <textarea id="po-notes" placeholder="Delivery instructions, payment terms, anything the supplier should know...">${existing ? ui.esc(existing.notes || '') : ''}</textarea>
          </div>
          <div class="form-actions">
            <button type="button" class="btn btn-secondary" id="po-cancel">Cancel</button>
            <button type="button" class="btn btn-primary" id="po-save">${isEdit ? 'Update Purchase Order' : 'Save Purchase Order'}</button>
          </div>
        </div>`;

      PurchaseOrdersView.bindForm(root, products, existing, isEdit, poId);
    } catch (err) {
      container.querySelector('#po-form-root').innerHTML =
        ui.empty('⚠️', 'Could not load the form', err.message || 'Unknown error');
    }
  },

  bindForm(root, products, existing, isEdit, poId) {
    const productOptions = products.map(p =>
      `<option value="${p.id}" data-price="${p.price}">${ui.esc(p.name)} (${ui.esc(p.barcode)})</option>`).join('');

    const addRow = (item) => {
      const row = document.createElement('div');
      row.className = 'item-row';
      row.innerHTML = `
        <select class="row-product" required>
          <option value="">Select product...</option>
          ${productOptions}
        </select>
        <input type="number" class="row-qty" min="1" value="${item?.quantity ?? 1}">
        <input type="number" class="row-price" min="0" step="0.01" value="${item?.unitPrice ?? ''}">
        <span class="amount">${ui.money(0)}</span>
        <button type="button" class="item-remove" title="Remove" aria-label="Remove">&times;</button>`;

      if (item) row.querySelector('.row-product').value = item.product.id;
      root.querySelector('#item-rows').appendChild(row);
      PurchaseOrdersView.updateRow(row, products);
    };

    if (existing && existing.items.length) {
      existing.items.forEach(item => addRow(item));
    } else {
      addRow();
    }

    // Delegated events
    root.addEventListener('change', (e) => {
      if (e.target.classList.contains('row-product')) {
        const price = products.find(p => p.id === Number(e.target.value))?.price ?? 0;
        e.target.closest('.item-row').querySelector('.row-price').value = price;
        PurchaseOrdersView.updateRow(e.target.closest('.item-row'), products);
      }
    });

    root.addEventListener('input', (e) => {
      if (e.target.classList.contains('row-qty') || e.target.classList.contains('row-price')) {
        PurchaseOrdersView.updateRow(e.target.closest('.item-row'), products);
      }
    });

    root.addEventListener('click', (e) => {
      if (e.target.classList.contains('item-remove')) {
        const rows = root.querySelectorAll('.item-row');
        if (rows.length <= 1) {
          ui.toast('A purchase order needs at least one product.', 'info');
          return;
        }
        e.target.closest('.item-row').remove();
        PurchaseOrdersView.updateTotals(root);
      }
      if (e.target.id === 'add-item-btn') addRow();
      if (e.target.id === 'po-cancel') {
        window.location.hash = isEdit ? `#/purchase-orders/${poId}` : '#/purchase-orders';
      }
      if (e.target.id === 'po-save') PurchaseOrdersView.saveForm(root, isEdit, poId);
    });

    root.querySelectorAll('.item-row').forEach(r => PurchaseOrdersView.updateRow(r, products));
  },

  updateRow(row, products) {
    const qty = Math.max(0, parseInt(row.querySelector('.row-qty').value || '0', 10) || 0);
    const price = parseFloat(row.querySelector('.row-price').value) || 0;
    row.querySelector('.amount').textContent = ui.money(qty * price);
    PurchaseOrdersView.updateTotals(row.closest('.card'));
  },

  updateTotals(card) {
    let subtotal = 0;
    card.querySelectorAll('.item-row').forEach(row => {
      const qty = Math.max(0, parseInt(row.querySelector('.row-qty').value || '0', 10) || 0);
      const price = parseFloat(row.querySelector('.row-price').value) || 0;
      subtotal += qty * price;
    });
    card.querySelector('#t-subtotal').textContent = ui.money(subtotal);
    card.querySelector('#t-total').textContent = ui.money(subtotal);
  },

  async saveForm(root, isEdit, poId) {
    const supplierId = root.querySelector('#po-supplier').value;
    if (!supplierId) {
      ui.toast('Please select a supplier.', 'error');
      return;
    }

    const items = [];
    root.querySelectorAll('.item-row').forEach(row => {
      const productId = row.querySelector('.row-product').value;
      const qty = parseInt(row.querySelector('.row-qty').value, 10);
      const unitPrice = parseFloat(row.querySelector('.row-price').value);
      if (!productId) return;
      items.push({ productId: Number(productId), quantity: qty, unitPrice });
    });

    if (items.length === 0) {
      ui.toast('Add at least one product with a quantity.', 'error');
      return;
    }
    if (items.some(i => !i.quantity || i.quantity <= 0)) {
      ui.toast('Quantity must be greater than 0 for every product.', 'error');
      return;
    }

    const payload = {
      supplierId: Number(supplierId),
      orderDate: root.querySelector('#po-order-date').value || ui.todayInput(),
      expectedDeliveryDate: root.querySelector('#po-expected-date').value || null,
      notes: root.querySelector('#po-notes').value.trim(),
      items,
    };

    const saveBtn = root.querySelector('#po-save');
    saveBtn.disabled = true;
    try {
      const po = isEdit
        ? await API.put(`/api/purchase-orders/${poId}`, payload)
        : await API.post('/api/purchase-orders', payload);
      ui.toast(isEdit ? 'Purchase order updated successfully.' : 'Purchase order created successfully.');
      window.location.hash = `#/purchase-orders/${po.id}`;
    } catch (err) {
      saveBtn.disabled = false;
      ui.toast(err.message || 'Unable to save the purchase order. Please check the supplier and items.', 'error');
    }
  },

  /* ----------------------------------------------------------
     DETAIL
     ---------------------------------------------------------- */
  async renderDetail(container, id) {
    container.innerHTML = `<div class="loading-state"><span class="spinner"></span><span>Loading purchase order...</span></div>`;
    try {
      const po = await API.get(`/api/purchase-orders/${id}`);
      const grns = await API.get(`/api/grns?poId=${id}`);

      const canEdit = po.status === 'DRAFT' || po.status === 'PENDING';
      const canApprove = canEdit;
      const canCancel = ['DRAFT', 'PENDING', 'APPROVED'].includes(po.status);
      const canReceive = po.status === 'APPROVED' || po.status === 'PARTIALLY_RECEIVED';

      container.innerHTML = `
        <div class="page-header">
          <div>
            <h1 class="page-title">Purchase Order</h1>
            <p class="page-sub">${ui.esc(po.poNumber)} · created ${ui.date(po.createdAt)}</p>
          </div>
          <div class="page-actions">
            <a class="btn btn-secondary" href="#/purchase-orders">← Back to list</a>
          </div>
        </div>

        <div class="document">
          <div class="doc-head">
            <div>
              <h2 class="doc-title">PURCHASE ORDER</h2>
              <div class="doc-sub">${ui.esc(po.poNumber)}</div>
            </div>
            <div class="doc-meta">${ui.badge(po.status)}</div>
          </div>

          <div class="doc-body">
            <div class="doc-grid">
              <div>
                <div class="doc-label">Supplier</div>
                <div class="doc-value">${ui.esc(po.supplier?.name || '—')}</div>
                <div class="doc-value normal" style="font-weight:400;color:var(--text-3);">
                  ${ui.esc(po.supplier?.contactNumber || '')}
                  ${po.supplier?.email ? ' · ' + ui.esc(po.supplier.email) : ''}
                </div>
              </div>
              <div>
                <div class="doc-label">Order date</div>
                <div class="doc-value">${ui.date(po.orderDate)}</div>
              </div>
              <div>
                <div class="doc-label">Expected delivery</div>
                <div class="doc-value">${ui.date(po.expectedDeliveryDate)}</div>
              </div>
              <div>
                <div class="doc-label">Items</div>
                <div class="doc-value">${po.items.length} product(s)</div>
              </div>
            </div>

            <div class="doc-section-title">Products</div>
            <div class="table-wrap" style="border:1px solid var(--border);border-radius:var(--radius-sm);">
              <table class="table" style="min-width:720px;">
                <thead>
                  <tr>
                    <th>Product</th><th class="num">Qty</th><th class="num">Unit Price</th>
                    <th class="num">Amount</th><th class="num">Received</th><th class="num">Remaining</th><th>Progress</th>
                  </tr>
                </thead>
                <tbody>
                  ${po.items.map(i => {
                    const pct = i.quantity > 0 ? Math.round((i.receivedQuantity / i.quantity) * 100) : 0;
                    return `
                      <tr>
                        <td><span class="cell-main">${ui.esc(i.product?.name || '—')}</span>
                          <span class="cell-sub">${ui.esc(i.product?.barcode || '')}</span></td>
                        <td class="num strong">${i.quantity}</td>
                        <td class="num">${ui.money(i.unitPrice)}</td>
                        <td class="num strong">${ui.money(i.quantity * i.unitPrice)}</td>
                        <td class="num">${i.receivedQuantity ?? 0}</td>
                        <td class="num">${i.remainingQuantity ?? i.quantity}</td>
                        <td>
                          <div style="display:flex;align-items:center;gap:8px;">
                            <span class="progress"><span style="width:${pct}%"></span></span>
                            <span class="progress-label">${pct}%</span>
                          </div>
                        </td>
                      </tr>`;
                  }).join('')}
                </tbody>
              </table>
            </div>

            <div class="doc-total">
              <span class="total-label">Total</span>
              <span class="total-value">${ui.money(po.totalAmount)}</span>
            </div>

            ${po.notes ? `
              <div class="doc-notes">
                <span class="doc-label">Notes</span>
                ${ui.esc(po.notes)}
              </div>` : ''}
          </div>
        </div>

        <div class="card card-pad" style="margin-top:18px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">
          <span style="color:var(--text-2);font-size:.88rem;">${ui.badge(po.status)} · ${canReceive ? 'This order is ready to receive goods.' : canApprove ? 'Approve this order to start receiving goods.' : ''}</span>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            ${canEdit ? `<a class="btn btn-secondary" href="#/purchase-orders/${po.id}/edit">Edit</a>` : ''}
            ${canApprove ? `<button class="btn btn-primary" id="po-approve">Approve</button>` : ''}
            ${canReceive ? `<a class="btn btn-primary" href="#/grns/new/${po.id}">Receive Goods</a>` : ''}
            ${canCancel ? `<button class="btn btn-danger" id="po-cancel-btn">Cancel Order</button>` : ''}
          </div>
        </div>

        <div class="card" style="margin-top:18px;">
          <div class="card-pad">
            <h2 class="card-title">Goods received against this order</h2>
            <p class="card-sub">${grns.length === 0 ? 'No GRNs yet — received stock will appear here.' : `${grns.length} GRN(s) created for this order.`}</p>
          </div>
          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr><th>GRN Number</th><th>Received Date</th><th class="num">Total Received</th><th>Status</th><th class="actions">Actions</th></tr>
              </thead>
              <tbody>
                ${grns.map(g => `
                  <tr>
                    <td><span class="cell-main">${ui.esc(g.grnNumber)}</span></td>
                    <td>${ui.date(g.receivedDate)}</td>
                    <td class="num">${g.totalReceivedQuantity} unit(s)</td>
                    <td>${ui.badge(g.status)}</td>
                    <td class="actions"><a class="link-btn" href="#/grns/${g.id}">View</a></td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>`;

      if (container.querySelector('#po-approve')) {
        container.querySelector('#po-approve').addEventListener('click', async (e) => {
          e.target.disabled = true;
          try {
            await API.putNoBody(`/api/purchase-orders/${po.id}/approve`);
            ui.toast('Purchase order approved.');
            PurchaseOrdersView.renderDetail(container, po.id);
          } catch (err) {
            e.target.disabled = false;
            ui.toast(err.message, 'error');
          }
        });
      }

      if (container.querySelector('#po-cancel-btn')) {
        container.querySelector('#po-cancel-btn').addEventListener('click', async (e) => {
          const ok = await ui.confirm({
            title: 'Cancel purchase order',
            message: 'This will mark the order as cancelled and cannot be undone.',
            confirmText: 'Cancel order',
            danger: true,
          });
          if (!ok) return;
          e.target.disabled = true;
          try {
            await API.putNoBody(`/api/purchase-orders/${po.id}/cancel`);
            ui.toast('Purchase order cancelled.');
            PurchaseOrdersView.renderDetail(container, po.id);
          } catch (err) {
            e.target.disabled = false;
            ui.toast(err.message, 'error');
          }
        });
      }
    } catch (err) {
      container.innerHTML = ui.empty('⚠️', 'Could not load purchase order', err.message || 'Unknown error',
        `<a class="btn btn-secondary" href="#/purchase-orders">← Back to list</a>`);
    }
  },
};
