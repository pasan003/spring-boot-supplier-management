package com.bci.productcrud.service;

import com.bci.productcrud.dto.PurchaseOrderItemRequest;
import com.bci.productcrud.dto.PurchaseOrderRequest;
import com.bci.productcrud.exception.InvalidPurchaseOrderStateException;
import com.bci.productcrud.exception.ProductNotFoundException;
import com.bci.productcrud.exception.PurchaseOrderNotFoundException;
import com.bci.productcrud.exception.SupplierNotFoundException;
import com.bci.productcrud.model.Product;
import com.bci.productcrud.model.PurchaseOrder;
import com.bci.productcrud.model.PurchaseOrderItem;
import com.bci.productcrud.model.PurchaseOrderStatus;
import com.bci.productcrud.model.Supplier;
import com.bci.productcrud.repository.GoodsReceivedNoteItemRepository;
import com.bci.productcrud.repository.ProductRepository;
import com.bci.productcrud.repository.PurchaseOrderRepository;
import com.bci.productcrud.repository.SupplierRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional
public class PurchaseOrderServiceImpl implements PurchaseOrderService {

    private final PurchaseOrderRepository purchaseOrderRepository;
    private final SupplierRepository supplierRepository;
    private final ProductRepository productRepository;
    private final GoodsReceivedNoteItemRepository grnItemRepository;

    @Override
    public PurchaseOrder create(PurchaseOrderRequest request) {
        Supplier supplier = supplierRepository.findById(request.supplierId())
                .orElseThrow(() -> new SupplierNotFoundException("Supplier not found with id " + request.supplierId()));

        PurchaseOrder po = new PurchaseOrder();
        po.setSupplier(supplier);
        po.setOrderDate(request.orderDate() != null ? request.orderDate() : LocalDate.now());
        po.setExpectedDeliveryDate(request.expectedDeliveryDate());
        po.setNotes(request.notes());
        po.setStatus(PurchaseOrderStatus.DRAFT);
        validateDates(po);

        for (PurchaseOrderItemRequest itemReq : request.items()) {
            po.addItem(buildItem(itemReq));
        }
        po.setTotalAmount(computeTotal(po));

        PurchaseOrder saved = purchaseOrderRepository.save(po);
        // Numbered number, e.g. PO-0001 — generated from the DB id so it is always unique.
        saved.setPoNumber(String.format("PO-%04d", saved.getId()));
        PurchaseOrder result = purchaseOrderRepository.save(saved);
        fillReceivingInfo(result);
        return result;
    }

    @Override
    @Transactional(readOnly = true)
    public List<PurchaseOrder> findAll() {
        List<PurchaseOrder> orders = purchaseOrderRepository.findAllByOrderByIdDesc();
        orders.forEach(this::fillReceivingInfo);
        return orders;
    }

    @Override
    @Transactional(readOnly = true)
    public List<PurchaseOrder> findReceivable() {
        List<PurchaseOrder> orders = purchaseOrderRepository.findByStatusInOrderByIdDesc(
                List.of(PurchaseOrderStatus.APPROVED, PurchaseOrderStatus.PARTIALLY_RECEIVED));
        orders.forEach(this::fillReceivingInfo);
        return orders;
    }

    @Override
    @Transactional(readOnly = true)
    public PurchaseOrder findById(Long id) {
        PurchaseOrder po = purchaseOrderRepository.findById(id)
                .orElseThrow(() -> new PurchaseOrderNotFoundException("Purchase order not found with id " + id));
        fillReceivingInfo(po);
        return po;
    }

    @Override
    public PurchaseOrder update(Long id, PurchaseOrderRequest request) {
        PurchaseOrder po = findById(id);
        if (po.getStatus() != PurchaseOrderStatus.DRAFT && po.getStatus() != PurchaseOrderStatus.PENDING) {
            throw new InvalidPurchaseOrderStateException(
                    "Only DRAFT or PENDING purchase orders can be edited (current status: " + po.getStatus() + ")");
        }

        Supplier supplier = supplierRepository.findById(request.supplierId())
                .orElseThrow(() -> new SupplierNotFoundException("Supplier not found with id " + request.supplierId()));

        po.setSupplier(supplier);
        po.setOrderDate(request.orderDate() != null ? request.orderDate() : LocalDate.now());
        po.setExpectedDeliveryDate(request.expectedDeliveryDate());
        po.setNotes(request.notes());
        validateDates(po);

        po.getItems().clear();
        for (PurchaseOrderItemRequest itemReq : request.items()) {
            po.addItem(buildItem(itemReq));
        }
        po.setTotalAmount(computeTotal(po));
        PurchaseOrder result = purchaseOrderRepository.save(po);
        fillReceivingInfo(result);
        return result;
    }

