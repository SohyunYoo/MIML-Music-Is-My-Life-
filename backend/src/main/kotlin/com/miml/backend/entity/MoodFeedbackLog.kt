package com.miml.backend.entity

import jakarta.persistence.*
import java.time.LocalDateTime

@Entity
@Table(
    name = "mood_feedback_log",
    uniqueConstraints = [UniqueConstraint(columnNames = ["user_id", "music_id", "mood_context"])]
)
class MoodFeedbackLog(

    @Column(name = "user_id", nullable = false)
    val userId: Long,

    @Column(name = "music_id", nullable = false)
    val musicId: Long,

    @Column(name = "is_positive", nullable = false)
    val isPositive: Boolean,

    // "energy_happiness_danceability_acousticness_tempo" 형태로 무드 컨텍스트 식별
    @Column(name = "mood_context", nullable = false, length = 30)
    val moodContext: String,

    @Column(name = "mood_energy", nullable = false)
    val moodEnergy: Int,

    @Column(name = "mood_happiness", nullable = false)
    val moodHappiness: Int,

    @Column(name = "mood_danceability", nullable = false)
    val moodDanceability: Int,

    @Column(name = "mood_acousticness", nullable = false)
    val moodAcousticness: Int,

    @Column(name = "mood_tempo", nullable = false)
    val moodTempo: Int,

    @Column(name = "applied", nullable = false)
    var applied: Boolean = false
) {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null

    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: LocalDateTime = LocalDateTime.now()
}
