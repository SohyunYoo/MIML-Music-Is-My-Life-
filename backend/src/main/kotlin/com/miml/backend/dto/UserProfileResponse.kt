package com.miml.backend.dto

data class UserProfileResponse(
    val firebaseUid: String,
    val nickname: String,
    val email: String?,
    val profile: AcousticProfile,
    val feedbackCount: Int,
    val hasLearnedProfile: Boolean
)

data class AcousticProfile(
    val energy: Int,
    val happiness: Int,
    val danceability: Int,
    val acousticness: Int,
    val tempo: Int
)
