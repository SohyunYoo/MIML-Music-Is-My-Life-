package com.miml.backend.entity

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.LocalDate
import java.time.LocalDateTime

@Entity
@Table(name = "music")
class Music(

    @Column(name = "title", nullable = false, length = 255)
    var title: String,

    @Column(name = "artist", nullable = false, length = 255)
    var artist: String,

    @Column(name = "album", length = 255)
    var album: String? = null,

    @Column(name = "spotify_id", unique = true, length = 50)
    var spotifyId: String? = null,

    @Column(name = "album_image_url", length = 500)
    var albumImageUrl: String? = null,

    @Column(name = "preview_url", length = 500)
    var previewUrl: String? = null,

    @Column(name = "release_date")
    var releaseDate: LocalDate? = null
) {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    var id: Long? = null

    @Column(name = "created_at", nullable = false, updatable = false)
    var createdAt: LocalDateTime = LocalDateTime.now()

    @Column(name = "updated_at", nullable = false)
    var updatedAt: LocalDateTime = LocalDateTime.now()
}