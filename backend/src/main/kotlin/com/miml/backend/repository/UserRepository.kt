package com.miml.backend.repository

import com.miml.backend.entity.User
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository

@Repository
interface UserRepository : JpaRepository<User, Long> {

    fun findByFirebaseUid(firebaseUid: String): User?

    fun findBySpotifyId(spotifyId: String): User?

    fun existsByFirebaseUid(firebaseUid: String): Boolean
}