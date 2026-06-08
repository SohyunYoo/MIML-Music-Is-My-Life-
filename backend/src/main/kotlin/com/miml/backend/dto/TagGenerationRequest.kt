package com.miml.backend.dto

data class TagGenerationRequest(
    val review: String,
    val spotifyId: String,
    // 커뮤니티 글 등록 시 DB에 곡이 없는 경우 신규 저장에 사용
    val title: String? = null,
    val artist: String? = null,
    val album: String? = null,
    val albumImageUrl: String? = null
)
