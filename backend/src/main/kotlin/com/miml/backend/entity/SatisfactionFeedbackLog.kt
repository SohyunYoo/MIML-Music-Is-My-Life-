package com.miml.backend.entity

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.LocalDateTime

@Entity
@Table(name = "satisfaction_feedback_log")
class SatisfactionFeedbackLog(

    @Column(name = "user_id", nullable = false)
    val userId: Long,

    @Column(name = "music_id", nullable = false)
    val musicId: Long,

    @Column(name = "is_liked", nullable = false)
    val isLiked: Boolean
) {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null

    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: LocalDateTime = LocalDateTime.now()
}
