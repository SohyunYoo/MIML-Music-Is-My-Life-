package com.miml.backend.controller

import com.miml.backend.dto.LikedTracksImportRequest
import com.miml.backend.dto.LikedTracksImportResponse
import com.miml.backend.entity.User
import com.miml.backend.service.SpotifyImportService
import org.springframework.http.ResponseEntity
import org.springframework.security.core.Authentication
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/spotify")
class SpotifyController(
    private val spotifyImportService: SpotifyImportService
) {
    @PostMapping("/import-liked-tracks")
    fun importLikedTracks(
        @RequestBody request: LikedTracksImportRequest,
        authentication: Authentication
    ): ResponseEntity<LikedTracksImportResponse> {
        val user = authentication.principal as User
        val result = spotifyImportService.importLikedTracks(user.id!!, request)
        return ResponseEntity.ok(result)
    }

    @PostMapping("/fill-missing-ids")
    fun fillMissingSpotifyIds(
        @RequestBody request: LikedTracksImportRequest
    ): ResponseEntity<Map<String, Any>> {
        val result = spotifyImportService.fillMissingSpotifyIds(request.spotifyAccessToken, request.maxTracks)
        return ResponseEntity.ok(result)
    }

    @PostMapping("/fill-album-images")
    fun fillAlbumImages(
        @RequestBody request: LikedTracksImportRequest
    ): ResponseEntity<Map<String, Any>> {
        val result = spotifyImportService.fillMissingAlbumImages(request.spotifyAccessToken, request.maxTracks)
        return ResponseEntity.ok(result)
    }
}
