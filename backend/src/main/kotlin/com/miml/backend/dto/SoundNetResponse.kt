package com.miml.backend.dto

import com.fasterxml.jackson.annotation.JsonProperty

data class SoundNetResponse(
    @JsonProperty("key")
    val key: String? = null,

    @JsonProperty("mode")
    val mode: String? = null,

    @JsonProperty("tempo")
    val tempo: Int? = null,

    @JsonProperty("camelot")
    val camelot: String? = null,

    @JsonProperty("energy")
    val energy: Int? = null,

    @JsonProperty("danceability")
    val danceability: Int? = null,

    @JsonProperty("happiness")
    val happiness: Int? = null,

    @JsonProperty("acousticness")
    val acousticness: Int? = null,

    @JsonProperty("instrumentalness")
    val instrumentalness: Int? = null,

    @JsonProperty("loudness")
    val loudness: String? = null,

    @JsonProperty("speechiness")
    val speechiness: Int? = null,

    @JsonProperty("liveness")
    val liveness: Int? = null,

    @JsonProperty("duration")
    val duration: String? = null,

    @JsonProperty("popularity")
    val popularity: Int? = null
)