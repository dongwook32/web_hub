// static/js/script.js

console.log('KBU Hub 공용 스크립트 로드됨');

// 스크롤 시 헤더 스타일 변경 기능
// 이 코드는 app.html의 <header>를 대상으로 하므로,
// DOMContentLoaded 없이도 항상 잘 작동합니다.
const header = document.querySelector('header.app-header');

if (header) {
    window.addEventListener('scroll', function() {
        // window.scrollY 값이 10px보다 크면 'scrolled' 클래스 추가, 아니면 제거
        if (window.scrollY > 10) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    });
}

// 여기에 웹사이트의 모든 페이지에서 공통으로 사용될 다른 기능들을 추가할 수 있습니다.
// 예: 다크 모드 토글, 맨 위로 가기 버튼 등