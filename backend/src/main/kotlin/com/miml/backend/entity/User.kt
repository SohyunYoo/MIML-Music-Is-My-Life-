package com.miml.backend.entity

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.LocalDateTime

@Entity
@Table(name = "users")
class User(

    @Column(name = "firebase_uid", nullable = false, unique = true, length = 128)
    var firebaseUid: String,

    @Column(name = "nickname", nullable = false, length = 50)
    var nickname: String,

    @Column(name = "email", length = 255)
    var email: String? = null,

    @Column(name = "spotify_id", length = 128)
    var spotifyId: String? = null,

    @Column(name = "spotify_connected", nullable = false)
    var spotifyConnected: Boolean = false,

    // 사용자 음향 취향 프로파일 (Spotify 플레이리스트 분석 기반)
    @Column(name = "profile_energy")
    var profileEnergy: Int = 50,

    @Column(name = "profile_happiness")
    var profileHappiness: Int = 50,

    @Column(name = "profile_danceability")
    var profileDanceability: Int = 50,

    @Column(name = "profile_acousticness")
    var profileAcousticness: Int = 50,

    @Column(name = "profile_tempo")
    var profileTempo: Int = 120,

    @Column(name = "feedback_count")
    var feedbackCount: Int = 0
) {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    var id: Long? = null

    @Column(name = "created_at", nullable = false, updatable = false)
    var createdAt: LocalDateTime = LocalDateTime.now()

    @Column(name = "updated_at", nullable = false)
    var updatedAt: LocalDateTime = LocalDateTime.now()

    /**
     * 사용자 프로파일이 기본값인지 (즉, 아직 학습 안 됨) 판단
     */
    fun hasLearnedProfile(): Boolean {
        return profileEnergy != 50 || profileHappiness != 50 ||
                profileDanceability != 50 || profileAcousticness != 50 ||
                profileTempo != 120
    }
}