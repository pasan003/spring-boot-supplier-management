package com.bci.productcrud.controller;

import com.bci.productcrud.dto.GoodsReceivedNoteRequest;
import com.bci.productcrud.model.GoodsReceivedNote;
import com.bci.productcrud.service.GoodsReceivedNoteService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/grns")
@RequiredArgsConstructor
public class GoodsReceivedNoteController {

    private final GoodsReceivedNoteService grnService;

    @GetMapping
    public List<GoodsReceivedNote> findAll(@RequestParam(required = false) Long poId) {
        return grnService.findAll(poId);
    }

    @GetMapping("/{id}")
    public GoodsReceivedNote findById(@PathVariable Long id) {
        return grnService.findById(id);
    }

    @PostMapping
    public ResponseEntity<GoodsReceivedNote> create(@Valid @RequestBody GoodsReceivedNoteRequest request) {
        GoodsReceivedNote created = grnService.create(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    /** Confirms the receipt: validates, updates product stock and the PO status (transactional). */
    @PutMapping("/{id}/confirm")
    public GoodsReceivedNote confirm(@PathVariable Long id) {
        return grnService.confirm(id);
    }

    @PutMapping("/{id}/cancel")
    public GoodsReceivedNote cancel(@PathVariable Long id) {
        return grnService.cancel(id);
    }
}
