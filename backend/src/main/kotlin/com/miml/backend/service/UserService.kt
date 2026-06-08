package com.miml.backend.service

import com.miml.backend.entity.User
import com.miml.backend.repository.UserRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class UserService(
    private val userRepository: UserRepository // 생성자 주입
) {

    // 데이터베이스의 상태를 변경(저장)하는 작업이 포함되므로 트랜잭션 처리
    @Transactional
    fun getOrCreateUser(firebaseUid: String, email: String?, nickname: String?): User {

        // 1. 파이어베이스 UID로 기존 유저가 있는지 조회
        val existingUser = userRepository.findByFirebaseUid(firebaseUid)

        // 2. 유저가 존재하면 그 유저를 반환하고,
        //    존재하지 않으면(null이면) 새 유저 객체를 생성하여 DB에 저장 후 반환
        return existingUser ?: userRepository.save(
            User(
                firebaseUid = firebaseUid,
                nickname = nickname ?: "Unknown", // NOT NULL 컬럼이므로 값이 없을 때의 기본값 처리
                email = email // nullable 컬럼이므로 그대로 대입
            )
        )
    }
}