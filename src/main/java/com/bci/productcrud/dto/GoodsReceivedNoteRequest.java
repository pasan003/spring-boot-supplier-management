package com.bci.productcrud.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.util.List;

public record GoodsReceivedNoteRequest(
        @NotNull(message = "A purchase order is required")
        Long purchaseOrderId,

        String receivedBy,

        String notes,

        @Valid
        @NotEmpty(message = "A GRN must contain at least one item")
        List<GoodsReceivedNoteItemRequest> items
) {
}
