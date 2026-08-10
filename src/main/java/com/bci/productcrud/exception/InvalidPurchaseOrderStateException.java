package com.bci.productcrud.exception;

/** Thrown when a purchase order cannot move to the requested status, or is edited when not editable. */
public class InvalidPurchaseOrderStateException extends RuntimeException {

    public InvalidPurchaseOrderStateException(String message) {
        super(message);
    }
}
