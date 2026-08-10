package com.bci.productcrud.repository;

import com.bci.productcrud.model.GoodsReceivedNote;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;

public interface GoodsReceivedNoteRepository extends JpaRepository<GoodsReceivedNote, Long> {

    List<GoodsReceivedNote> findAllByOrderByIdDesc();

    List<GoodsReceivedNote> findByPurchaseOrderIdOrderByIdDesc(Long purchaseOrderId);

    long countByReceivedDate(LocalDate receivedDate);
}
