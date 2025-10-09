// 최종 static/js/signup.js

(function() {
    // signup.html이 로드될 때마다 이 함수가 실행됩니다.
    function initializeSignupForm() {
        const signupForm = document.getElementById('signup-form');
        const errorMessageDiv = document.getElementById('signup-error-message');

        if (signupForm) {
            signupForm.addEventListener('submit', async function(e) {
                e.preventDefault();
                errorMessageDiv.textContent = '';

                // 폼 데이터 가져오기
                const name = document.getElementById('name').value;
                const nickname = document.getElementById('nickname').value;
                const studentId = document.getElementById('studentId').value;
                const email = document.getElementById('email').value;
                const password = document.getElementById('password').value;
                const passwordConfirm = document.getElementById('passwordConfirm').value;

                // 클라이언트 측 유효성 검사
                if (password !== passwordConfirm) {
                    errorMessageDiv.textContent = '비밀번호가 일치하지 않습니다.';
                    return;
                }

                try {
                    // 서버의 /api/signup으로 데이터 전송
                    const response = await fetch('/api/signup', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            name, nickname, studentId, email, password
                        })
                    });

                    const data = await response.json();

                    if (response.ok) {
                        alert(data.message);
                        window.spaRouter.navigateTo('/login'); // 성공 시 로그인 페이지로 이동
                    } else {
                        errorMessageDiv.textContent = data.error || '회원가입에 실패했습니다.';
                    }

                } catch (error) {
                    errorMessageDiv.textContent = '서버와 통신할 수 없습니다.';
                }
            });
        }
    }

    // 페이지가 로드될 때 폼 초기화 함수를 실행하도록 이벤트 리스너 추가
    // 'pageLoaded'는 router.js에서 페이지 로드가 완료될 때 발생시키는 커스텀 이벤트입니다.
    window.addEventListener('pageLoaded', (e) => {
        if (e.detail.route === '/signup') {
            initializeSignupForm();
        }
    });

})();