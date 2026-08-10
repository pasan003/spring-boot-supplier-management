package com.bci.productcrud.repository;

import com.bci.productcrud.model.GoodsReceivedNoteItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface GoodsReceivedNoteItemRepository extends JpaRepository<GoodsReceivedNoteItem, Long> {

    /**
     * Total quantity received so far for a purchase order item, across all CONFIRMED (RECEIVED) GRNs.
     * Only confirmed GRNs count so a DRAFT GRN never inflates receiving progress.
     */
    @Query("SELECT COALESCE(SUM(g.receivedQuantity), 0) FROM GoodsReceivedNoteItem g " +
            "WHERE g.purchaseOrderItem.id = :poItemId " +
            "AND g.goodsReceivedNote.status = com.bci.productcrud.model.GrnStatus.RECEIVED")
    int sumReceivedQuantityByPurchaseOrderItem(@Param("poItemId") Long poItemId);
}