    @Override
    public PurchaseOrder submit(Long id) {
        PurchaseOrder po = findById(id);
        transition(po, PurchaseOrderStatus.DRAFT, PurchaseOrderStatus.PENDING, "submit");
        return purchaseOrderRepository.save(po);
    }

    @Override
    public PurchaseOrder approve(Long id) {
        PurchaseOrder po = findById(id);
        if (po.getStatus() != PurchaseOrderStatus.DRAFT && po.getStatus() != PurchaseOrderStatus.PENDING) {
            throw new InvalidPurchaseOrderStateException(
                    "Only DRAFT or PENDING purchase orders can be approved (current status: " + po.getStatus() + ")");
        }
        po.setStatus(PurchaseOrderStatus.APPROVED);
        return purchaseOrderRepository.save(po);
    }

    @Override
    public PurchaseOrder cancel(Long id) {
        PurchaseOrder po = findById(id);
        if (po.getStatus() == PurchaseOrderStatus.CANCELLED) {
            throw new InvalidPurchaseOrderStateException("This purchase order is already cancelled");
        }
        if (po.getStatus() == PurchaseOrderStatus.RECEIVED || po.getStatus() == PurchaseOrderStatus.PARTIALLY_RECEIVED) {
            throw new InvalidPurchaseOrderStateException(
                    "A purchase order that has already received goods cannot be cancelled (current status: " + po.getStatus() + ")");
        }
        po.setStatus(PurchaseOrderStatus.CANCELLED);
        return purchaseOrderRepository.save(po);
    }

    @Override
    public void delete(Long id) {
        PurchaseOrder po = findById(id);
        if (po.getStatus() != PurchaseOrderStatus.DRAFT) {
            throw new InvalidPurchaseOrderStateException(
                    "Only DRAFT purchase orders can be deleted (current status: " + po.getStatus() + "). Cancel it instead.");
        }
        purchaseOrderRepository.delete(po);
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    private PurchaseOrderItem buildItem(PurchaseOrderItemRequest itemReq) {
        Product product = productRepository.findById(itemReq.productId())
                .orElseThrow(() -> new ProductNotFoundException("Product not found with id " + itemReq.productId()));

        PurchaseOrderItem item = new PurchaseOrderItem();
        item.setProduct(product);
        item.setQuantity(itemReq.quantity());
        item.setUnitPrice(itemReq.unitPrice() != null ? itemReq.unitPrice() : product.getPrice());
        return item;
    }

    private Double computeTotal(PurchaseOrder po) {
        return po.getItems().stream()
                .mapToDouble(i -> i.getQuantity() * i.getUnitPrice())
                .sum();
    }

    private void validateDates(PurchaseOrder po) {
        if (po.getExpectedDeliveryDate() != null && po.getExpectedDeliveryDate().isBefore(po.getOrderDate())) {
            throw new InvalidPurchaseOrderStateException(
                    "Expected delivery date cannot be before the order date.");
        }
    }

    private void transition(PurchaseOrder po, PurchaseOrderStatus from, PurchaseOrderStatus to, String action) {
        if (po.getStatus() != from) {
            throw new InvalidPurchaseOrderStateException(
                    "Cannot " + action + " a purchase order in status " + po.getStatus() + " (expected " + from + ")");
        }
        po.setStatus(to);
    }

    /** Populates the transient received/remaining fields on every item (drives PO & GRN UIs). */
    private void fillReceivingInfo(PurchaseOrder po) {
        for (PurchaseOrderItem item : po.getItems()) {
            int received = grnItemRepository.sumReceivedQuantityByPurchaseOrderItem(item.getId());
            item.setReceivedQuantity(received);
            item.setRemainingQuantity(Math.max(0, item.getQuantity() - received));
        }
    }
}
