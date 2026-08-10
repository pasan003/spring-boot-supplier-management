package com.bci.productcrud.service;

import com.bci.productcrud.dto.GoodsReceivedNoteRequest;
import com.bci.productcrud.model.GoodsReceivedNote;

import java.util.List;

public interface GoodsReceivedNoteService {

    GoodsReceivedNote create(GoodsReceivedNoteRequest request);

    List<GoodsReceivedNote> findAll(Long purchaseOrderId);

    GoodsReceivedNote findById(Long id);

    /** Validates and applies the receipt: updates product stock + PO status, all in one transaction. */
    GoodsReceivedNote confirm(Long id);

    GoodsReceivedNote cancel(Long id);
}
