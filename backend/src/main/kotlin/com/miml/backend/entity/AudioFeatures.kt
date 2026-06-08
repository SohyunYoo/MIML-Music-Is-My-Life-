package com.miml.backend.entity

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.LocalDateTime

@Entity
@Table(name = "audio_features")
class AudioFeatures(

    @Id
    @Column(name = "music_id")
    var musicId: Long,

    @Column(name = "energy", nullable = false)
    var energy: Int,

    @Column(name = "happiness", nullable = false)
    var happiness: Int,

    @Column(name = "danceability", nullable = false)
    var danceability: Int,

    @Column(name = "acousticness", nullable = false)
    var acousticness: Int,

    @Column(name = "tempo", nullable = false)
    var tempo: Int,

    @Column(name = "music_key", length = 5)
    var musicKey: String? = null,

    @Column(name = "music_mode", length = 10)
    var musicMode: String? = null,

    @Column(name = "camelot", length = 5)
    var camelot: String? = null,

    @Column(name = "instrumentalness")
    var instrumentalness: Int? = null,

    @Column(name = "loudness", length = 20)
    var loudness: String? = null,

    @Column(name = "speechiness")
    var speechiness: Int? = null,

    @Column(name = "liveness")
    var liveness: Int? = null,

    @Column(name = "duration", length = 10)
    var duration: String? = null,

    @Column(name = "popularity")
    var popularity: Int? = null
) {
    @Column(name = "fetched_at", nullable = false, updatable = false)
    var fetchedAt: LocalDateTime = LocalDateTime.now()
}