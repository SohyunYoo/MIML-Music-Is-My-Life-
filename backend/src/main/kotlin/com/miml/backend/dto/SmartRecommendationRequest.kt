package com.miml.backend.dto

data class SmartRecommendationRequest(
    val description: String,

    // 0.0 = 현재 분위기 100%, 1.0 = 기존 취향 100% (슬라이드 버튼 값)
    val profileRatio: Double = 0.5,

    val limit: Int = 10
)
