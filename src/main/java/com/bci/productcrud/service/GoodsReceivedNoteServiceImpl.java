package com.bci.productcrud.service;

import com.bci.productcrud.dto.GoodsReceivedNoteItemRequest;
import com.bci.productcrud.dto.GoodsReceivedNoteRequest;
import com.bci.productcrud.exception.GoodsReceivedNoteNotFoundException;
import com.bci.productcrud.exception.GrnValidationException;
import com.bci.productcrud.exception.ProductNotFoundException;
import com.bci.productcrud.exception.PurchaseOrderNotFoundException;
import com.bci.productcrud.model.GoodsReceivedNote;
import com.bci.productcrud.model.GoodsReceivedNoteItem;
import com.bci.productcrud.model.GrnStatus;
import com.bci.productcrud.model.Product;
import com.bci.productcrud.model.PurchaseOrder;
import com.bci.productcrud.model.PurchaseOrderItem;
import com.bci.productcrud.model.PurchaseOrderStatus;
import com.bci.productcrud.repository.GoodsReceivedNoteItemRepository;
import com.bci.productcrud.repository.GoodsReceivedNoteRepository;
import com.bci.productcrud.repository.ProductRepository;
import com.bci.productcrud.repository.PurchaseOrderItemRepository;
import com.bci.productcrud.repository.PurchaseOrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional
public class GoodsReceivedNoteServiceImpl implements GoodsReceivedNoteService {

    private final GoodsReceivedNoteRepository grnRepository;
    private final GoodsReceivedNoteItemRepository grnItemRepository;
    private final PurchaseOrderRepository purchaseOrderRepository;
    private final PurchaseOrderItemRepository purchaseOrderItemRepository;
    private final ProductRepository productRepository;

