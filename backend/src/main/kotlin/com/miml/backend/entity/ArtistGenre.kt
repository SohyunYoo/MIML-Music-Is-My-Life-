package com.miml.backend.entity

import jakarta.persistence.*
import java.time.LocalDateTime

@Entity
@Table(
    name = "artist_genres",
    uniqueConstraints = [UniqueConstraint(columnNames = ["spotify_artist_id", "genre"])]
)
class ArtistGenre(

    @Column(name = "spotify_artist_id", nullable = false, length = 50)
    val spotifyArtistId: String,

    @Column(name = "artist_name", nullable = false, length = 255)
    val artistName: String,

    @Column(name = "genre", nullable = false, length = 100)
    val genre: String
) {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null

    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: LocalDateTime = LocalDateTime.now()
}
