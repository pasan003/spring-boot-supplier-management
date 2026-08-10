package com.bci.productcrud.controller;

import com.bci.productcrud.dto.PurchaseOrderRequest;
import com.bci.productcrud.model.PurchaseOrder;
import com.bci.productcrud.service.PurchaseOrderService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/purchase-orders")
@RequiredArgsConstructor
public class PurchaseOrderController {

    private final PurchaseOrderService purchaseOrderService;

    @GetMapping
    public List<PurchaseOrder> findAll() {
        return purchaseOrderService.findAll();
    }

    /** POs that can still receive goods (used by the GRN wizard). */
    @GetMapping("/receivable")
    public List<PurchaseOrder> findReceivable() {
        return purchaseOrderService.findReceivable();
    }

    @GetMapping("/{id}")
    public PurchaseOrder findById(@PathVariable Long id) {
        return purchaseOrderService.findById(id);
    }

    @PostMapping
    public ResponseEntity<PurchaseOrder> create(@Valid @RequestBody PurchaseOrderRequest request) {
        PurchaseOrder created = purchaseOrderService.create(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PutMapping("/{id}")
    public PurchaseOrder update(@PathVariable Long id, @Valid @RequestBody PurchaseOrderRequest request) {
        return purchaseOrderService.update(id, request);
    }

    @PutMapping("/{id}/submit")
    public PurchaseOrder submit(@PathVariable Long id) {
        return purchaseOrderService.submit(id);
    }

    @PutMapping("/{id}/approve")
    public PurchaseOrder approve(@PathVariable Long id) {
        return purchaseOrderService.approve(id);
    }

    @PutMapping("/{id}/cancel")
    public PurchaseOrder cancel(@PathVariable Long id) {
        return purchaseOrderService.cancel(id);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        purchaseOrderService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
