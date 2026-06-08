package com.miml.backend.security

import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseAuthException
import com.miml.backend.service.UserService
import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.stereotype.Component
import org.springframework.web.filter.OncePerRequestFilter

@Component
class FirebaseAuthenticationFilter(
    private val userService: UserService // 5단계에서 만든 서비스 주입
) : OncePerRequestFilter() {

    override fun doFilterInternal(
        request: HttpServletRequest,
        response: HttpServletResponse,
        filterChain: FilterChain
    ) {
        // 1. 클라이언트(안드로이드)의 요청 헤더에서 "Authorization" 값을 꺼냅니다.
        val header = request.getHeader("Authorization")

        // 2. 헤더가 없거나 "Bearer "로 시작하지 않으면 다음 단계로 그냥 넘깁니다.
        // (로그인이 필요 없는 공개 API일 수 있기 때문)
        if (header.isNullOrBlank() || !header.startsWith("Bearer ")) {
            filterChain.doFilter(request, response)
            return
        }

        // 3. "Bearer " 이후의 실제 토큰 문자열만 추출합니다.
        val token = header.substring(7)

        try {
            // 4. 파이어베이스 Admin SDK를 사용해 토큰이 유효한지 검증하고 해독합니다.
            val decodedToken = FirebaseAuth.getInstance().verifyIdToken(token)

            val uid = decodedToken.uid
            val email = decodedToken.email
            val name = decodedToken.name

            // 5. 앞서 만든 UserService를 통해 DB에서 유저를 찾거나 새로 생성(회원가입)합니다.
            val user = userService.getOrCreateUser(uid, email, name)

            // 6. 스프링 시큐리티의 핵심 부분: "이 유저는 정상적으로 인증되었다"는 증명서를 만들어 시스템 메모리에 저장합니다.
            val authentication = UsernamePasswordAuthenticationToken(user, null, emptyList())
            SecurityContextHolder.getContext().authentication = authentication

        } catch (e: FirebaseAuthException) {
            // 토큰이 만료되었거나 위조된 경우 401(Unauthorized) 에러를 반환합니다.
            response.status = HttpServletResponse.SC_UNAUTHORIZED
            response.writer.write("Unauthorized: Invalid Firebase Token")
            return
        }

        // 7. 검증이 끝났으니 요청을 다음 목적지(컨트롤러 등)로 통과시킵니다.
        filterChain.doFilter(request, response)
    }
}