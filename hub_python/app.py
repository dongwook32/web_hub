import os
from flask import Flask, request, jsonify, render_template, session, redirect, url_for
from whitenoise import WhiteNoise
from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
from flask_cors import CORS
import uuid
import sib_api_v3_sdk
from sib_api_v3_sdk.rest import ApiException
from datetime import timedelta

# --- 초기 설정 ---
app = Flask(__name__)
app.wsgi_app = WhiteNoise(app.wsgi_app, root="static/", prefix="static/")
CORS(app)

# ✅ [수정됨] 로컬 환경과 Render 배포 환경을 구분하여 설정을 자동으로 변경합니다.
# --------------------------------------------------------------------------
# Render 서버에서 실행될 때 (환경 변수 'RENDER'가 존재할 때)
if os.environ.get('RENDER'):
    app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL')
    app.config['SENDINBLUE_API_KEY'] = os.environ.get('SENDINBLUE_API_KEY')
    app.secret_key = os.environ.get('SECRET_KEY')
# 내 컴퓨터(로컬)에서 실행될 때
else:
    # 데이터베이스는 프로젝트 폴더에 'local_db.sqlite' 파일을 생성하여 사용합니다.
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///local_db.sqlite'
    # 이메일 API 키는 로컬에 없으므로 None으로 설정됩니다. (이메일 발송 기능은 로컬에서 테스트 불가)
    app.config['SENDINBLUE_API_KEY'] = None 
    # 로컬 테스트를 위한 임시 시크릿 키를 설정합니다.
    app.secret_key = 'LOCAL_DEV_SECRET_KEY' 
# --------------------------------------------------------------------------

app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(hours=1)

db = SQLAlchemy(app)
bcrypt = Bcrypt(app)


# --- 데이터베이스 모델 정의 ---
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.String(20), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)
    
    # ✅ [변경됨] 닉네임 -> 이름으로 변경, 생년월일, 재학상태 추가
    name = db.Column(db.String(50), nullable=False) 
    nickname = db.Column(db.String(50), unique=True, nullable=False) # 닉네임은 중복확인을 위해 유지
    birthdate = db.Column(db.String(20), nullable=False)
    status = db.Column(db.String(20), nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=False)
    
    # ✅ [추가됨] 관리자 여부를 표시하는 컬럼. 기본값은 False(일반 사용자)
    is_admin = db.Column(db.Boolean, default=False, nullable=False)

class EmailVerification(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(100), nullable=False)
    token = db.Column(db.String(100), unique=True, nullable=False)


# --- 이메일 발송 함수 ---
def send_verification_email(to_email, token):
    # ✅ [수정됨] 로컬에서는 API 키가 없으므로 이메일 발송을 시도하지 않도록 처리
    if not app.config['SENDINBLUE_API_KEY']:
        print("="*50)
        print("로컬 환경에서는 이메일이 실제로 발송되지 않습니다.")
        print(f"인증 링크: http://127.0.0.1:5000/verify/{token}")
        print("="*50)
        return True # 로컬 테스트를 위해 성공한 것처럼 처리

    configuration = sib_api_v3_sdk.Configuration()
    configuration.api_key['api-key'] = app.config['SENDINBLUE_API_KEY']
    api_instance = sib_api_v3_sdk.TransactionalEmailsApi(sib_api_v3_sdk.ApiClient(configuration))
    
    subject = "[KBU Hub] 이메일 인증을 완료해주세요."
    # ✅ [수정됨] 로컬 테스트를 위해 인증 링크 주소를 동적으로 변경
    base_url = "https://kbuhub.onrender.com" if os.environ.get('RENDER') else "http://127.0.0.1:5000"
    verification_link = f"{base_url}/verify/{token}"

    html_content = f"가입을 완료하려면 링크를 클릭하세요: <a href='{verification_link}'>인증하기</a>"
    sender = {"name": "KBU Hub 관리자", "email": "dongwook219@gmail.com"}
    to = [{"email": to_email}]
    
    send_smtp_email = sib_api_v3_sdk.SendSmtpEmail(to=to, html_content=html_content, sender=sender, subject=subject)

    try:
        api_instance.send_transac_email(send_smtp_email)
        return True
    except ApiException as e:
        print(f"Exception: {e}\n")
        return False


# --- 라우트 (페이지 및 API) 정의 ---

@app.route('/')
def main_page():
    nickname = session.get('nickname')
    return render_template('index.html', nickname=nickname)

@app.route('/login-page')
def login_page():
    return render_template('login.html')

@app.route('/signup-terms')
def signup_terms_page():
    return render_template('certify.html')

@app.route('/signup-page')
def signup_email_page():
    return render_template('email_signup.html')

@app.route('/verify/<token>')
def show_signup_form(token):
    verification_data = EmailVerification.query.filter_by(token=token).first()
    if verification_data:
        return render_template('signup.html', user_email=verification_data.email, token=token)
    else:
        return "유효하지 않거나 만료된 인증 링크입니다.", 404

# --- 기타 페이지 라우트 ---
@app.route('/chat')
def chat_page():
    if 'user_id' not in session:
        return redirect(url_for('login_page'))
    nickname = session.get('nickname')
    return render_template('chat.html', nickname=nickname)

@app.route('/boards')
def boards_page():
    if 'user_id' not in session:
        return redirect(url_for('login_page'))
    nickname = session.get('nickname')
    return render_template('boards.html', nickname=nickname)

@app.route('/mypage')
def mypage_page():
    if 'user_id' not in session:
        return redirect(url_for('login_page'))
    nickname = session.get('nickname')
    return render_template('mypage.html', nickname=nickname)

