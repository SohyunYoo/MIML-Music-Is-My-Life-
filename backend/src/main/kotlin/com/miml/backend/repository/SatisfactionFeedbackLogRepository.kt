package com.miml.backend.repository

import com.miml.backend.entity.SatisfactionFeedbackLog
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository

@Repository
interface SatisfactionFeedbackLogRepository : JpaRepository<SatisfactionFeedbackLog, Long> {
    fun existsByUserIdAndMusicId(userId: Long, musicId: Long): Boolean
}
