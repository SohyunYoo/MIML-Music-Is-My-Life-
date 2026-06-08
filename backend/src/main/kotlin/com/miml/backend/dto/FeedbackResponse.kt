package com.miml.backend.dto

data class FeedbackResponse(
    val message: String,
    val detail: Map<String, Any> = emptyMap()
)
