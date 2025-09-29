document.addEventListener('DOMContentLoaded', function() {

    // 스크롤 애니메이션 라이브러리(AOS) 초기화
    AOS.init({
        duration: 800, // 애니메이션 지속 시간 (ms)
        once: true, // 애니메이션이 한 번만 실행되도록 설정
        offset: 50, // 화면 하단에서 얼마나 떨어진 지점에서 애니메이션이 시작될지 설정
    });

    // 스크롤 시 헤더 스타일 변경 기능
    const header = document.getElementById('main-header');

    window.addEventListener('scroll', function() {
        // window.scrollY 값이 50px보다 크면 'scrolled' 클래스 추가, 아니면 제거
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    });

});