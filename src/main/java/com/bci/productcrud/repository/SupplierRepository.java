package com.bci.productcrud.repository;

import com.bci.productcrud.model.Supplier;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SupplierRepository extends JpaRepository<Supplier, Long> {

    boolean existsByCode(String code);

    List<Supplier> findAllByOrderByIdDesc();

    List<Supplier> findByActiveTrueOrderByNameAsc();
}
