package com.miml.backend.controller

import com.miml.backend.dto.PlaylistSaveRequest
import com.miml.backend.dto.PlaylistSaveResponse
import com.miml.backend.entity.User
import com.miml.backend.service.PlaylistService
import org.springframework.security.core.Authentication
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/playlists")
class PlaylistController(
    private val playlistService: PlaylistService
) {
    @PostMapping
    fun save(
        @RequestBody request: PlaylistSaveRequest,
        authentication: Authentication
    ): PlaylistSaveResponse {
        val user = authentication.principal as User
        return playlistService.save(user.firebaseUid, request)
    }
}
