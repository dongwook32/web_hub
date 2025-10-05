// 회원가입 페이지에서 사용할 수 있는 연동 코드 예시

// 회원가입 폼 제출 시 호출할 함수
function handleSignup(formData) {
  // 회원가입 정보 객체 생성
  const userProfile = {
    name: formData.name,           // 이름
    studentId: formData.studentId, // 학번 (예: "2022")
    birthday: formData.birthday,   // 생일 (예: "1999-01-01")
    gender: formData.gender,       // 성별 (예: "남자" 또는 "여자")
    status: formData.status,       // 재학 상태 (예: "재학생", "휴학생", "졸업생")
    department: formData.department || '한국성서대', // 학교/학과 (기본값: 한국성서대)
    email: formData.email,         // 이메일
    password: formData.password    // 비밀번호 (실제로는 해시화해서 저장해야 함)
  };

  // localStorage에 사용자 프로필 저장
  try {
    localStorage.setItem('userProfile', JSON.stringify(userProfile));
    localStorage.setItem('isLoggedIn', 'true');
    localStorage.setItem('currentUser', userProfile.email);
    
    console.log('회원가입 완료:', userProfile);
    alert('회원가입이 완료되었습니다!');
    
    // 마이페이지로 이동하거나 로그인 페이지로 이동
    window.location.href = 'mypage.html';
    
  } catch (error) {
    console.error('회원가입 저장 실패:', error);
    alert('회원가입 중 오류가 발생했습니다.');
  }
}

// 회원가입 폼 예시 HTML (참고용)
const signupFormHTML = `
<form id="signupForm" onsubmit="handleSignupSubmit(event)">
  <div class="form-group">
    <label>이름</label>
    <input type="text" name="name" required>
  </div>
  
  <div class="form-group">
    <label>학번</label>
    <select name="studentId" required>
      <option value="">선택해주세요</option>
      <option value="2025">2025학번</option>
      <option value="2024">2024학번</option>
      <option value="2023">2023학번</option>
      <option value="2022">2022학번</option>
      <option value="2021">2021학번</option>
    </select>
  </div>
  
  <div class="form-group">
    <label>생일</label>
    <input type="date" name="birthday" required>
  </div>
  
  <div class="form-group">
    <label>성별</label>
    <div class="gender-options">
      <label><input type="radio" name="gender" value="남자" required> 남자</label>
      <label><input type="radio" name="gender" value="여자" required> 여자</label>
    </div>
  </div>
  
  <div class="form-group">
    <label>재학 상태</label>
    <select name="status" required>
      <option value="">선택해주세요</option>
      <option value="재학생">재학생</option>
      <option value="휴학생">휴학생</option>
      <option value="졸업생">졸업생</option>
    </select>
  </div>
  
  <div class="form-group">
    <label>학교/학과</label>
    <input type="text" name="department" value="한국성서대" readonly>
    <small>현재는 한국성서대만 지원합니다.</small>
  </div>
  
  <div class="form-group">
    <label>이메일</label>
    <input type="email" name="email" required>
  </div>
  
  <div class="form-group">
    <label>비밀번호</label>
    <input type="password" name="password" required>
  </div>
  
  <div class="form-group">
    <label>비밀번호 확인</label>
    <input type="password" name="passwordConfirm" required>
  </div>
  
  <button type="submit">회원가입</button>
</form>
`;

// 폼 제출 처리 함수
function handleSignupSubmit(event) {
  event.preventDefault();
  
  const formData = new FormData(event.target);
  const data = Object.fromEntries(formData.entries());
  
  // 비밀번호 확인
  if (data.password !== data.passwordConfirm) {
    alert('비밀번호가 일치하지 않습니다.');
    return;
  }
  
  // 회원가입 처리
  handleSignup(data);
}

// 로그인 처리 함수 (로그인 페이지에서 사용)
function handleLogin(email, password) {
  try {
    const userProfile = JSON.parse(localStorage.getItem('userProfile') || 'null');
    
    if (userProfile && userProfile.email === email && userProfile.password === password) {
      localStorage.setItem('isLoggedIn', 'true');
      localStorage.setItem('currentUser', email);
      
      alert('로그인 성공!');
      window.spaRouter.navigateTo('/mypage');
    } else {
      alert('이메일 또는 비밀번호가 잘못되었습니다.');
    }
  } catch (error) {
    console.error('로그인 실패:', error);
    alert('로그인 중 오류가 발생했습니다.');
  }
}

// 비밀번호 검증 함수 (회원가입 시 사용)
function validatePassword(password) {
  const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{8,}$/;
  return passwordRegex.test(password);
}

// 강화된 회원가입 처리 함수
function handleSignupEnhanced(formData) {
  // 비밀번호 강도 검증
  if (!validatePassword(formData.password)) {
    alert('비밀번호는 8자 이상, 영문과 숫자를 포함해야 합니다.');
    return false;
  }

  // 이메일 도메인 검증 (bible.ac.kr)
  if (!formData.email.endsWith('@bible.ac.kr')) {
    alert('학교 이메일(@bible.ac.kr)을 사용해주세요.');
    return false;
  }

  // 기존 회원가입 처리
  return handleSignup(formData);
}

// 테스트용 샘플 사용자 데이터 생성
function createSampleUser() {
  const sampleUserData = {
    name: "정준영",
    studentId: "2022",
    birthday: "1999-01-01",
    gender: "남자",
    status: "재학생",
    department: "한국성서대",
    email: "junyongju@bible.ac.kr",
    password: "password123"
  };
  
  handleSignup(sampleUserData);
  console.log('샘플 사용자 생성 완료:', sampleUserData);
}

// 개발용 샘플 사용자 생성 버튼 (개발 모드에서만)
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
  document.addEventListener('DOMContentLoaded', function() {
    const sampleUserBtn = document.createElement('button');
    sampleUserBtn.textContent = '샘플 사용자 생성 (개발용)';
    sampleUserBtn.style.position = 'fixed';
    sampleUserBtn.style.bottom = '70px';
    sampleUserBtn.style.right = '20px';
    sampleUserBtn.style.zIndex = '9999';
    sampleUserBtn.style.padding = '10px';
    sampleUserBtn.style.backgroundColor = '#28a745';
    sampleUserBtn.style.color = 'white';
    sampleUserBtn.style.border = 'none';
    sampleUserBtn.style.borderRadius = '5px';
    sampleUserBtn.style.cursor = 'pointer';
    sampleUserBtn.onclick = createSampleUser;
    document.body.appendChild(sampleUserBtn);
  });
}