    @Override
    public GoodsReceivedNote create(GoodsReceivedNoteRequest request) {
        PurchaseOrder po = purchaseOrderRepository.findById(request.purchaseOrderId())
                .orElseThrow(() -> new PurchaseOrderNotFoundException("Purchase order not found with id " + request.purchaseOrderId()));

        if (po.getStatus() != PurchaseOrderStatus.APPROVED && po.getStatus() != PurchaseOrderStatus.PARTIALLY_RECEIVED) {
            throw new GrnValidationException(
                    "Cannot create a GRN for purchase order " + po.getPoNumber() + " (current status: " + po.getStatus() + "). "
                            + "The order must be APPROVED first.");
        }

        GoodsReceivedNote grn = new GoodsReceivedNote();
        grn.setPurchaseOrder(po);
        grn.setReceivedDate(LocalDate.now());
        grn.setReceivedBy(request.receivedBy());
        grn.setNotes(request.notes());
        grn.setStatus(GrnStatus.DRAFT);

        int totalReceived = 0;
        for (GoodsReceivedNoteItemRequest itemReq : request.items()) {
            GoodsReceivedNoteItem item = buildItem(grn, po, itemReq);
            grn.addItem(item);
            totalReceived += item.getReceivedQuantity();
        }
        grn.setTotalReceivedQuantity(totalReceived);

        GoodsReceivedNote saved = grnRepository.save(grn);
        // Numbered number, e.g. GRN-0001 — generated from the DB id so it is always unique.
        saved.setGrnNumber(String.format("GRN-%04d", saved.getId()));
        return grnRepository.save(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public List<GoodsReceivedNote> findAll(Long purchaseOrderId) {
        List<GoodsReceivedNote> grns = purchaseOrderId != null
                ? grnRepository.findByPurchaseOrderIdOrderByIdDesc(purchaseOrderId)
                : grnRepository.findAllByOrderByIdDesc();
        grns.forEach(this::initializeGraph);
        return grns;
    }

    @Override
    @Transactional(readOnly = true)
    public GoodsReceivedNote findById(Long id) {
        GoodsReceivedNote grn = grnRepository.findById(id)
                .orElseThrow(() -> new GoodsReceivedNoteNotFoundException("Goods received note not found with id " + id));
        initializeGraph(grn);
        return grn;
    }

    /** Initializes lazy collections so JSON serialization never depends on open-in-view. */
    private void initializeGraph(GoodsReceivedNote grn) {
        grn.getItems().size();
        if (grn.getPurchaseOrder() != null) {
            grn.getPurchaseOrder().getItems().size();
        }
    }

    @Override
    public GoodsReceivedNote confirm(Long id) {
        GoodsReceivedNote grn = findById(id);

        if (grn.getStatus() == GrnStatus.RECEIVED) {
            throw new GrnValidationException(
                    "GRN " + grn.getGrnNumber() + " is already confirmed — stock has already been updated.");
        }
        if (grn.getStatus() == GrnStatus.CANCELLED) {
            throw new GrnValidationException("A cancelled GRN cannot be confirmed.");
        }

        PurchaseOrder po = grn.getPurchaseOrder();
        if (po.getStatus() == PurchaseOrderStatus.CANCELLED) {
            throw new GrnValidationException("Cannot confirm the GRN — the linked purchase order is cancelled.");
        }

        // Re-validate every line against the CURRENT outstanding quantity (state may have changed since draft).
        boolean hasPositiveQuantity = false;
        for (GoodsReceivedNoteItem grnItem : grn.getItems()) {
            int received = grnItem.getReceivedQuantity();
            if (received > 0) {
                hasPositiveQuantity = true;
            }
            int outstanding = grnItem.getPurchaseOrderItem().getQuantity()
                    - grnItemRepository.sumReceivedQuantityByPurchaseOrderItem(grnItem.getPurchaseOrderItem().getId());
            if (received > outstanding) {
                throw new GrnValidationException(
                        "Cannot receive " + received + " of \"" + grnItem.getProduct().getName() + "\" — "
                                + "only " + outstanding + " unit(s) are still outstanding.");
            }
        }
        if (!hasPositiveQuantity) {
            throw new GrnValidationException("Enter a received quantity greater than 0 for at least one product.");
        }

        // 1) Increase product stock by the received quantities.
        for (GoodsReceivedNoteItem grnItem : grn.getItems()) {
            if (grnItem.getReceivedQuantity() <= 0) {
                continue;
            }
            Product product = productRepository.findById(grnItem.getProduct().getId())
                    .orElseThrow(() -> new ProductNotFoundException("Product not found with id " + grnItem.getProduct().getId()));
            product.setQuantity(product.getQuantity() + grnItem.getReceivedQuantity());
            productRepository.save(product);
        }

        // 2) Mark the GRN as confirmed.
        grn.setStatus(GrnStatus.RECEIVED);
        grnRepository.save(grn);

        // 3) Recompute the PO status from ALL confirmed GRNs (auto-flush makes the current GRN count).
        boolean allFullyReceived = true;
        boolean anyReceived = false;
        for (PurchaseOrderItem poItem : po.getItems()) {
            int alreadyReceived = grnItemRepository.sumReceivedQuantityByPurchaseOrderItem(poItem.getId());
            if (alreadyReceived > 0) {
                anyReceived = true;
            }
            if (alreadyReceived < poItem.getQuantity()) {
                allFullyReceived = false;
            }
        }
        po.setStatus(allFullyReceived ? PurchaseOrderStatus.RECEIVED
                : anyReceived ? PurchaseOrderStatus.PARTIALLY_RECEIVED
                : PurchaseOrderStatus.APPROVED);
        purchaseOrderRepository.save(po);

        return grn;
    }

    @Override
    public GoodsReceivedNote cancel(Long id) {
        GoodsReceivedNote grn = findById(id);
        if (grn.getStatus() != GrnStatus.DRAFT) {
            throw new GrnValidationException(
                    "Only DRAFT goods received notes can be cancelled (current status: " + grn.getStatus() + ")");
        }
        grn.setStatus(GrnStatus.CANCELLED);
        return grnRepository.save(grn);
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    private GoodsReceivedNoteItem buildItem(GoodsReceivedNote grn, PurchaseOrder po, GoodsReceivedNoteItemRequest itemReq) {
        PurchaseOrderItem poItem = purchaseOrderItemRepository.findById(itemReq.purchaseOrderItemId())
                .orElseThrow(() -> new GrnValidationException(
                        "Purchase order item not found with id " + itemReq.purchaseOrderItemId()));

        if (!poItem.getPurchaseOrder().getId().equals(po.getId())) {
            throw new GrnValidationException("Item " + poItem.getId() + " does not belong to purchase order " + po.getPoNumber());
        }

        int received = itemReq.receivedQuantity();
        int outstanding = poItem.getQuantity() - grnItemRepository.sumReceivedQuantityByPurchaseOrderItem(poItem.getId());
        if (received > outstanding) {
            throw new GrnValidationException(
                    "Cannot receive " + received + " of \"" + poItem.getProduct().getName() + "\" — "
                            + "only " + outstanding + " unit(s) are still outstanding (ordered " + poItem.getQuantity()
                            + ", already received " + (poItem.getQuantity() - outstanding) + ").");
        }

        GoodsReceivedNoteItem item = new GoodsReceivedNoteItem();
        item.setPurchaseOrderItem(poItem);
        item.setProduct(poItem.getProduct());
        item.setReceivedQuantity(received);
        return item;
    }
}
