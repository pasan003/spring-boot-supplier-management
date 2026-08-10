/* Suppliers view — CRUD with modal form; deletion is a soft "deactivate". */

const SuppliersView = {

  cache: null,

  async loadSuppliers() {
    if (SuppliersView.cache) return SuppliersView.cache;
    SuppliersView.cache = await API.get('/api/suppliers');
    return SuppliersView.cache;
  },

  invalidateCache() {
    SuppliersView.cache = null;
  },

  async render(container) {
    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Suppliers</h1>
          <p class="page-sub">Companies you order products from. Used by purchase orders and GRNs.</p>
        </div>
        <div class="page-actions">
          <button class="btn btn-primary" id="add-supplier-btn">+ Add Supplier</button>
        </div>
      </div>
      <div class="card">
        <div class="table-wrap" id="supplier-table-wrap">
          <div class="loading-state"><span class="spinner"></span><span>Loading suppliers...</span></div>
        </div>
      </div>`;

    container.querySelector('#add-supplier-btn').addEventListener('click', () => SuppliersView.openForm(container));
    SuppliersView.loadInto(container);
  },

  async loadInto(container) {
    const wrap = container.querySelector('#supplier-table-wrap');
    try {
      const suppliers = await SuppliersView.loadSuppliers();
      SuppliersView.renderTable(wrap, suppliers);
    } catch (err) {
      wrap.innerHTML = ui.empty('⚠️', 'Could not load suppliers', err.message || 'Unknown error');
    }
  },

  renderTable(wrap, suppliers) {
    if (suppliers.length === 0) {
      wrap.innerHTML = ui.empty(
        '🏢', 'No suppliers yet',
        'Add your first supplier so you can create purchase orders.',
        `<button class="btn btn-primary" data-action="add">+ Add Supplier</button>`);
      wrap.querySelector('[data-action="add"]').addEventListener('click', () => {
        SuppliersView.openForm(wrap.closest('.view-container'));
      });
      return;
    }

    wrap.innerHTML = `
      <table class="table">
        <thead>
          <tr>
            <th>Code</th><th>Name</th><th>Contact</th><th>Email</th><th>Address</th>
            <th>Status</th><th>Since</th><th class="actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${suppliers.map(s => `
            <tr>
              <td><span class="cell-main">${ui.esc(s.code)}</span></td>
              <td><span class="cell-main">${ui.esc(s.name)}</span></td>
              <td>${ui.esc(s.contactNumber || '—')}</td>
              <td>${ui.esc(s.email || '—')}</td>
              <td class="muted">${ui.esc(s.address || '—')}</td>
              <td>${s.active ? ui.badge('Active') : ui.badge('Inactive')}</td>
              <td class="muted">${ui.date(s.createdAt)}</td>
              <td class="actions">
                <button class="link-btn" data-action="edit" data-id="${s.id}">Edit</button>
                <button class="link-btn ${s.active ? 'danger' : 'success'}" data-action="delete" data-id="${s.id}">
                  ${s.active ? 'Deactivate' : 'Reactivate'}
                </button>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>`;

    wrap.querySelector('tbody').addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const id = btn.dataset.id;
      if (btn.dataset.action === 'edit') SuppliersView.openForm(containerOf(wrap), id);
      if (btn.dataset.action === 'delete') SuppliersView.toggleActive(containerOf(wrap), id, btn.textContent.trim() === 'Deactivate');
    });
  },

  openForm(container, id) {
    const isEdit = !!id;
    let supplier = { name: '', contactNumber: '', email: '', address: '', active: true };

    const open = (s) => {
      const modalEl = ui.openModal({
        title: isEdit ? `Edit supplier ${s.code}` : 'Add supplier',
        bodyHtml: `
          <div class="form-grid">
            <div class="form-field">
              <label for="s-name">Name *</label>
              <input id="s-name" type="text" value="${ui.esc(s.name)}" required>
            </div>
            <div class="form-field">
              <label for="s-contact">Contact number</label>
              <input id="s-contact" type="tel" value="${ui.esc(s.contactNumber || '')}">
            </div>
            <div class="form-field">
              <label for="s-email">Email</label>
              <input id="s-email" type="email" value="${ui.esc(s.email || '')}">
            </div>
            <div class="form-field" style="grid-column:1/-1;">
              <label for="s-address">Address</label>
              <input id="s-address" type="text" value="${ui.esc(s.address || '')}">
            </div>
            <div class="form-field">
              <label for="s-active">Status</label>
              <select id="s-active">
                <option value="true" ${s.active !== false ? 'selected' : ''}>Active</option>
                <option value="false" ${s.active === false ? 'selected' : ''}>Inactive</option>
              </select>
            </div>
          </div>`,
        footerHtml: `
          <button class="btn btn-secondary" data-modal-cancel>Cancel</button>
          <button class="btn btn-primary" data-modal-save>${isEdit ? 'Save changes' : 'Add supplier'}</button>`,
      });

      modalEl.querySelector('[data-modal-cancel]').addEventListener('click', () => ui.closeModal());

      modalEl.querySelector('[data-modal-save]').addEventListener('click', async () => {
        const payload = {
          name: modalEl.querySelector('#s-name').value.trim(),
          contactNumber: modalEl.querySelector('#s-contact').value.trim(),
          email: modalEl.querySelector('#s-email').value.trim(),
          address: modalEl.querySelector('#s-address').value.trim(),
          active: modalEl.querySelector('#s-active').value === 'true',
        };
        if (!payload.name) {
          ui.toast('Supplier name is required.', 'error');
          return;
        }
        try {
          if (isEdit) {
            await API.put(`/api/suppliers/${id}`, payload);
            ui.toast('Supplier updated successfully.');
          } else {
            await API.post('/api/suppliers', payload);
            ui.toast('Supplier created successfully.');
          }
          ui.closeModal();
          SuppliersView.invalidateCache();
          SuppliersView.loadInto(container);
        } catch (err) {
          ui.toast(err.message || 'Unable to save the supplier.', 'error');
        }
      });
    };

    if (isEdit) {
      API.get(`/api/suppliers/${id}`).then(open).catch((err) => ui.toast(err.message, 'error'));
    } else {
      open(supplier);
    }
  },

  async toggleActive(container, id, deactivating) {
    const ok = await ui.confirm({
      title: deactivating ? 'Deactivate supplier' : 'Reactivate supplier',
      message: deactivating
        ? 'The supplier will be hidden from new purchase orders but historical records are kept.'
        : 'This supplier will be available for new purchase orders again.',
      confirmText: deactivating ? 'Deactivate' : 'Reactivate',
      danger: deactivating,
    });
    if (!ok) return;
    try {
      const current = await API.get(`/api/suppliers/${id}`);
      current.active = !deactivating;
      await API.put(`/api/suppliers/${id}`, current);
      ui.toast(deactivating ? 'Supplier deactivated.' : 'Supplier reactivated.');
      SuppliersView.invalidateCache();
      SuppliersView.loadInto(container);
    } catch (err) {
      ui.toast(err.message || 'Unable to update the supplier.', 'error');
    }
  },
};

function containerOf(wrap) {
  return wrap.closest('.view-container');
}
