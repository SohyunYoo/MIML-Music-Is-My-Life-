package com.miml.backend.controller

import com.miml.backend.dto.SmartRecommendationRequest
import com.miml.backend.dto.SmartRecommendationResponse
import com.miml.backend.entity.User
import com.miml.backend.service.SmartRecommendationService
import org.springframework.security.core.Authentication
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/recommend")
class RecommendationController(
    private val smartRecommendationService: SmartRecommendationService
) {
    @PostMapping("/smart")
    fun recommendSmart(
        @RequestBody request: SmartRecommendationRequest,
        authentication: Authentication
    ): SmartRecommendationResponse {
        val user = authentication.principal as User
        println("🧠 스마트 추천 요청 (uid: ${user.firebaseUid}, profileRatio=${request.profileRatio})")
        return smartRecommendationService.recommend(request, user)
    }
}
