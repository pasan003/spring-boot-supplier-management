package com.bci.productcrud.service;

import com.bci.productcrud.model.Supplier;

import java.util.List;

public interface SupplierService {

    Supplier create(Supplier supplier);

    List<Supplier> findAll();

    List<Supplier> findActive();

    Supplier findById(Long id);

    Supplier update(Long id, Supplier supplier);

    /** Soft delete — keeps historical purchase orders readable. */
    void delete(Long id);
}
