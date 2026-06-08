package com.miml.backend.config

import com.google.auth.oauth2.GoogleCredentials
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import jakarta.annotation.PostConstruct
import org.springframework.context.annotation.Configuration
import org.springframework.core.io.ClassPathResource

@Configuration
class FirebaseConfig {

    @PostConstruct
    fun initFirebase() {
        try {
            // 파이어베이스가 이미 초기화되어 있는지 확인 (중복 초기화 방지)
            if (FirebaseApp.getApps().isEmpty()) {

                // ⏳ 9단계에서 팀원에게 받을 키 파일의 이름을 아래에 적게 됩니다.
                // 일단은 "firebase-service-account.json"이라는 이름으로 가정해 두겠습니다.
                val resource = ClassPathResource("firebase-service-account.json")

                val options = FirebaseOptions.builder()
                    .setCredentials(GoogleCredentials.fromStream(resource.inputStream))
                    .build()

                FirebaseApp.initializeApp(options)
            }
        } catch (e: Exception) {
            println("❌ Firebase 초기화 실패!")
            println("   원인: ${e.message}")
            println("   firebase-service-account.json 파일을 resources에 확인하세요")
            throw RuntimeException("Firebase 초기화 실패", e)  // 서버 시작 중단
        }
    }
}