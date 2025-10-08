/**
 * KBU Hub SPA 라우터 시스템 V2 (더 간단하고 효율적인 버전)
 */
document.addEventListener('DOMContentLoaded', () => {

    // 1. 라우트 정의: URL 경로와 불러올 HTML 파일 이름을 짝지어줍니다.
    // 이제 파일 경로는 훨씬 더 깔끔해집니다.
    const routes = {
        '/': 'index.html',
        '/login': 'login.html',
        '/boards': 'boards.html',
        '/chat': 'chat.html',
        '/mypage': 'mypage.html',
        '/signup': 'signup.html',
        '/profile-setup': 'profile-setup.html',
        '/certify': 'certify.html',
        '/email-signup': 'email_signup.html',
        // 404 페이지를 만들어두면 좋습니다.
        '/404': '404.html' 
    };

    // 2. 메인 콘텐츠를 표시할 DOM 요소를 찾습니다.
    const mainContent = document.getElementById('main-content');

    // 3. 페이지 콘텐츠를 불러오고 화면에 표시하는 핵심 함수
    const loadContent = async (path) => {
        // 현재 경로에 맞는 파일 이름을 찾습니다. 없으면 404.html을 사용합니다.
        const targetFile = routes[path] || routes['/404'];
        if (!targetFile) {
            mainContent.innerHTML = '<h2>페이지를 찾을 수 없습니다.</h2>';
            return;
        }

        try {
            // ✅ 핵심 수정: "static/pages/" 폴더에서 해당 HTML 파일을 fetch로 불러옵니다.
            const response = await fetch(`/static/pages/${targetFile}`);
            if (!response.ok) throw new Error('페이지 로딩 실패');
            
            const html = await response.text();
            mainContent.innerHTML = html;

            // 불러온 HTML 조각 안에 있는 <script> 태그를 찾아서 실행시켜주는 코드
            // 이렇게 해야 각 페이지의 전용 스크립트(로그인, 게시판 기능 등)가 작동합니다.
            Array.from(mainContent.querySelectorAll("script")).forEach(oldScript => {
                const newScript = document.createElement("script");
                Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
                newScript.appendChild(document.createTextNode(oldScript.innerHTML));
                oldScript.parentNode.replaceChild(newScript, oldScript);
            });
            console.log(`✅ ${path} 페이지 로딩 및 스크립트 실행 완료.`);

        } catch (error) {
            console.error(`${path} 페이지 로딩 중 오류:`, error);
            mainContent.innerHTML = '<h2>페이지를 불러오는 중 오류가 발생했습니다.</h2>';
        }
    };

    // 4. 다른 파일에서 window.spaRouter.navigateTo('/경로') 형태로 호출할 수 있는 함수
    window.spaRouter = {
        navigateTo: (path) => {
            // 브라우저 주소창의 주소를 변경하고, 히스토리에 기록을 남깁니다.
            history.pushState(null, null, path);
            // 해당 경로의 콘텐츠를 불러옵니다.
            loadContent(path);
        }
    };

    // 5. 브라우저의 뒤로가기/앞으로가기 버튼을 처리합니다.
    window.addEventListener('popstate', () => {
        loadContent(location.pathname);
    });

    // 6. 페이지가 처음 로드될 때 현재 주소에 맞는 콘텐츠를 불러옵니다.
    loadContent(location.pathname);

});