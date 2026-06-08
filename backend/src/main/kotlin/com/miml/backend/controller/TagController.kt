package com.miml.backend.controller

import com.miml.backend.dto.TagGenerationRequest
import com.miml.backend.dto.TagGenerationResponse
import com.miml.backend.service.TagGenerationService
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/tags")
class TagController(
    private val tagGenerationService: TagGenerationService
) {
    @PostMapping("/generate")
    fun generate(@RequestBody request: TagGenerationRequest): TagGenerationResponse =
        tagGenerationService.generate(request)
}
