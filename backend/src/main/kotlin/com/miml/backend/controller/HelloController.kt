package com.miml.backend.controller

import com.miml.backend.repository.MusicRepository
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api")
class HelloController(
    private val musicRepository: MusicRepository
) {

    @GetMapping("/hello")
    fun hello(): Map<String, String> {
        return mapOf(
            "message" to "Hello, MIML!",
            "status" to "OK"
        )
    }

    @GetMapping("/ping")
    fun ping(): String {
        return "pong"
    }

    @GetMapping("/music/count")
    fun countMusic(): Map<String, Any> {
        val count = musicRepository.count()
        return mapOf(
            "totalMusic" to count
        )
    }

    @GetMapping("/music/export")
    fun exportMusic(): List<Map<String, Any?>> {
        return musicRepository.findAll().map { m ->
            mapOf(
                "id"            to m.id,
                "title"         to m.title,
                "artist"        to m.artist,
                "album"         to m.album,
                "spotifyId"     to m.spotifyId,
                "albumImageUrl" to m.albumImageUrl,
                "previewUrl"    to m.previewUrl,
                "releaseDate"   to m.releaseDate?.toString()
            )
        }
    }
}