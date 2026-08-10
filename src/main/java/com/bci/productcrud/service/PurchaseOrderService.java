package com.bci.productcrud.service;

import com.bci.productcrud.dto.PurchaseOrderRequest;
import com.bci.productcrud.model.PurchaseOrder;

import java.util.List;

public interface PurchaseOrderService {

    PurchaseOrder create(PurchaseOrderRequest request);

    List<PurchaseOrder> findAll();

    /** POs that can still receive goods (APPROVED or PARTIALLY_RECEIVED). */
    List<PurchaseOrder> findReceivable();

    PurchaseOrder findById(Long id);

    PurchaseOrder update(Long id, PurchaseOrderRequest request);

    PurchaseOrder submit(Long id);

    PurchaseOrder approve(Long id);

    PurchaseOrder cancel(Long id);

    /** Only allowed while the PO is still a DRAFT. */
    void delete(Long id);
}
