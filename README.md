# Supermarket Management System — Spring Boot (MVC)

A Spring Boot 3 application demonstrating a classic **MVC / layered architecture**:

```
View (browser: HTML + CSS + JS)
        |  JSON over HTTP
        v
Controller  (@RestController — HTTP in/out only, no business logic)
        |
     Service   (business rules, transactions)
        |
   Repository  (JpaRepository — DB access, no hand-written SQL)
        |
     Database  (H2 in-memory, PostgreSQL-compatible mode)
```

Modules:

| Module | Description |
|---|---|
| **Products** | Existing catalogue CRUD with barcode-scanner-friendly search |
| **Suppliers** | Companies you order from (required by PO/GRN) |
| **Purchase Orders (PO)** | Orders placed with a supplier for stock |
| **Goods Received Notes (GRN)** | Records of stock actually received — confirms update product stock |

Business flow:

```
Supplier → Purchase Order → Supplier delivers → GRN → Product stock updated
```

---

## 1. Prerequisites

- **Java 17+** — install [Eclipse Temurin JDK 17](https://adoptium.net/temurin/releases/?version=17) (or newer).
- **Maven 3.6+** — download from [maven.apache.org](https://maven.apache.org/download.cgi) and add `bin` to `PATH`.

Verify:

```powershell
java -version
mvn -v
```

## 2. Database configuration

The app runs on an **embedded H2 database** (no setup required). Configuration lives in
[`src/main/resources/application.properties`](src/main/resources/application.properties):

```
spring.datasource.url=jdbc:h2:mem:productdb;DB_CLOSE_DELAY=-1;MODE=PostgreSQL
spring.jpa.hibernate.ddl-auto=update      # tables are created/updated automatically
spring.h2.console.enabled=true            # web console at /h2-console
server.port=8081
```

`ddl-auto=update` preserves existing data — Hibernate only adds the new PO/GRN/supplier tables.

## 3. Run it

```powershell
mvn spring-boot:run
```

Open **http://localhost:8081** — you will see the management dashboard.

## 4. MVC architecture

```
src/main/java/com/bci/productcrud/
├── controller/           @RestController — HTTP only, no business logic
│   ├── ProductController.java
│   ├── SupplierController.java
│   ├── PurchaseOrderController.java
│   └── GoodsReceivedNoteController.java
├── service/              business rules + @Transactional
│   ├── ProductService / ProductServiceImpl
│   ├── SupplierService / SupplierServiceImpl
│   ├── PurchaseOrderService / PurchaseOrderServiceImpl
│   └── GoodsReceivedNoteService / GoodsReceivedNoteServiceImpl
├── repository/           JpaRepository interfaces (DB access)
│   ├── ProductRepository.java
│   ├── SupplierRepository.java
│   ├── PurchaseOrderRepository.java
│   ├── PurchaseOrderItemRepository.java
│   ├── GoodsReceivedNoteRepository.java
│   └── GoodsReceivedNoteItemRepository.java
├── model/                JPA entities
│   ├── Product.java
│   ├── Supplier.java
│   ├── PurchaseOrder.java / PurchaseOrderItem.java / PurchaseOrderStatus.java
│   └── GoodsReceivedNote.java / GoodsReceivedNoteItem.java / GrnStatus.java
├── dto/                  request bodies (validation) — no SQL, no business logic
├── exception/            domain exceptions + @RestControllerAdvice
src/main/resources/static/   the View: index.html + style.css + js modules
```

Rules followed:

- Controllers never contain business or database logic.
- All business rules (status transitions, over-receiving checks, stock updates) live in the **service layer**.
- Database access only through **repositories** — no SQL written by hand.
- The frontend (`static/`) is the **View**; it calls the REST API and never touches the database.

## 5. Entities & relationships

```
suppliers ─┬< purchase_orders ─┬< purchase_order_items ─> products
           │      (PO 1—* items)   (item 1—1 product)
           └< goods_received_notes ─┬< goods_received_note_items
                        (GRN 1—* items)
                        (GRN *—1 PO)   (item *—1 PO item, *—1 product)
```

- **Supplier** — code, name, contact, email, address, active flag.
- **PurchaseOrder** — PO number, supplier, order date, expected delivery, status, total, notes, items.
- **PurchaseOrderItem** — product, quantity, unit price (price at order time).
- **GoodsReceivedNote** — GRN number, PO, received date, received by, status, total received qty, notes, items.
- **GoodsReceivedNoteItem** — the PO item being received, product, received quantity.

One PO → many GRNs, so a PO can be received across several deliveries.

## 6. API endpoints

### Products (unchanged)
| Method | Path | Description |
|---|---|---|
| GET | `/api/products` | List products |
| GET | `/api/products/{id}` | Get a product |
| GET | `/api/products/barcode/{barcode}` | Find by barcode (scanner) |
| POST | `/api/products` | Create a product |
| PUT | `/api/products/{id}` | Update a product |
| DELETE | `/api/products/{id}` | Delete a product |

### Suppliers
| Method | Path | Description |
|---|---|---|
| GET | `/api/suppliers` | List suppliers |
| GET | `/api/suppliers/active` | Active suppliers (dropdowns) |
| GET | `/api/suppliers/{id}` | Get a supplier |
| POST | `/api/suppliers` | Create (code auto-generated, e.g. `SUP-0001`) |
| PUT | `/api/suppliers/{id}` | Update |
| DELETE | `/api/suppliers/{id}` | Soft delete (deactivates; history kept) |

### Purchase Orders
| Method | Path | Description |
|---|---|---|
| GET | `/api/purchase-orders` | List (items include received/remaining progress) |
| GET | `/api/purchase-orders/receivable` | POs that can still receive goods (GRN wizard) |
| GET | `/api/purchase-orders/{id}` | PO detail |
| POST | `/api/purchase-orders` | Create (number auto-generated, e.g. `PO-0001`) |
| PUT | `/api/purchase-orders/{id}` | Edit (only DRAFT/PENDING) |
| PUT | `/api/purchase-orders/{id}/submit` | DRAFT → PENDING |
| PUT | `/api/purchase-orders/{id}/approve` | DRAFT/PENDING → APPROVED |
| PUT | `/api/purchase-orders/{id}/cancel` | Cancel (unless goods were received) |
| DELETE | `/api/purchase-orders/{id}` | Delete (DRAFT only — prefer cancel) |

### Goods Received Notes
| Method | Path | Description |
|---|---|---|
| GET | `/api/grns` | List (`?poId=` filters by PO) |
| GET | `/api/grns/{id}` | GRN detail |
| POST | `/api/grns` | Create a DRAFT GRN (validates outstanding qty) |
| PUT | `/api/grns/{id}/confirm` | Confirm — updates stock + PO status (transactional) |
| PUT | `/api/grns/{id}/cancel` | Cancel a DRAFT GRN |

Example PO create body:

```json
{
  "supplierId": 1,
  "orderDate": "2026-08-10",
  "expectedDeliveryDate": "2026-08-15",
  "notes": "Deliver to back entrance",
  "items": [
    { "productId": 1, "quantity": 20, "unitPrice": 250.00 },
    { "productId": 2, "quantity": 30, "unitPrice": 180.00 }
  ]
}
```

Example GRN create body (partial receiving supported):

```json
{
  "purchaseOrderId": 1,
  "receivedBy": "Kasun",
  "notes": "",
  "items": [
    { "purchaseOrderItemId": 1, "receivedQuantity": 20 },
    { "purchaseOrderItemId": 2, "receivedQuantity": 25 }
  ]
}
```

## 7. Purchase Order workflow

1. Create a PO — status **DRAFT**.
2. **Submit** → **PENDING** (optional step).
3. **Approve** → **APPROVED** (required before receiving goods).
4. Goods arrive → create a GRN against the PO.
5. As GRNs are confirmed the PO moves to **PARTIALLY_RECEIVED**, then **RECEIVED** once every item is fully received.
6. A PO can be **CANCELLED** while DRAFT/PENDING/APPROVED; it cannot be cancelled after receiving started, and finished/cancelled orders cannot be edited.

## 8. GRN workflow & inventory update

```
Select an APPROVED PO → review ordered items → enter received quantities → Confirm Receipt
```

**Partial receiving:** ordered 100, received 60 → 40 stays outstanding; more GRNs can be created until the PO is fully received.

**Stock update** (`GoodsReceivedNoteServiceImpl.confirm`, one `@Transactional` unit):

1. Re-validates every line against the **current** outstanding quantity (rejects over-receiving with a friendly message).
2. Increases `Product.quantity` by the received quantity for each line.
3. Marks the GRN **RECEIVED**.
4. Recomputes the PO status from all confirmed GRNs.

Safety:

- Confirming the **same GRN twice is rejected** — stock can never be double-counted.
- If anything fails, the whole transaction rolls back (no half-updated database).
- Only **RECEIVED** GRNs count toward receiving progress.

## 9. Frontend (View)

Single-page app in `src/main/resources/static/`:

- `index.html` — sidebar shell (Dashboard / Products / Suppliers / Purchase Orders / Goods Received)
- `style.css` — professional design system (cards, badges, tables, toasts, dialogs, responsive)
- `api.js` — fetch wrapper (consistent error messages, no raw exceptions shown)
- `ui.js` — formatters, status badges, toasts, confirm dialogs, loading/empty states
- `products.js` — product CRUD + barcode scanner
- `suppliers.js` — supplier CRUD
- `purchaseOrders.js` — PO list (summary cards, search/filters), order form (live totals), document-style detail
- `grns.js` — GRN list, step wizard, document-style detail with confirm
- `app.js` — hash router + dashboard

The UI includes loading states, empty states, success/error toasts, confirmation dialogs,
status badges, hover/focus states, and a responsive layout (mobile tables scroll horizontally).

## 10. Testing the full workflow

With the app running, try the end-to-end flow in the browser (also see section 11 for API checks):

1. Add a supplier (Suppliers → Add Supplier).
2. Add products (Products → Add Product).
3. Create a PO with several items — watch the totals calculate live.
4. Approve the PO.
5. Create a GRN from the PO and receive a **partial** quantity.
6. Check the product's stock — it increased by the received quantity.
7. Receive the remaining quantity in a second GRN — the PO becomes **RECEIVED**.
8. Try receiving more than the outstanding quantity — it is rejected.
9. Try confirming the same GRN twice — rejected, no double stock update.
10. Edit/cancel checks: finished orders cannot be edited; partially received orders cannot be cancelled.
11. Existing product CRUD and barcode scan still work.

## 11. Quick API smoke test

```powershell
# Supplier + product
curl -X POST localhost:8081/api/suppliers -H "Content-Type: application/json" -d '{"name":"ABC Suppliers","contactNumber":"077-1234567"}'
curl -X POST localhost:8081/api/products   -H "Content-Type: application/json" -d '{"barcode":"8901234567890","name":"Rice","price":250,"quantity":50}'

# PO
curl -X POST localhost:8081/api/purchase-orders -H "Content-Type: application/json" -d '{"supplierId":1,"items":[{"productId":1,"quantity":20}]}'
curl -X PUT  localhost:8081/api/purchase-orders/1/approve

# GRN: receive 20 of the 20 ordered
curl -X POST localhost:8081/api/grns -H "Content-Type: application/json" -d '{"purchaseOrderId":1,"items":[{"purchaseOrderItemId":1,"receivedQuantity":20}]}'
curl -X PUT  localhost:8081/api/grns/1/confirm

# Over-receive -> 400 with a clear message; duplicate confirm -> 400 "already confirmed"
curl -X POST localhost:8081/api/grns -H "Content-Type: application/json" -d '{"purchaseOrderId":1,"items":[{"purchaseOrderItemId":1,"receivedQuantity":99}]}'
```

Verify stock: `GET /api/products/1` should show `quantity` increased.
