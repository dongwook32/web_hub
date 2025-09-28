import os
from flask import Flask, request, jsonify, render_template, session, redirect, url_for
from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
from flask_cors import CORS
import uuid
import sib_api_v3_sdk
from sib_api_v3_sdk.rest import ApiException
from datetime import timedelta

# --- Initial Setup ---
app = Flask(__name__)
CORS(app)

app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL')
app.config['SENDINBLUE_API_KEY'] = os.environ.get('SENDINBLUE_API_KEY')
app.secret_key = os.environ.get('SECRET_KEY')

app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(hours=1)

db = SQLAlchemy(app)
bcrypt = Bcrypt(app)

# --- Database Models ---
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.String(20), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)
    nickname = db.Column(db.String(50), unique=True, nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=False)

class EmailVerification(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(100), nullable=False)
    token = db.Column(db.String(100), unique=True, nullable=False)

# --- Email Sending Function ---
def send_verification_email(to_email, token):
    configuration = sib_api_v3_sdk.Configuration()
    configuration.api_key['api-key'] = app.config['SENDINBLUE_API_KEY']
    api_instance = sib_api_v3_sdk.TransactionalEmailsApi(sib_api_v3_sdk.ApiClient(configuration))
    
    subject = "[KBU Hub] 이메일 인증을 완료해주세요."
    verification_link = f"https://kbuhub.onrender.com/verify/{token}"
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

# --- Routes (Pages and API) ---

@app.route('/')
def main_page():
    nickname = session.get('nickname')
    return render_template('index.html', nickname=nickname)

@app.route('/login-page')
def login_page():
    return render_template('login.html')

@app.route('/signup-page')
def signup_email_page():
    return render_template('signup_email.html')

@app.route('/verify/<token>')
def show_signup_form(token):
    verification_data = EmailVerification.query.filter_by(token=token).first()
    if verification_data:
        return render_template('signup_form.html', user_email=verification_data.email, token=token)
    else:
        return "유효하지 않거나 만료된 인증 링크입니다.", 404

# --- [ADDED] Placeholder Page Routes ---
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
# ------------------------------------

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
        return jsonify({"message": "인증 이메일이 발송되었습니다."})
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

# This block is not executed in production on Render
if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True)