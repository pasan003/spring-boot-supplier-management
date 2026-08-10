package com.bci.productcrud.exception;

/** Thrown when a GRN violates business rules (over-receiving, double confirmation, bad quantities...). */
public class GrnValidationException extends RuntimeException {

    public GrnValidationException(String message) {
        super(message);
    }
}
