package com.miml.backend.dto

data class SatisfactionFeedbackRequest(
    val musicId: Long,
    val isLiked: Boolean
)
