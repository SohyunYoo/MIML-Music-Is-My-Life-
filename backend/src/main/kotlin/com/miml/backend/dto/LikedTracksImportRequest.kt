package com.miml.backend.dto

data class LikedTracksImportRequest(
    val spotifyAccessToken: String,
    val maxTracks: Int = 50
)
