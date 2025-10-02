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
    verification_data = EmailVerification.query.filter_by(token=token).first()
    if not verification_data:
        return jsonify({"error": "유효하지 않은 토큰입니다."}), 400
    email = verification_data.email
    student_id = data.get('student_id')
    password = data.get('password')
    nickname = data.get('nickname')
    if not all([student_id, password, nickname]):
        return jsonify({"error": "모든 필드를 입력해주세요."}), 400
    if User.query.filter_by(student_id=student_id).first() or \
       User.query.filter_by(nickname=nickname).first():
        return jsonify({"error": "이미 사용 중인 학번 또는 닉네임입니다."}), 409
    password_hash = bcrypt.generate_password_hash(password).decode('utf-8')
    new_user = User(
        email=email,
        student_id=student_id,
        password_hash=password_hash,
        nickname=nickname
    )
    db.session.add(new_user)
    db.session.delete(verification_data)
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
        return jsonify({"message": "로그인 성공!"}), 200
    else:
        return jsonify({"error": "학번 또는 비밀번호가 일치하지 않습니다."}), 401

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('main_page'))

# --- 서버 실행 ---
if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True)