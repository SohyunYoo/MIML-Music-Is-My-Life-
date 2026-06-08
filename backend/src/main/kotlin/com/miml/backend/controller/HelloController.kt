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
}