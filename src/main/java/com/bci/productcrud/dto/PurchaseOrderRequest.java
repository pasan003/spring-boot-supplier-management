package com.bci.productcrud.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;
import java.util.List;

public record PurchaseOrderRequest(
        @NotNull(message = "Supplier is required")
        Long supplierId,

        LocalDate orderDate,

        LocalDate expectedDeliveryDate,

        String notes,

        @Valid
        @NotEmpty(message = "A purchase order must contain at least one product")
        List<PurchaseOrderItemRequest> items
) {
}
