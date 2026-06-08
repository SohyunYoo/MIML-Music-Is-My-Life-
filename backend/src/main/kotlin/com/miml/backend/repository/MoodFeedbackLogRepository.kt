package com.miml.backend.repository

import com.miml.backend.entity.MoodFeedbackLog
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository

@Repository
interface MoodFeedbackLogRepository : JpaRepository<MoodFeedbackLog, Long> {
    fun existsByUserIdAndMusicIdAndMoodContext(userId: Long, musicId: Long, moodContext: String): Boolean
    fun countByMusicIdAndIsPositiveFalseAndAppliedFalse(musicId: Long): Long
    fun findByMusicIdAndIsPositiveFalseAndAppliedFalse(musicId: Long): List<MoodFeedbackLog>
}
