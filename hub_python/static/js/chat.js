    <script>
    // 익명 프로필 로드
    function loadAnonProfile() {
      try {
        const profile = JSON.parse(localStorage.getItem('anonProfile') || 'null');
        if (profile) {
          // 마이프로필 카드 업데이트
          document.getElementById('myProfileName').textContent = profile.nickname || '익명의친구';
          document.getElementById('myProfileDetails').textContent = `${profile.year}학번 · ${profile.gender}`;
          document.getElementById('myProfileBio').textContent = profile.bio || '새로운 친구를 만나고 싶어요!';
          
          // 관심사 목록 업데이트
          updateInterestList(profile.interests || []);
          
          // 매칭 버튼 활성화
          document.getElementById('startRandom').textContent = '1:1 매칭 시작';
          document.getElementById('startGroup').textContent = '그룹 매칭 시작';
        } else { 
          // 기본값 설정
          document.getElementById('myProfileName').textContent = '익명 프로필';
          document.getElementById('myProfileDetails').textContent = '23학번 · 남자';
          document.getElementById('myProfileBio').textContent = '새로운 친구를 만나고 싶어요!';
          
          // 관심사 목록 업데이트
          updateInterestList([]);
          
          // 매칭 버튼 활성화
          document.getElementById('startRandom').textContent = '1:1 매칭 시작';
          document.getElementById('startGroup').textContent = '그룹 매칭 시작';
        }
      } catch (e) {
        console.error('프로필 로드 실패:', e);
        // 기본값 설정
        document.getElementById('myProfileName').textContent = '익명 프로필';
        document.getElementById('myProfileDetails').textContent = '23학번 · 남자';
        document.getElementById('myProfileBio').textContent = '새로운 친구를 만나고 싶어요!';
      }
    }

    // 관심사 목록 업데이트
    function updateInterestList(interests) {
      const interestList = document.getElementById('interestList');
      interestList.innerHTML = '';
      
            if (interests.length === 0) {
        const li = document.createElement('li');
        li.textContent = '선택한 관심사가 없습니다.';
        li.style.color = '#999';
        li.style.cursor = 'default';
        interestList.appendChild(li);
                return;
            }
            
      // 관심사별 이모지 매핑
      const interestEmojis = {
        '영화': '🎬',
        '운동': '💪',
        '게임': '🎮',
        '음악': '🎵',
        '카페': '☕',
        '여행': '✈️',
        '스터디': '📚',
        '독서': '📖',
        '맛집': '🍽️'
      };
      
      interests.forEach(interest => {
                const li = document.createElement('li');
        const emoji = interestEmojis[interest] || '🎯';
        const participantCount = roomParticipants[interest]?.count || 0;
        
        // 관심분야 항목 HTML 구조 (채팅방 목록과 동일한 스타일)
        li.innerHTML = `
            <div class="room-info">
                <div class="room-name-wrapper">
                    <span class="room-name">${emoji} ${interest}</span>
                </div>
                <span class="participant-count">${participantCount}명</span>
            </div>
        `;
        
        li.addEventListener('click', () => {
            // 관심사 방 입장 시 채팅방 목록에 추가
            addInterestRoom(interest);
            enterRoom(interest);
            
            // 클릭된 관심분야에 active 클래스 추가 (비주얼 스타일 적용)
            document.querySelectorAll('#interestList li').forEach(item => {
                item.classList.remove('active');
            });
            li.classList.add('active');
        });
                interestList.appendChild(li);
            });
    }

    // 관심사 방을 채팅방 목록에 추가
    function addInterestRoom(interest) {
        // 이미 존재하는 방인지 확인
        const existingRoom = chatData.roomList.find(room => room.name === interest);
        if (!existingRoom) {
            // 채팅방 데이터에 추가
            if (!chatData.rooms[interest]) {
                chatData.rooms[interest] = [];
            }
            
            // 채팅방 목록에 추가
            chatData.roomList.push({
                name: interest,
                type: 'interest',
                unreadCount: 0,
                participantCount: roomParticipants[interest]?.count || 0,
                createdAt: new Date().toISOString()
            });
            
            saveChatData();
            updateRoomListUI();
        } else {
            // 기존 방인 경우 참여자 수 증가
            incrementParticipantCount(interest);
        }
    }

    // 관심분야 방 참여자 수 증가
    function incrementParticipantCount(interest) {
        if (roomParticipants[interest]) {
            roomParticipants[interest].count += 1;
            // 채팅방 목록의 참여자 수 업데이트
            const roomData = chatData.roomList.find(room => room.name === interest);
            if (roomData) {
                roomData.participantCount = roomParticipants[interest].count;
                saveChatData();
                updateRoomListUI();
                updateInterestListUI(interest);
            }
        }
    }

    // 관심분야 목록 UI 업데이트
    function updateInterestListUI(interest) {
        const interestList = document.getElementById('interestList');
        const listItems = interestList.querySelectorAll('li');
        
        listItems.forEach(li => {
            const roomNameSpan = li.querySelector('.room-name');
            if (roomNameSpan && roomNameSpan.textContent.includes(interest)) {
                const participantCountSpan = li.querySelector('.participant-count');
                if (participantCountSpan) {
                    const currentCount = roomParticipants[interest]?.count || 0;
                    participantCountSpan.textContent = `${currentCount}명`;
                }
            }
        });
    }

    // 기본 관심분야 방들을 초기화
    function initializeDefaultInterestRooms() {
        const defaultInterests = ['운동', '독서']; // 이미지에 보이는 기본 관심분야들
        
        defaultInterests.forEach(interest => {
            addInterestRoom(interest);
        });
    }


    // 매칭 관련 변수
        let randomMatching = false;
        let groupMatching = false;
        let randomStartTime = null;
        let groupStartTime = null;
        let randomTimer = null;
        let groupTimer = null;
        
        // 그룹 매칭 대기열 (전역)
        let groupMatchingQueue = {
            male: [], // 남자 대기자 목록
            female: [], // 여자 대기자 목록
            groups: [] // 완성된 그룹 목록
        };
        
        // 채팅 데이터 저장소 (전역)
        let chatData = {
            rooms: {}, // 채팅방별 메시지 저장
            roomList: [] // 채팅방 목록
        };

    // 타이머 포맷팅
        function formatTime(seconds) {
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            const secs = seconds % 60;
            return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }

        // 채팅 데이터 저장
        function saveChatData() {
            try {
                localStorage.setItem('chatData', JSON.stringify(chatData));
            } catch (e) {
                console.error('채팅 데이터 저장 실패:', e);
            }
        }

        // 채팅 데이터 로드
        function loadChatData() {
            try {
                const saved = localStorage.getItem('chatData');
                if (saved) {
                    chatData = JSON.parse(saved);
                }
            } catch (e) {
                console.error('채팅 데이터 로드 실패:', e);
                chatData = { rooms: {}, roomList: [] };
            }
        }

        // 채팅방 목록 UI 업데이트
        function updateRoomListUI() {
            // 1:1 채팅방 목록 업데이트
            const dmList = document.getElementById('dmList');
            dmList.innerHTML = '';
            
            // 그룹 채팅방 목록 업데이트
            const groupList = document.getElementById('groupList');
            groupList.innerHTML = '';
            
            // 관심분야 채팅방 목록 업데이트
            const interestList = document.getElementById('interestList');
            interestList.innerHTML = '';
            
            chatData.roomList.forEach(room => {
                if (room.type === 'dm') {
                    createRoomListItem('dmList', room.name, room.unreadCount || 0);
                } else if (room.type === 'group') {
                    createRoomListItem('groupList', room.name, room.unreadCount || 0, room.participantCount || 0);
                } else if (room.type === 'interest') {
                    createRoomListItem('interestList', room.name, room.unreadCount || 0, room.participantCount || 0);
                }
            });
        }

        // 채팅방 목록 아이템 생성
        function createRoomListItem(listId, roomName, unreadCount = 0, participantCount = 0) {
            const list = document.getElementById(listId);
            const li = document.createElement('li');
            const isGroupChat = listId === 'groupList' || listId === 'interestList';
            const isInterestRoom = listId === 'interestList';
            
            // 관심분야 방인 경우 이모지 추가
            let displayName = roomName;
            if (isInterestRoom) {
                const interestEmojis = {
                    '운동': '💪',
                    '게임': '🎮',
                    '음악': '🎵',
                    '영화': '🎬',
                    '요리': '👨‍🍳',
                    '여행': '✈️',
                    '스터디': '📚',
                    '독서': '📖',
                    '맛집': '🍽️'
                };
                const emoji = interestEmojis[roomName] || '🎯';
                displayName = `${emoji} ${roomName}`;
            }
            
            li.innerHTML = `
                <div class="room-info">
                    <div class="room-name-wrapper">
                        <span class="room-name">${displayName}</span>
                        ${unreadCount > 0 ? `<span class="unread-badge">${unreadCount}</span>` : ''}
                    </div>
                    ${isGroupChat ? `<span class="participant-count">${participantCount}명</span>` : ''}
                </div>
            `;
            li.addEventListener('click', () => {
                enterRoom(roomName);
                
                // 관심분야 방인 경우 비주얼 스타일 적용
                if (isInterestRoom) {
                    document.querySelectorAll('#interestList li').forEach(item => {
                        item.classList.remove('active');
                    });
                    li.classList.add('active');
                }
            });
            list.appendChild(li);
        }

        // 1:1 매칭 시작
        function startRandomMatching() {
            // 현재 사용자의 성별 정보 가져오기
            const currentProfile = JSON.parse(localStorage.getItem('anonProfile') || 'null');
            const currentUserGender = currentProfile?.gender || '남자';
            
            // 이성 프로필만 필터링
            const oppositeGenderProfiles = randomProfiles.filter(profile => 
                profile.gender !== currentUserGender
            );
            
            // 이성 프로필이 없는 경우 안내 메시지 표시
            if (oppositeGenderProfiles.length === 0) {
                alert('현재 매칭 가능한 상대가 없습니다.');
                return;
            }
            
            randomMatching = true;
            randomStartTime = Date.now();
      document.getElementById('startRandom').style.display = 'none';
      document.getElementById('randomMatchingStatus').style.display = 'block';
            
            randomTimer = setInterval(() => {
                const elapsed = Math.floor((Date.now() - randomStartTime) / 1000);
        document.getElementById('randomTimer').textContent = formatTime(elapsed);
            }, 1000);

      // 시연용: 5-10초 후 매칭 완료 (이성 프로필 중에서만 선택)
      setTimeout(() => {
        completeRandomMatching(oppositeGenderProfiles);
      }, Math.random() * 5000 + 5000);
        }

        // 그룹 매칭 시작
        function startGroupMatching() {
            // 현재 사용자의 성별 정보 가져오기
            const currentProfile = JSON.parse(localStorage.getItem('anonProfile') || 'null');
            const currentUserGender = currentProfile?.gender || '남자';
            const currentUserNickname = currentProfile?.nickname || '익명의친구';
            
            // 대기열에 사용자 추가
            const userInfo = {
                nickname: currentUserNickname,
                gender: currentUserGender,
                joinTime: Date.now()
            };
            
            if (currentUserGender === '남자') {
                groupMatchingQueue.male.push(userInfo);
            } else {
                groupMatchingQueue.female.push(userInfo);
            }
            
            groupMatching = true;
            groupStartTime = Date.now();
      document.getElementById('startGroup').style.display = 'none';
      document.getElementById('groupMatchingStatus').style.display = 'block';
            
            groupTimer = setInterval(() => {
                const elapsed = Math.floor((Date.now() - groupStartTime) / 1000);
        document.getElementById('groupTimer').textContent = formatTime(elapsed);
                
                // 대기 상태 업데이트
                updateGroupMatchingStatus();
            }, 1000);

            // 그룹 매칭 시도
            tryGroupMatching();
        }

        // 1:1 매칭 완료
        function completeRandomMatching(availableProfiles = null) {
            randomMatching = false;
            clearInterval(randomTimer);
            document.getElementById('startRandom').style.display = 'block';
            document.getElementById('randomMatchingStatus').style.display = 'none';
            
            let matchedProfile;
            
            if (availableProfiles && availableProfiles.length > 0) {
                // 이성 프로필 중에서 랜덤 선택
                matchedProfile = availableProfiles[Math.floor(Math.random() * availableProfiles.length)];
            } else {
                // 기존 로직 (이성 필터링이 없는 경우)
                const nicknames = ['익명의친구', '익명의학생', '익명의동료', '신비한친구', '알수없는누군가'];
                const randomNickname = nicknames[Math.floor(Math.random() * nicknames.length)];
                matchedProfile = { name: randomNickname };
            }
            
            const roomName = matchedProfile.name;
            
            // 채팅방 데이터에 추가
            if (!chatData.rooms[roomName]) {
                chatData.rooms[roomName] = [];
            }
            
            // 채팅방 목록에 추가 (중복 체크)
            const existingRoom = chatData.roomList.find(room => room.name === roomName);
            if (!existingRoom) {
                chatData.roomList.push({
                    name: roomName,
                    type: 'dm',
                    unreadCount: 0,
                    createdAt: new Date().toISOString()
                });
                saveChatData();
            }
            
            updateRoomListUI();
            alert('1:1 매칭이 완료되었습니다!');
        }

        // 그룹 매칭 상태 업데이트
        function updateGroupMatchingStatus() {
            const maleCount = groupMatchingQueue.male.length;
            const femaleCount = groupMatchingQueue.female.length;
            const totalCount = maleCount + femaleCount;
            
            const matchingText = document.querySelector('#groupMatchingStatus .matching-text');
            if (matchingText) {
                if (totalCount < 3) {
                    matchingText.textContent = `매칭 중... (대기자: 남자 ${maleCount}명, 여자 ${femaleCount}명)`;
                } else {
                    matchingText.textContent = `비율 맞춤 중... (대기자: 남자 ${maleCount}명, 여자 ${femaleCount}명)`;
                }
            }
        }

        // 그룹 매칭 시도 (남녀 비율 체크)
        function tryGroupMatching() {
            const maleCount = groupMatchingQueue.male.length;
            const femaleCount = groupMatchingQueue.female.length;
            const totalCount = maleCount + femaleCount;
            
            // 최소 3명 이상이어야 그룹 매칭 가능
            if (totalCount < 3) {
                // 대기 상태 유지
                setTimeout(() => {
                    if (groupMatching) {
                        tryGroupMatching();
                    }
                }, 2000);
                return;
            }
            
            // 남녀 비율 체크 (5:5 ~ 2:1 범위)
            let canFormGroup = false;
            let groupMembers = [];
            
            // 가능한 그룹 조합 찾기
            for (let groupSize = 3; groupSize <= 6; groupSize++) {
                for (let maleInGroup = 1; maleInGroup <= groupSize - 1; maleInGroup++) {
                    const femaleInGroup = groupSize - maleInGroup;
                    
                    // 비율 체크: 5:5 ~ 2:1 범위
                    const ratio = Math.max(maleInGroup, femaleInGroup) / Math.min(maleInGroup, femaleInGroup);
                    if (ratio <= 2 && maleInGroup <= maleCount && femaleInGroup <= femaleCount) {
                        canFormGroup = true;
                        
                        // 그룹 멤버 선택 (대기열에서 제거)
                        groupMembers = [
                            ...groupMatchingQueue.male.splice(0, maleInGroup),
                            ...groupMatchingQueue.female.splice(0, femaleInGroup)
                        ];
                        break;
                    }
                }
                if (canFormGroup) break;
            }
            
            if (canFormGroup && groupMembers.length > 0) {
                // 그룹 매칭 완료
                completeGroupMatching(groupMembers);
            } else {
                // 비율이 맞지 않아 대기
                setTimeout(() => {
                    if (groupMatching) {
                        tryGroupMatching();
                    }
                }, 2000);
            }
        }

        // 그룹 매칭 완료 (3-6명 제한, 남녀 비율 유지)
        function completeGroupMatching(groupMembers) {
            groupMatching = false;
            clearInterval(groupTimer);
            document.getElementById('startGroup').style.display = 'block';
            document.getElementById('groupMatchingStatus').style.display = 'none';
            
            const groupNumber = chatData.roomList.filter(room => room.type === 'group').length + 1;
            const participantCount = groupMembers.length;
            
            // 그룹 랜덤 채팅용 참여자 정보 생성
            const groupRoomName = `그룹 ${groupNumber}`;
            roomParticipants[groupRoomName] = {
                count: participantCount,
                users: groupMembers.map(member => member.nickname),
                unreadCount: 0
            };
            
            // 완성된 그룹을 대기열에 저장
            groupMatchingQueue.groups.push({
                roomName: groupRoomName,
                members: groupMembers,
                createdAt: Date.now()
            });
            
            // 채팅방 데이터에 추가
            if (!chatData.rooms[groupRoomName]) {
                chatData.rooms[groupRoomName] = [];
            }
            
            // 채팅방 목록에 추가
            chatData.roomList.push({
                name: groupRoomName,
                type: 'group',
                unreadCount: 0,
                participantCount: participantCount,
                createdAt: new Date().toISOString()
            });
            
            saveChatData();
            updateRoomListUI();
            
            // 남녀 비율 정보 표시
            const maleCount = groupMembers.filter(m => m.gender === '남자').length;
            const femaleCount = groupMembers.filter(m => m.gender === '여자').length;
            alert(`그룹 매칭이 완료되었습니다! (${participantCount}명, 남자 ${maleCount}명, 여자 ${femaleCount}명)`);
        }

        // 매칭 취소
        function cancelRandomMatching() {
            randomMatching = false;
            clearInterval(randomTimer);
      document.getElementById('startRandom').style.display = 'block';
      document.getElementById('randomMatchingStatus').style.display = 'none';
        }

        function cancelGroupMatching() {
            // 현재 사용자를 대기열에서 제거
            const currentProfile = JSON.parse(localStorage.getItem('anonProfile') || 'null');
            const currentUserNickname = currentProfile?.nickname || '익명의친구';
            
            // 남자 대기열에서 제거
            groupMatchingQueue.male = groupMatchingQueue.male.filter(user => user.nickname !== currentUserNickname);
            // 여자 대기열에서 제거
            groupMatchingQueue.female = groupMatchingQueue.female.filter(user => user.nickname !== currentUserNickname);
            
            groupMatching = false;
            clearInterval(groupTimer);
      document.getElementById('startGroup').style.display = 'block';
      document.getElementById('groupMatchingStatus').style.display = 'none';
    }

    // 채팅방 생성
    function createRoom(listId, roomName) {
      const list = document.getElementById(listId);
      const li = document.createElement('li');
      const participantCount = roomParticipants[roomName]?.count || 0;
      const unreadCount = roomParticipants[roomName]?.unreadCount || 0;
      
      // 1:1 채팅인지 그룹 채팅인지 구분
      const isGroupChat = listId === 'roomList';
      
      li.innerHTML = `
        <div class="room-info">
          <div class="room-name-wrapper">
            <span class="room-name">${roomName}</span>
            ${unreadCount > 0 ? `<span class="unread-badge">${unreadCount}</span>` : ''}
          </div>
          ${isGroupChat ? `<span class="participant-count">${participantCount}명</span>` : ''}
        </div>
      `;
      li.addEventListener('click', () => enterRoom(roomName));
      list.appendChild(li);
    }

        // 현재 활성 채팅방
        let currentRoom = null;
        
        // 랜덤 매칭 프로필 데이터
        const randomProfiles = [
            { name: '안녕', year: '23학번', gender: '남자', bio: '나도 좋아', avatar: '안', interests: ['운동', '음악'] },
            { name: '민지', year: '22학번', gender: '여자', bio: '독서와 카페 좋아해요', avatar: '민', interests: ['독서', '영화'] },
            { name: '철수', year: '21학번', gender: '남자', bio: '운동 같이 하실 분!', avatar: '철', interests: ['운동', '게임'] },
            { name: '지현', year: '24학번', gender: '여자', bio: '영화 덕후에요', avatar: '지', interests: ['영화', '음악'] },
            { name: '준호', year: '23학번', gender: '남자', bio: '게임 좋아해요', avatar: '준', interests: ['게임', '운동'] },
            { name: '수진', year: '22학번', gender: '여자', bio: '요리 배우고 싶어요', avatar: '수', interests: ['요리', '독서'] }
        ];
        
        // 채팅방별 참여자 정보 (관심사별 그룹 채팅 - 인원수 제한 없음)
        const roomParticipants = {
            '운동': {
                count: 12,
                users: ['김철수', '이영희', '박민수', '최지영', '정현우', '한소영', '윤태호', '강미래', '임동현', '서유진', '조성민', '배수진'],
                unreadCount: 0
            },
            '게임': {
                count: 8,
                users: ['최준호', '김가은', '이현수', '박서연', '정민재', '한지은', '윤성호', '강다은'],
                unreadCount: 0
            },
            '음악': {
                count: 15,
                users: ['김하늘', '이준서', '박예린', '최민석', '정소영', '한지훈', '윤서현', '강민지', '임태현', '서유나', '조현우', '배서영', '김도현', '이수진', '박재민'],
                unreadCount: 0
            },
            '영화': {
                count: 10,
                users: ['최유진', '김태민', '이서영', '박준호', '정미래', '한동현', '윤소영', '강현우', '임지은', '서민수'],
                unreadCount: 0
            },
            '독서': {
                count: 7,
                users: ['조예준', '배서현', '김민재', '이유진', '박현수', '최지영', '한태호'],
                unreadCount: 0
            },
            '요리': {
                count: 9,
                users: ['윤소영', '강민수', '임지훈', '서예린', '조현우', '배다은', '김태현', '이서영', '박준호'],
                unreadCount: 0
            }
        };

        // 채팅방 입장
        function enterRoom(roomName) {
            currentRoom = roomName;
            document.getElementById('chatHeader').textContent = roomName;
            document.getElementById('chatContent').style.display = 'none';
            document.getElementById('chatRoom').style.display = 'block';
            
            // 관심분야 방인 경우 참여자 수 증가
            const roomData = chatData.roomList.find(room => room.name === roomName);
            if (roomData && roomData.type === 'interest') {
                incrementParticipantCount(roomName);
            }
            
            // 참여자 수 표시 (그룹 채팅방인 경우에만)
            const participantCount = roomParticipants[roomName]?.count || 0;
            const participantCountElement = document.getElementById('participantCount');
            
            if (roomParticipants[roomName]) {
                // 그룹 채팅방
                participantCountElement.textContent = `현재 ${participantCount}명 참여중`;
                participantCountElement.style.display = 'block';
            } else {
                // 1:1 채팅방
                participantCountElement.textContent = `1:1 채팅`;
                participantCountElement.style.display = 'block';
            }
            
            // 버튼들 표시
            document.getElementById('backToHome').style.display = 'inline-flex';
            document.getElementById('chatOptions').style.display = 'inline-flex';
            
            // 읽지 않은 메시지 수 초기화
            if (roomParticipants[roomName]) {
                roomParticipants[roomName].unreadCount = 0;
                updateRoomUnreadCount(roomName);
            }
            
            // 채팅방 목록에서 읽지 않은 메시지 수 초기화
            if (roomData) {
                roomData.unreadCount = 0;
                saveChatData();
                updateRoomListUI();
            }
            
            // 활성 상태 업데이트
            document.querySelectorAll('.room-list li, #dmList li').forEach(li => {
                li.classList.remove('active');
                if (li.textContent.includes(roomName)) {
                    li.classList.add('active');
                }
            });
            
            // 저장된 메시지 로드
            loadRoomMessages(roomName);
        }

        // 채팅방 메시지 로드
        function loadRoomMessages(roomName) {
            const messages = document.getElementById('messages');
            messages.innerHTML = '';
            
            if (chatData.rooms[roomName] && chatData.rooms[roomName].length > 0) {
                // 저장된 메시지 표시
                chatData.rooms[roomName].forEach(messageData => {
                    const messageWrapper = document.createElement('div');
                    messageWrapper.className = `msg-wrapper ${messageData.isMe ? 'me' : ''}`;
                    
                    const messageDiv = document.createElement('div');
                    messageDiv.className = `msg ${messageData.isMe ? 'me' : ''}`;
                    
                    if (messageData.isMe) {
                        // 내 메시지
                        messageDiv.innerHTML = `
                            <div class="msg-content">${messageData.text}</div>
                            <div class="msg-time">${messageData.timeString}</div>
                        `;
                    } else {
                        // 상대방 메시지
                        messageDiv.innerHTML = `
                            <div class="msg-nickname">${messageData.nickname}</div>
                            <div class="msg-content">${messageData.text}</div>
                            <div class="msg-time">${messageData.timeString}</div>
                        `;
                    }
                    
                    messageWrapper.appendChild(messageDiv);
                    messages.appendChild(messageWrapper);
                });
            } else {
                // 첫 입장 메시지
                addMessage('채팅방에 입장했습니다.', false);
            }
            
            messages.scrollTop = messages.scrollHeight;
        }

        // 메시지 전송
        function sendMessage() {
            const messageInput = document.getElementById('messageInput');
            const message = messageInput.value.trim();
            
            if (message && currentRoom) {
        addMessage(message, true);
                messageInput.value = '';
                
        // 시연용 자동 응답
                setTimeout(() => {
                    const responses = [
                        '안녕하세요!',
                        '네, 맞습니다.',
                        '정말요?',
                        '흥미롭네요!',
                        '그렇군요.',
            '좋은 생각이에요!',
            '어떻게 생각하세요?',
            '맞아요!'
                    ];
                    const randomResponse = responses[Math.floor(Math.random() * responses.length)];
          addMessage(randomResponse, false);
          
          // 다른 방에 읽지 않은 메시지 수 증가 (테스트용)
          if (Math.random() > 0.7) { // 30% 확률로 다른 방에 메시지 도착
            const rooms = Object.keys(roomParticipants);
            const randomRoom = rooms[Math.floor(Math.random() * rooms.length)];
            if (randomRoom !== currentRoom) {
              incrementUnreadCount(randomRoom);
            }
          }
                }, Math.random() * 2000 + 1000);
            }
        }

    // 랜덤 매칭 홈으로 돌아가기
    function backToHome() {
      currentRoom = null;
      document.getElementById('chatHeader').textContent = '랜덤 매칭';
      document.getElementById('chatContent').style.display = 'block';
      document.getElementById('chatRoom').style.display = 'none';
      
      // 참여자 수와 버튼들 숨기기
      document.getElementById('participantCount').style.display = 'none';
      document.getElementById('backToHome').style.display = 'none';
      document.getElementById('chatOptions').style.display = 'none';
      document.getElementById('chatOptionsDropdown').style.display = 'none';
      
      // 활성 채팅방 선택 해제
      document.querySelectorAll('.room-list li').forEach(li => {
        li.classList.remove('active');
      });
        }

        // 메시지 추가
        function addMessage(text, isMe, nickname = null) {
            if (!currentRoom) return;
            
            const messages = document.getElementById('messages');
            
            // 현재 시간 생성
            const now = new Date();
            const timeString = now.toLocaleTimeString('ko-KR', { 
                hour: '2-digit', 
                minute: '2-digit',
                hour12: false 
            });
            
            // 메시지 데이터 생성
            const messageData = {
                text: text,
                isMe: isMe,
                nickname: isMe ? (JSON.parse(localStorage.getItem('anonProfile') || '{}').nickname || '나') : (nickname || getRandomNickname()),
                timestamp: now.toISOString(),
                timeString: timeString
            };
            
            // 채팅 데이터에 저장
            if (!chatData.rooms[currentRoom]) {
                chatData.rooms[currentRoom] = [];
            }
            chatData.rooms[currentRoom].push(messageData);
            saveChatData();
            
            // 메시지 래퍼 생성
            const messageWrapper = document.createElement('div');
            messageWrapper.className = `msg-wrapper ${isMe ? 'me' : ''}`;
            
            const messageDiv = document.createElement('div');
            messageDiv.className = `msg ${isMe ? 'me' : ''}`;
            
            if (isMe) {
                // 내 메시지
                messageDiv.innerHTML = `
                    <div class="msg-content">${text}</div>
                    <div class="msg-time">${timeString}</div>
                `;
            } else {
                // 상대방 메시지 (닉네임 포함)
                messageDiv.innerHTML = `
                    <div class="msg-nickname">${messageData.nickname}</div>
                    <div class="msg-content">${text}</div>
                    <div class="msg-time">${timeString}</div>
                `;
            }
            
            messageWrapper.appendChild(messageDiv);
            messages.appendChild(messageWrapper);
            messages.scrollTop = messages.scrollHeight;
        }

        // 랜덤 닉네임 생성
        function getRandomNickname() {
            // 1:1 채팅방인 경우 채팅방 이름을 닉네임으로 사용
            const roomData = chatData.roomList.find(room => room.name === currentRoom);
            if (roomData && roomData.type === 'dm') {
                return currentRoom;
            }
            
            // 그룹 채팅방이나 관심분야 방인 경우
            if (currentRoom && roomParticipants[currentRoom]) {
                const users = roomParticipants[currentRoom].users;
                // 실제 사용자 닉네임 중에서 랜덤 선택
                return users[Math.floor(Math.random() * users.length)];
            }
            
            // 기본값
            return '익명' + Math.floor(Math.random() * 100);
        }

    // 채팅 옵션 관련 함수들
    function toggleChatOptions() {
      const dropdown = document.getElementById('chatOptionsDropdown');
      const optionsBtn = document.getElementById('chatOptions');
      
      if (dropdown.style.display === 'none' || dropdown.style.display === '') {
        // 드롭다운 위치 계산
        const btnRect = optionsBtn.getBoundingClientRect();
        dropdown.style.top = (btnRect.bottom + 8) + 'px';
        dropdown.style.right = (window.innerWidth - btnRect.right) + 'px';
        dropdown.style.display = 'block';
      } else {
        dropdown.style.display = 'none';
      }
    }
    
    function showParticipants() {
      const participantsList = document.getElementById('participantsList');
      participantsList.innerHTML = '';
      
      if (currentRoom && roomParticipants[currentRoom]) {
        // 그룹 채팅방인 경우
        const users = roomParticipants[currentRoom].users;
        
        users.forEach((user, index) => {
          const participantItem = document.createElement('div');
          participantItem.className = 'participant-item';
          participantItem.onclick = () => showParticipantProfile(user);
          
          participantItem.innerHTML = `
            <div class="participant-avatar">👤</div>
            <div class="participant-info">
              <div class="participant-name">${user}</div>
              <div class="participant-status">온라인</div>
            </div>
            <div class="participant-profile">프로필 보기</div>
          `;
          
          participantsList.appendChild(participantItem);
        });
      } else {
        // 1:1 채팅방인 경우 (상대방과 나)
        const currentUser = localStorage.getItem('anonProfile') ? 
          JSON.parse(localStorage.getItem('anonProfile')).nickname : '익명의친구';
        const opponentName = currentRoom; // 1:1 채팅에서는 방 이름이 상대방 이름
        
        // 상대방 프로필
        const opponentItem = document.createElement('div');
        opponentItem.className = 'participant-item';
        opponentItem.onclick = () => showParticipantProfile(opponentName);
        
        opponentItem.innerHTML = `
          <div class="participant-avatar">👤</div>
          <div class="participant-info">
            <div class="participant-name">${opponentName}</div>
            <div class="participant-status">온라인</div>
          </div>
          <div class="participant-profile">프로필 보기</div>
        `;
        participantsList.appendChild(opponentItem);
        
        // 내 프로필
        const myItem = document.createElement('div');
        myItem.className = 'participant-item';
        myItem.onclick = () => showParticipantProfile(currentUser);
        
        myItem.innerHTML = `
          <div class="participant-avatar">👤</div>
          <div class="participant-info">
            <div class="participant-name">${currentUser} (나)</div>
            <div class="participant-status">온라인</div>
          </div>
          <div class="participant-profile">프로필 보기</div>
        `;
        participantsList.appendChild(myItem);
      }
      
      document.getElementById('participantsModal').style.display = 'flex';
      document.getElementById('chatOptionsDropdown').style.display = 'none';
    }
    
    function closeParticipantsModal() {
      document.getElementById('participantsModal').style.display = 'none';
    }
    
    function showParticipantProfile(nickname) {
      // 내 프로필인지 확인
      const currentUser = localStorage.getItem('anonProfile') ? 
        JSON.parse(localStorage.getItem('anonProfile')).nickname : '익명의친구';
      
      let profile;
      
      if (nickname === currentUser || nickname.includes('(나)')) {
        // 내 프로필인 경우
        const myProfile = localStorage.getItem('anonProfile') ? 
          JSON.parse(localStorage.getItem('anonProfile')) : null;
        
        profile = myProfile ? {
          year: myProfile.year,
          gender: myProfile.gender,
          bio: myProfile.bio,
          interests: myProfile.interests
        } : {
          year: '2024',
          gender: '남자',
          bio: '새로운 친구를 만나고 싶어요!',
          interests: ['운동', '음악']
        };
      } else {
        // 다른 사용자 프로필인 경우
        const mockProfiles = {
          '익명1': { year: '2024', gender: '남자', bio: '운동을 좋아하는 학생입니다.', interests: ['운동', '음악'] },
          '익명2': { year: '2023', gender: '여자', bio: '독서와 영화를 즐깁니다.', interests: ['독서', '영화'] },
          '익명3': { year: '2025', gender: '남자', bio: '게임과 요리를 좋아해요.', interests: ['게임', '요리'] },
          '익명4': { year: '2024', gender: '여자', bio: '음악을 사랑합니다.', interests: ['음악', '운동'] },
          '익명5': { year: '2023', gender: '남자', bio: '영화 감상을 좋아해요.', interests: ['영화', '독서'] },
          '안녕': { year: '23학번', gender: '남자', bio: '나도 좋아', interests: ['운동', '음악'] },
          '민지': { year: '22학번', gender: '여자', bio: '독서와 카페 좋아해요', interests: ['독서', '영화'] },
          '철수': { year: '21학번', gender: '남자', bio: '운동 같이 하실 분!', interests: ['운동', '게임'] },
          '지현': { year: '24학번', gender: '여자', bio: '영화 덕후에요', interests: ['영화', '음악'] },
          '준호': { year: '23학번', gender: '남자', bio: '게임 좋아해요', interests: ['게임', '운동'] },
          '수진': { year: '22학번', gender: '여자', bio: '요리 배우고 싶어요', interests: ['요리', '독서'] }
        };
        
        // 기본 프로필 정보 생성 (랜덤)
        const defaultProfiles = [
          { year: '2024', gender: '남자', bio: '새로운 친구를 만나고 싶어요!', interests: ['운동', '음악'] },
          { year: '2023', gender: '여자', bio: '재미있는 대화를 좋아해요.', interests: ['독서', '영화'] },
          { year: '2025', gender: '남자', bio: '게임과 요리를 좋아해요.', interests: ['게임', '요리'] },
          { year: '2024', gender: '여자', bio: '음악을 사랑합니다.', interests: ['음악', '운동'] },
          { year: '2023', gender: '남자', bio: '영화 감상을 좋아해요.', interests: ['영화', '독서'] }
        ];
        
        const randomProfile = defaultProfiles[Math.floor(Math.random() * defaultProfiles.length)];
        profile = mockProfiles[nickname] || randomProfile;
      }
      
      const profileContent = document.getElementById('participantProfileContent');
      profileContent.innerHTML = `
        <div class="profile-avatar-large">👤</div>
        <h4 style="margin: 0 0 8px 0; color: #374151;">${nickname}</h4>
        <div class="profile-details">
          <div class="profile-detail-item">
            <span class="profile-detail-label">학번</span>
            <span class="profile-detail-value">${profile.year}</span>
          </div>
          <div class="profile-detail-item">
            <span class="profile-detail-label">성별</span>
            <span class="profile-detail-value">${profile.gender}</span>
          </div>
          <div class="profile-detail-item">
            <span class="profile-detail-label">소개</span>
            <span class="profile-detail-value">${profile.bio}</span>
          </div>
          <div class="profile-detail-item">
            <span class="profile-detail-label">관심사</span>
            <span class="profile-detail-value">${profile.interests.join(', ')}</span>
          </div>
        </div>
      `;
      
      document.getElementById('participantProfileModal').style.display = 'flex';
      closeParticipantsModal();
    }
    
    function closeParticipantProfileModal() {
      document.getElementById('participantProfileModal').style.display = 'none';
    }
    
    
    function leaveChatRoom() {
      if (confirm('정말로 채팅방을 나가시겠습니까?')) {
        if (!currentRoom) return;
        
        // 채팅방 목록에서 제거
        chatData.roomList = chatData.roomList.filter(room => room.name !== currentRoom);
        
        // 채팅 기록 삭제
        if (chatData.rooms[currentRoom]) {
            delete chatData.rooms[currentRoom];
        }
        
        // 그룹 채팅방인 경우 참여자 수 감소
        if (roomParticipants[currentRoom]) {
          roomParticipants[currentRoom].count = Math.max(0, roomParticipants[currentRoom].count - 1);
          
          // 참여자 목록에서 현재 사용자 제거 (실제로는 서버에서 처리해야 함)
          const currentUser = localStorage.getItem('anonProfile') ? 
            JSON.parse(localStorage.getItem('anonProfile')).nickname : '익명의친구';
          const userIndex = roomParticipants[currentRoom].users.indexOf(currentUser);
          if (userIndex > -1) {
            roomParticipants[currentRoom].users.splice(userIndex, 1);
          }
        }
        
        // 데이터 저장 및 UI 업데이트
        saveChatData();
        updateRoomListUI();
        
        // 홈으로 돌아가기
        backToHome();
        alert('채팅방에서 나갔습니다.');
      }
      document.getElementById('chatOptionsDropdown').style.display = 'none';
    }
    
    // 방별 참여자 수 업데이트
    function updateRoomParticipantCount(roomName) {
      document.querySelectorAll('.room-list li').forEach(li => {
        const roomInfo = li.querySelector('.room-info');
        if (roomInfo) {
          const roomNameSpan = roomInfo.querySelector('.room-name');
          if (roomNameSpan && roomNameSpan.textContent === roomName) {
            const countSpan = roomInfo.querySelector('.participant-count');
            const newCount = roomParticipants[roomName]?.count || 0;
            countSpan.textContent = `${newCount}명`;
          }
        }
      });
    }
    
    // 방별 읽지 않은 메시지 수 업데이트
    function updateRoomUnreadCount(roomName) {
      document.querySelectorAll('.room-list li').forEach(li => {
        const roomInfo = li.querySelector('.room-info');
        if (roomInfo) {
          const roomNameSpan = roomInfo.querySelector('.room-name');
          if (roomNameSpan && roomNameSpan.textContent === roomName) {
            const roomNameWrapper = roomInfo.querySelector('.room-name-wrapper');
            const unreadCount = roomParticipants[roomName]?.unreadCount || 0;
            
            // 기존 배지 제거
            const existingBadge = roomNameWrapper.querySelector('.unread-badge');
            if (existingBadge) {
              existingBadge.remove();
            }
            
            // 새 배지 추가 (읽지 않은 메시지가 있을 때만)
            if (unreadCount > 0) {
              const badge = document.createElement('span');
              badge.className = 'unread-badge';
              badge.textContent = unreadCount;
              roomNameWrapper.appendChild(badge);
            }
          }
        }
      });
    }
    
    // 읽지 않은 메시지 수 증가 (상대방 메시지 수신 시)
    function incrementUnreadCount(roomName) {
      if (roomName !== currentRoom && roomParticipants[roomName]) {
        roomParticipants[roomName].unreadCount++;
        updateRoomUnreadCount(roomName);
      }
    }
    
    // 랜덤 매칭 프로필 생성
    function generateRandomProfiles() {
      const container = document.getElementById('profileCardsContainer');
      container.innerHTML = '';
      
      randomProfiles.forEach(profile => {
        const card = document.createElement('div');
        card.className = 'random-profile-card';
        card.innerHTML = `
          <div class="random-profile-avatar">${profile.avatar}</div>
          <div class="random-profile-name">${profile.name}</div>
          <div class="random-profile-details">${profile.year} · ${profile.gender}</div>
          <div class="random-profile-bio">${profile.bio}</div>
          <button class="random-profile-btn" onclick="viewProfile('${profile.name}')">프로필 보기</button>
        `;
        container.appendChild(card);
      });
    }
    
    // 프로필 보기
    function viewProfile(profileName) {
      const profile = randomProfiles.find(p => p.name === profileName);
      if (profile) {
        const modalContent = document.getElementById('profileDetailContent');
        
        // 관심사 태그 생성
        const interestsHtml = profile.interests.map(interest => 
          `<span class="profile-detail-interest-tag">${interest}</span>`
        ).join('');
        
        modalContent.innerHTML = `
          <div class="profile-detail-avatar">${profile.avatar}</div>
          <div class="profile-detail-name">${profile.name}</div>
          <div class="profile-detail-info">${profile.year} · ${profile.gender}</div>
          <div class="profile-detail-bio">${profile.bio}</div>
          <div class="profile-detail-interests">
            <div class="profile-detail-interests-title">관심사</div>
            <div class="profile-detail-interests-list">
              ${interestsHtml}
            </div>
          </div>
          <div class="profile-detail-actions">
            <button class="profile-detail-btn secondary" onclick="closeProfileDetailModal()">닫기</button>
          </div>
        `;
        
        document.getElementById('profileDetailModal').style.display = 'flex';
      }
    }
    
    // 프로필 상세 모달 닫기
    function closeProfileDetailModal() {
      document.getElementById('profileDetailModal').style.display = 'none';
    }
    
    
    // 프로필 캐러셀 스크롤
    function scrollProfiles(direction) {
      const container = document.getElementById('profileCardsContainer');
      const scrollAmount = 220; // 카드 너비 + 간격
      container.scrollBy({
        left: direction * scrollAmount,
        behavior: 'smooth'
      });
    }

    // 이벤트 리스너
    document.addEventListener('DOMContentLoaded', function() {
      // 년도 설정
      document.getElementById('year').textContent = new Date().getFullYear();
      
      // 채팅 데이터 로드
      loadChatData();
      updateRoomListUI();
      
      // 채팅 옵션 버튼 이벤트
      document.getElementById('chatOptions').addEventListener('click', toggleChatOptions);
      
      // 드롭다운 외부 클릭 시 닫기
      document.addEventListener('click', function(e) {
        const dropdown = document.getElementById('chatOptionsDropdown');
        const optionsBtn = document.getElementById('chatOptions');
        
        if (!dropdown.contains(e.target) && !optionsBtn.contains(e.target)) {
          dropdown.style.display = 'none';
        }
      });
      
      // 모달 외부 클릭 시 닫기
      document.addEventListener('click', function(e) {
        const participantsModal = document.getElementById('participantsModal');
        const participantProfileModal = document.getElementById('participantProfileModal');
        const profileDetailModal = document.getElementById('profileDetailModal');
        
        if (e.target === participantsModal) {
          closeParticipantsModal();
        }
        
        if (e.target === participantProfileModal) {
          closeParticipantProfileModal();
        }
        
        if (e.target === profileDetailModal) {
          closeProfileDetailModal();
        }
      });
      
      loadAnonProfile();
      
      // 랜덤 매칭 프로필 생성
      generateRandomProfiles();
      
      // 기본 관심분야 방들을 채팅방 목록에 추가
      initializeDefaultInterestRooms();
      
      // 매칭 버튼
      document.getElementById('startRandom').addEventListener('click', startRandomMatching);
      document.getElementById('startGroup').addEventListener('click', startGroupMatching);
      document.getElementById('cancelRandom').addEventListener('click', cancelRandomMatching);
      document.getElementById('cancelGroup').addEventListener('click', cancelGroupMatching);
      
      // 메시지 전송
        document.getElementById('sendButton').addEventListener('click', sendMessage);
        document.getElementById('messageInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });

      // 랜덤 매칭 홈으로 돌아가기
      document.getElementById('backToHome').addEventListener('click', backToHome);

      // 모바일 메뉴는 navigation.js에서 처리됩니다
    });
    </script>