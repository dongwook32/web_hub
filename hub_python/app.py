# app.py
from flask import Flask, request, jsonify, render_template, redirect 
from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
from flask_cors import CORS
import uuid
import sib_api_v3_sdk
from sib_api_v3_sdk.rest import ApiException

# --- 초기 설정 ---
app = Flask(__name__)
CORS(app)
app.config.from_pyfile('config.py')  # 설정 파일 불러오기

db = SQLAlchemy(app)
bcrypt = Bcrypt(app)

# --- 데이터베이스 모델 정의 ---
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

# --- Brevo(Sendinblue) 이메일 발송 함수 ---
def send_verification_email(to_email, token):
    configuration = sib_api_v3_sdk.Configuration()
    configuration.api_key['api-key'] = app.config['SENDINBLUE_API_KEY']
    api_instance = sib_api_v3_sdk.TransactionalEmailsApi(sib_api_v3_sdk.ApiClient(configuration))
    
    subject = "[내 사이트] 이메일 인증을 완료해주세요."
    verification_link = f"http://127.0.0.1:5000/verify/{token}"
    html_content = f"가입을 완료하려면 링크를 클릭하세요: <a href='{verification_link}'>인증하기</a>"
    sender = {"name": "내 사이트 관리자", "email": "dongwook219@gmail.com"} # Brevo에 등록된 발신자
    to = [{"email": to_email}]
    
    send_smtp_email = sib_api_v3_sdk.SendSmtpEmail(to=to, html_content=html_content, sender=sender, subject=subject)

    try:
        api_response = api_instance.send_transac_email(send_smtp_email)
        print(api_response)
        return True
    except ApiException as e:
        print("Exception when calling TransactionalEmailsApi->send_transac_email: %s\n" % e)
        return False

# --- API 엔드포인트 ---
@app.route('/send-verification', methods=['POST'])
def start_verification():
    email = request.json['email']
    
    if not email.endswith('@bible.ac.kr'):
        return jsonify({"error": "학교 이메일만 사용할 수 있습니다."}), 400
    
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

# --- 이 부분이 수정/추가되었습니다 ---
@app.route('/verify/<token>')
def show_signup_form(token):
    # DB에서 토큰 정보 찾기
    verification_data = EmailVerification.query.filter_by(token=token).first()
    
    if verification_data:
        # 토큰이 유효하면, signup.html 파일을 렌더링(표시)해준다.
        # 이메일 주소와 토큰 값을 HTML 페이지로 전달하여 사용한다.
        return render_template('signup.html', user_email=verification_data.email, token=token)
    else:
        # 토큰이 유효하지 않으면 에러 메시지를 보여준다.
        return "유효하지 않거나 만료된 인증 링크입니다.", 404
# --- 여기까지 수정/추가 ---

@app.route('/signup', methods=['POST'])
def signup():
    data = request.json
    token = data['token']
    
    verification_data = EmailVerification.query.filter_by(token=token).first()
    if not verification_data:
        return jsonify({"error": "유효하지 않은 토큰입니다."}), 400

    email = verification_data.email
    student_id = data['student_id']
    password = data['password']
    nickname = data['nickname']

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
    db.session.delete(verification_data) # 인증 완료 후 임시 토큰 삭제
    db.session.commit()
    
    return jsonify({"message": "회원가입이 완료되었습니다!"}), 201


if __name__ == '__main__':
    with app.app_context():
        db.create_all()  # 앱 실행 시 DB와 테이블 자동 생성
    app.run(debug=True)
