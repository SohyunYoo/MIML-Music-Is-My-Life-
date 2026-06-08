package com.miml.backend.controller

import com.miml.backend.dto.FeedbackResponse
import com.miml.backend.dto.MoodFeedbackRequest
import com.miml.backend.dto.SatisfactionFeedbackRequest
import com.miml.backend.entity.User
import com.miml.backend.service.FeedbackService
import org.springframework.http.ResponseEntity
import org.springframework.security.core.Authentication
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/feedback")
class FeedbackController(
    private val feedbackService: FeedbackService
) {

    @PostMapping("/satisfaction")
    fun satisfactionFeedback(
        @RequestBody request: SatisfactionFeedbackRequest,
        authentication: Authentication
    ): ResponseEntity<FeedbackResponse> {
        val user = authentication.principal as User
        val detail = feedbackService.satisfactionFeedback(user.id!!, request.musicId, request.isLiked)
        val message = if (request.isLiked) "취향 프로필이 이 곡 방향으로 업데이트됐습니다." else "취향 프로필이 이 곡 반대 방향으로 업데이트됐습니다."
        return ResponseEntity.ok(FeedbackResponse(message = message, detail = detail))
    }

    @PostMapping("/mood")
    fun moodFeedback(
        @RequestBody request: MoodFeedbackRequest,
        authentication: Authentication
    ): ResponseEntity<FeedbackResponse> {
        val user = authentication.principal as User
        val detail = feedbackService.moodFeedback(user.id!!, request.musicIds, request.isPositive, request.moodFeatures)
        val message = if (request.isPositive) "음향 수치가 강화됐습니다." else "피드백이 기록됐습니다. 3명 이상 동의 시 음향 수치가 보정됩니다."
        return ResponseEntity.ok(FeedbackResponse(message = message, detail = detail))
    }
}
