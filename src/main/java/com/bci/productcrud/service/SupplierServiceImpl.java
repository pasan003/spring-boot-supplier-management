package com.bci.productcrud.service;

import com.bci.productcrud.exception.SupplierNotFoundException;
import com.bci.productcrud.model.Supplier;
import com.bci.productcrud.repository.SupplierRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional
public class SupplierServiceImpl implements SupplierService {

    private final SupplierRepository supplierRepository;

    @Override
    public Supplier create(Supplier supplier) {
        supplier.setId(null);
        Supplier saved = supplierRepository.save(supplier);
        // Numbered code, e.g. SUP-0001 — generated from the DB id so it is always unique.
        saved.setCode(String.format("SUP-%04d", saved.getId()));
        return supplierRepository.save(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public List<Supplier> findAll() {
        return supplierRepository.findAllByOrderByIdDesc();
    }

    @Override
    @Transactional(readOnly = true)
    public List<Supplier> findActive() {
        return supplierRepository.findByActiveTrueOrderByNameAsc();
    }

    @Override
    @Transactional(readOnly = true)
    public Supplier findById(Long id) {
        return supplierRepository.findById(id)
                .orElseThrow(() -> new SupplierNotFoundException("Supplier not found with id " + id));
    }

    @Override
    public Supplier update(Long id, Supplier request) {
        Supplier supplier = findById(id);
        supplier.setName(request.getName());
        supplier.setContactNumber(request.getContactNumber());
        supplier.setEmail(request.getEmail());
        supplier.setAddress(request.getAddress());
        if (request.getActive() != null) {
            supplier.setActive(request.getActive());
        }
        return supplierRepository.save(supplier);
    }

    @Override
    public void delete(Long id) {
        Supplier supplier = findById(id);
        supplier.setActive(false);
        supplierRepository.save(supplier);
    }
}
