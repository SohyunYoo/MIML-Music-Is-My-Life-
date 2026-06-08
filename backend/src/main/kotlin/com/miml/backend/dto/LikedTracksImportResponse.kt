package com.miml.backend.dto

data class LikedTracksImportResponse(
    val totalTracksFound: Int,
    val newTracksAdded: Int,
    val alreadyExisted: Int,
    val failed: Int,
    val profileUpdated: Boolean,
    val elapsedSeconds: Double,
    val failedTracks: List<String> = emptyList()
)
