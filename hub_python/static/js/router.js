/**
 * KBU Hub SPA 라우터 시스템
 * 페이지 전환 시 깜박임(FOUC/FOUT/CLS) 제거를 위한 클라이언트 사이드 라uting
 */

class SPARouter {
    constructor() {
        this.routes = {
            // ✅ 경로 수정: 모든 HTML 파일은 /static/ 폴더 안에 있으므로, 경로에 /static/을 추가합니다.
            '/': '/static/index.html',
            '/index': '/static/index.html',
            '/chat': '/static/chat.html',
            '/boards': '/static/boards.html',
            '/mypage': '/static/mypage.html',
            '/login': '/static/login.html',
            '/signup': '/static/signup.html', // 회원가입 경로 추가
            '/profile-setup': '/static/profile-setup.html',
            '/certify': '/static/certify.html', // 약관동의 경로 추가
            '/email-signup': '/static/email_signup.html' // 이메일 인증 경로 추가
        };
        
        this.currentRoute = '/';
        this.currentFile = '/static/index.html';
        this.contentContainer = null;
        this.isNavigating = false;
        
        this.init();
    }
    
    init() {
        // 콘텐츠 컨테이너 설정
        this.contentContainer = document.getElementById('main-content');
        if (!this.contentContainer) {
            console.error('❌ main-content 컨테이너를 찾을 수 없습니다.');
            return;
        }
        
        // 초기 라우트 설정
        this.currentRoute = window.location.pathname || '/';
        
        // 네비게이션 이벤트 리스너 설정
        this.setupNavigationListeners();
        
        // 브라우저 히스토리 이벤트 리스너 설정
        window.addEventListener('popstate', (e) => {
            this.handleRouteChange(e.state?.route || window.location.pathname, false);
        });
        
        // 초기 페이지 로드
        this.handleRouteChange(this.currentRoute, false);
        
        console.log('🚀 SPA 라우터 초기화 완료');
    }

    setupNavigationListeners() {
        document.body.addEventListener('click', e => {
            // data-spa-link 속성을 가진 링크만 라우터가 처리하도록 개선
            const link = e.target.closest('a[href]');

            if (link && link.getAttribute('href').startsWith('/')) {
                // 외부 링크나 #으로 시작하는 링크는 무시
                if (link.hostname && link.hostname !== window.location.hostname) return;
                
                e.preventDefault();
                const route = link.getAttribute('href');
                this.navigateTo(route);
            }
        });
    }

    async navigateTo(route) {
        if (this.isNavigating) return;
        this.handleRouteChange(route, true);
    }
    
    async handleRouteChange(route, isPushState) {
        if (!this.routes[route]) {
            console.warn(`'${route}'에 해당하는 라우트를 찾을 수 없습니다. 홈으로 이동합니다.`);
            route = '/';
        }

        this.isNavigating = true;
        this.currentRoute = route;
        this.currentFile = this.routes[route];

        if (isPushState) {
            history.pushState({ route }, '', route);
        }
        
        this.contentContainer.classList.add('fade-out-start');
        await this.wait(150);

        try {
            // ✅ 수정된 경로로 HTML 콘텐츠를 fetch 합니다.
            const response = await fetch(this.currentFile);
            if (!response.ok) {
                throw new Error(`${this.currentFile} 파일을 불러올 수 없습니다.`);
            }
            const html = await response.text();
            
            this.contentContainer.innerHTML = html;

            // 삽입된 HTML 내의 <script> 태그를 찾아서 실행시켜줌
            this.contentContainer.querySelectorAll('script').forEach(oldScript => {
                const newScript = document.createElement('script');
                Array.from(oldScript.attributes).forEach(attr => {
                    newScript.setAttribute(attr.name, attr.value);
                });
                newScript.appendChild(document.createTextNode(oldScript.innerHTML));
                oldScript.parentNode.replaceChild(newScript, oldScript);
            });

        } catch (error) {
            console.error('페이지 로드 오류:', error);
            this.contentContainer.innerHTML = '<p class="text-center text-red-500">페이지를 불러오는 데 실패했습니다.</p>';
        }

        this.contentContainer.classList.remove('fade-out-start');
        this.isNavigating = false;

        window.scrollTo(0, 0);
        
        window.dispatchEvent(new CustomEvent('pageLoaded', { 
            detail: { route: this.currentRoute, file: this.currentFile } 
        }));
    }
    
    wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    // 공개 메서드
    getCurrentRoute() {
        return this.currentRoute;
    }
}

// 전역 라우터 인스턴스 생성
window.spaRouter = new SPARouter();
