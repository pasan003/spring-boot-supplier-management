/* Products view — full CRUD + barcode scanner (original functionality, new design). */

const ProductsView = {

  /** Cached list of products, reused by the PO editor. */
  cache: null,

  async loadProducts() {
    if (ProductsView.cache) return ProductsView.cache;
    ProductsView.cache = await API.get('/api/products');
    return ProductsView.cache;
  },

  invalidateCache() {
    ProductsView.cache = null;
  },

  async render(container) {
    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Products</h1>
          <p class="page-sub">Manage stock items — scan a barcode to find a product instantly.</p>
        </div>
      </div>

      <div class="scan-bar">
        <label for="scan-input">Scan barcode:</label>
        <input id="scan-input" type="text" placeholder="Click here, then scan or type a barcode + Enter" autocomplete="off">
        <span id="scan-status" class="scan-status"></span>
      </div>

      <div class="card card-pad">
        <h2 class="card-title" id="form-title">Add product</h2>
        <form id="product-form">
          <input type="hidden" id="product-id">
          <div class="form-grid">
            <div class="form-field">
              <label for="barcode">Barcode *</label>
              <input id="barcode" type="text" required>
            </div>
            <div class="form-field">
              <label for="name">Name *</label>
              <input id="name" type="text" required>
            </div>
            <div class="form-field">
              <label for="description">Description</label>
              <input id="description" type="text">
            </div>
            <div class="form-field">
              <label for="price">Price (Rs.) *</label>
              <input id="price" type="number" step="0.01" min="0" required>
            </div>
            <div class="form-field">
              <label for="quantity">Quantity *</label>
              <input id="quantity" type="number" min="0" required>
            </div>
          </div>
          <div class="form-actions">
            <button type="button" id="cancel-btn" class="btn btn-secondary" hidden>Cancel</button>
            <button type="submit" id="submit-btn" class="btn btn-primary">Save product</button>
          </div>
        </form>
      </div>

      <div class="card">
        <div class="toolbar" style="padding: 16px 16px 0;">
          <div class="search-box">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input id="product-search" type="text" placeholder="Search name, barcode or description...">
          </div>
        </div>
        <div class="table-wrap" id="product-table-wrap">
          <div class="loading-state"><span class="spinner"></span><span>Loading products...</span></div>
        </div>
      </div>`;

    ProductsView.bindScan(container);
    ProductsView.bindForm(container);
    ProductsView.bindSearch(container);
    ProductsView.loadInto(container);

    const scanInput = container.querySelector('#scan-input');
    if (scanInput) scanInput.focus();
  },

  async loadInto(container) {
    const wrap = container.querySelector('#product-table-wrap');
    try {
      const products = await ProductsView.loadProducts();
      ProductsView.renderTable(wrap, products, container.querySelector('#product-search').value);
    } catch (err) {
      wrap.innerHTML = ui.empty('⚠️', 'Could not load products', err.message || 'Unknown error');
    }
  },

  renderTable(wrap, products, filter = '') {
    const q = filter.trim().toLowerCase();
    const filtered = q
      ? products.filter(p =>
          (p.name || '').toLowerCase().includes(q) ||
          (p.barcode || '').toLowerCase().includes(q) ||
          (p.description || '').toLowerCase().includes(q))
      : products;

    if (filtered.length === 0) {
      wrap.innerHTML = q
        ? ui.empty('🔍', 'No matches', `No products match "${filter}".`)
        : ui.empty('📦', 'No products yet', 'Add your first product to start building the catalogue.');
      return;
    }

    wrap.innerHTML = `
      <table class="table">
        <thead>
          <tr>
            <th>Barcode</th><th>Name</th><th>Description</th>
            <th class="num">Price</th><th class="num">Stock</th><th>Created</th><th class="actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.map(p => `
            <tr>
              <td><span class="cell-main">${ui.esc(p.barcode)}</span></td>
              <td><span class="cell-main">${ui.esc(p.name)}</span></td>
              <td class="muted">${ui.esc(p.description || '—')}</td>
              <td class="num strong">${ui.money(p.price)}</td>
              <td class="num">
                <span class="${p.quantity > 0 ? 'strong' : 'muted'}">${p.quantity}</span>
              </td>
              <td class="muted">${ui.date(p.createdAt)}</td>
              <td class="actions">
                <button class="link-btn" data-action="edit" data-id="${p.id}">Edit</button>
                <button class="link-btn danger" data-action="delete" data-id="${p.id}">Delete</button>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>`;

    wrap.querySelector('tbody').addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const id = btn.dataset.id;
      if (btn.dataset.action === 'edit') ProductsView.edit(container, id);
      if (btn.dataset.action === 'delete') ProductsView.remove(container, id);
    });
  },

  bindSearch(container) {
    const input = container.querySelector('#product-search');
    input.addEventListener('input', ui.debounce(() => {
      const wrap = container.querySelector('#product-table-wrap');
      ProductsView.renderTable(wrap, ProductsView.cache || [], input.value);
    }, 200));
  },

  bindScan(container) {
    const scanInput = container.querySelector('#scan-input');
    const scanStatus = container.querySelector('#scan-status');

    // USB barcode scanners act like keyboards: they type the code then press Enter.
    scanInput.addEventListener('keydown', async (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const barcode = scanInput.value.trim();
      scanInput.value = '';
      if (!barcode) return;

      try {
        const product = await API.get(`/api/products/barcode/${encodeURIComponent(barcode)}`);
        ProductsView.fillForm(container, product);
        scanStatus.textContent = `Found: ${product.name}`;
        scanStatus.className = 'scan-status ok';
      } catch (err) {
        ProductsView.resetForm(container);
        container.querySelector('#barcode').value = barcode;
        scanStatus.textContent = 'Not found — fill in the details to add it';
        scanStatus.className = 'scan-status error';
      }
    });
  },

  bindForm(container) {
    const form = container.querySelector('#product-form');
    const cancelBtn = container.querySelector('#cancel-btn');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const idField = container.querySelector('#product-id');
      const payload = {
        barcode: container.querySelector('#barcode').value.trim(),
        name: container.querySelector('#name').value.trim(),
        description: container.querySelector('#description').value.trim(),
        price: parseFloat(container.querySelector('#price').value),
        quantity: parseInt(container.querySelector('#quantity').value, 10),
      };

      if (!payload.barcode || !payload.name) {
        ui.toast('Barcode and name are required.', 'error');
        return;
      }

      try {
        const id = idField.value;
        if (id) {
          await API.put(`/api/products/${id}`, payload);
          ui.toast('Product updated successfully.');
        } else {
          await API.post('/api/products', payload);
          ui.toast('Product created successfully.');
        }
        ProductsView.invalidateCache();
        ProductsView.resetForm(container);
        ProductsView.loadInto(container);
      } catch (err) {
        ui.toast(err.message || 'Unable to save the product.', 'error');
      }
    });

    cancelBtn.addEventListener('click', () => ProductsView.resetForm(container));
  },

  fillForm(container, product) {
    container.querySelector('#product-id').value = product.id;
    container.querySelector('#barcode').value = product.barcode;
    container.querySelector('#name').value = product.name;
    container.querySelector('#description').value = product.description || '';
    container.querySelector('#price').value = product.price;
    container.querySelector('#quantity').value = product.quantity;
    container.querySelector('#form-title').textContent = `Edit product — ${product.name}`;
    container.querySelector('#cancel-btn').hidden = false;
    container.querySelector('#submit-btn').textContent = 'Update product';
    container.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },

  resetForm(container) {
    const form = container.querySelector('#product-form');
    form.reset();
    container.querySelector('#product-id').value = '';
    container.querySelector('#form-title').textContent = 'Add product';
    container.querySelector('#cancel-btn').hidden = true;
    container.querySelector('#submit-btn').textContent = 'Save product';
  },

  async edit(container, id) {
    try {
      const product = await API.get(`/api/products/${id}`);
      ProductsView.fillForm(container, product);
    } catch (err) {
      ui.toast(err.message, 'error');
    }
  },

  async remove(container, id) {
    const ok = await ui.confirm({
      title: 'Delete product',
      message: 'This will permanently delete the product from the catalogue. Continue?',
      confirmText: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      await API.del(`/api/products/${id}`);
      ProductsView.invalidateCache();
      ui.toast('Product deleted.');
      ProductsView.loadInto(container);
    } catch (err) {
      ui.toast(err.message || 'Unable to delete the product.', 'error');
    }
  },
};
