package com.miml.backend.dto

data class MoodFeedbackRequest(
    val musicIds: List<Long>,
    val isPositive: Boolean,
    val moodFeatures: MoodFeatures
)
