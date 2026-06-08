package com.miml.backend.controller

import com.miml.backend.dto.AcousticProfile
import com.miml.backend.dto.UserProfileResponse
import com.miml.backend.entity.User
import org.springframework.security.core.Authentication
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/user")
class UserController {

    @GetMapping("/me")
    fun getMe(authentication: Authentication): UserProfileResponse {
        val user = authentication.principal as User
        return UserProfileResponse(
            firebaseUid = user.firebaseUid,
            nickname = user.nickname,
            email = user.email,
            profile = AcousticProfile(
                energy = user.profileEnergy,
                happiness = user.profileHappiness,
                danceability = user.profileDanceability,
                acousticness = user.profileAcousticness,
                tempo = user.profileTempo
            ),
            feedbackCount = user.feedbackCount,
            hasLearnedProfile = user.hasLearnedProfile()
        )
    }
}
