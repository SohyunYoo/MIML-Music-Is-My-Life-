package com.miml.backend.dto

data class SmartRecommendationResponse(
    val totalCandidates: Int,
    val returnedCount: Int,
    val recommendations: List<RecommendedTrack>,
    val moodFeatures: MoodFeatures,
    val message: String = ""
)