# --- API 라우트들 ---
@app.route('/send-verification', methods=['POST'])
def start_verification():
    email = request.json['email']
    if not email.endswith('@bible.ac.kr'):
        return jsonify({"error": "성서대학교 이메일만 사용할 수 있습니다."}), 400
    if User.query.filter_by(email=email).first():
        return jsonify({"error": "이미 가입된 이메일입니다."}), 409
    token = str(uuid.uuid4())
    new_verification = EmailVerification(email=email, token=token)
    db.session.add(new_verification)
    db.session.commit()
    if send_verification_email(email, token):
        return jsonify({"message": "인증 이메일이 발송되었습니다. (로컬에서는 터미널을 확인하세요)"})
    else:
        return jsonify({"error": "이메일 발송에 실패했습니다."}), 500

@app.route('/signup', methods=['POST'])
def signup():
    data = request.json
    token = data.get('token')
    
    # 토큰 유효성 검사
    verification_data = EmailVerification.query.filter_by(token=token).first()
    if not verification_data:
        return jsonify({"error": "유효하지 않은 인증 세션입니다. 다시 시도해주세요."}), 400

    email = verification_data.email
    
    # 프론트엔드로부터 모든 데이터 받아오기
    student_id = data.get('student_id')
    name = data.get('name')
    birthdate = data.get('birthdate')
    status = data.get('status')
    password = data.get('password')

    # ✅ [수정됨] 닉네임을 '이름' 필드 값으로 설정
    nickname = name 

    # 모든 필드가 제대로 들어왔는지 서버에서 다시 한번 확인
    if not all([student_id, name, nickname, birthdate, status, password]):
        return jsonify({"error": "서버 오류: 일부 데이터가 누락되었습니다."}), 400

    # 학번 또는 닉네임(이름) 중복 확인
    if User.query.filter_by(student_id=student_id).first():
        return jsonify({"error": "이미 사용 중인 학번입니다."}), 409
    if User.query.filter_by(nickname=nickname).first():
         return jsonify({"error": "이미 가입된 이름입니다. 관리자에게 문의하세요."}), 409
    
    password_hash = bcrypt.generate_password_hash(password).decode('utf-8')
    
    new_user = User(
        email=email,
        student_id=student_id,
        password_hash=password_hash,
        name=name,
        nickname=nickname,
        birthdate=birthdate,
        status=status
    )
    
    # 데이터베이스에 최종 저장
    db.session.add(new_user)
    db.session.delete(verification_data) # 사용된 인증 토큰은 삭제
    db.session.commit()
    
    return jsonify({"message": "회원가입이 완료되었습니다! 로그인 페이지로 이동합니다."}), 201

@app.route('/login', methods=['POST'])
def login():
    data = request.json
    student_id = data.get('student_id')
    password = data.get('password')
    user = User.query.filter_by(student_id=student_id).first()
    if user and bcrypt.check_password_hash(user.password_hash, password):
        session.permanent = True
        session['user_id'] = user.id
        session['nickname'] = user.nickname
        # ✅ [추가됨] 로그인 시 관리자 여부를 세션에 저장
        session['is_admin'] = user.is_admin 
        return jsonify({"message": "로그인 성공!"}), 200
    else:
        return jsonify({"error": "학번 또는 비밀번호가 일치하지 않습니다."}), 401

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('main_page'))

# --- 관리자 기능 ---

# 임시: 특정 사용자를 관리자로 지정하는 경로 (개발용)
# 사용법: 관리자로 만들 계정으로 회원가입 -> 이 주소 한번 방문 -> 로그아웃 -> 다시 로그인
@app.route('/make-admin')
def make_admin():
    if 'user_id' not in session:
        return "로그인 먼저 하세요.", 403

    # ✅ 본인의 학번으로 변경해서 사용하세요.
    admin_student_id = "202204034" # 여기에 관리자로 지정할 본인의 학번을 넣으세요.

    user = User.query.filter_by(student_id=admin_student_id).first()
    if user:
        user.is_admin = True
        db.session.commit()
        return f"{user.name} 님이 관리자로 지정되었습니다."
    return "해당 학번의 사용자를 찾을 수 없습니다.", 404


# 관리자 페이지: 모든 사용자 정보를 보여줌
@app.route('/admin')
def admin_page():
    # 관리자가 아니면 접근 거부
    if not session.get('is_admin'):
        return redirect(url_for('main_page'))

    all_users = User.query.all()
    nickname = session.get('nickname')
    return render_template('admin.html', users=all_users, nickname=nickname)


@app.route('/admin/toggle_admin/<int:user_id>', methods=['POST'])
def toggle_admin(user_id):
    # 관리자가 아니면 접근 거부
    if not session.get('is_admin'):
        return jsonify({"error": "권한이 없습니다."}), 403

    user_to_toggle = User.query.get(user_id)
    if user_to_toggle:
        # 자기 자신의 권한은 변경할 수 없도록 방지
        if user_to_toggle.id == session.get('user_id'):
            return jsonify({"error": "자기 자신의 권한은 변경할 수 없습니다."}), 400
        
        # is_admin 값을 반대로 변경 (True -> False, False -> True)
        user_to_toggle.is_admin = not user_to_toggle.is_admin
        db.session.commit()
        
        new_status = "관리자" if user_to_toggle.is_admin else "일반 사용자"
        return jsonify({
            "message": f"'{user_to_toggle.name}' 님의 권한이 '{new_status}' (으)로 변경되었습니다.",
            "isAdmin": user_to_toggle.is_admin # 변경된 현재 상태를 프론트엔드로 전달
        })
    
    return jsonify({"error": "사용자를 찾을 수 없습니다."}), 404

# --- 서버 실행 ---
if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True)