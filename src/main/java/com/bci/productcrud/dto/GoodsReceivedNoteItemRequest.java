package com.bci.productcrud.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

public record GoodsReceivedNoteItemRequest(
        @NotNull(message = "Purchase order item is required")
        Long purchaseOrderItemId,

        @NotNull(message = "Received quantity is required")
        @PositiveOrZero(message = "Received quantity cannot be negative")
        Integer receivedQuantity
) {
}
