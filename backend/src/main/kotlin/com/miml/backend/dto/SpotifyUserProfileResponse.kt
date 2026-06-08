package com.miml.backend.dto

import com.fasterxml.jackson.annotation.JsonIgnoreProperties
import com.fasterxml.jackson.annotation.JsonProperty

/**
 * GET /v1/me 응답 (사용자 Spotify 프로필)
 */
@JsonIgnoreProperties(ignoreUnknown = true)
data class SpotifyUserProfileResponse(
    @JsonProperty("id")
    val id: String,

    @JsonProperty("display_name")
    val displayName: String? = null,

    @JsonProperty("email")
    val email: String? = null,

    @JsonProperty("product")
    val product: String? = null
)