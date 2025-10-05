import os
from flask import Flask, request, jsonify, render_template, session, redirect, url_for
from whitenoise import WhiteNoise
from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
from flask_cors import CORS
import uuid
import sib_api_v3_sdk
from sib_api_v3_sdk.rest import ApiException
from datetime import timedelta, datetime

# --- 초기 설정 ---
# 이 부분은 기존 코드와 동일합니다.
app = Flask(__name__, template_folder='templates', static_folder='static')
app.wsgi_app = WhiteNoise(app.wsgi_app, root="static/", prefix="static/")
CORS(app)

if os.environ.get('RENDER'):
    app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL')
    app.config['SENDINBLUE_API_KEY'] = os.environ.get('SENDINBLUE_API_KEY')
    app.secret_key = os.environ.get('SECRET_KEY')
else:
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///local_db.sqlite'
    app.config['SENDINBLUE_API_KEY'] = None 
    app.secret_key = 'LOCAL_DEV_SECRET_KEY' 

app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(hours=1)
db = SQLAlchemy(app)
bcrypt = Bcrypt(app)

# --- 데이터베이스 모델 ---
# 제공해주신 코드에 모델 정의가 없어, 작동 가능한 예시를 위해 모델을 가정하여 추가했습니다.
# 실제 사용하시는 모델에 맞게 이 부분을 수정해주세요.
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.String(50), unique=True, nullable=False)
    nickname = db.Column(db.String(100), unique=True, nullable=False)
    password_hash = db.Column(db.String(128))
    is_admin = db.Column(db.Boolean, default=False)
    email = db.Column(db.String(120), unique=True, nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "student_id": self.student_id,
            "nickname": self.nickname,
            "is_admin": self.is_admin,
            "email": self.email
        }

class Post(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    content = db.Column(db.Text, nullable=False)
    author_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    author = db.relationship('User', backref=db.backref('posts', lazy=True))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "content": self.content,
            "author_id": self.author_id,
            "author_nickname": self.author.nickname if self.author else "탈퇴한 사용자",
            "created_at": self.created_at.isoformat()
        }

class EmailVerification(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    token = db.Column(db.String(36), unique=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

# --- 이메일 전송 함수 (기존 코드와 동일) ---
def send_verification_email(email, token):
    # 이 부분은 제공해주신 코드와 동일하게 작동한다고 가정합니다.
    # 실제 이메일 전송 로직이 여기에 들어갑니다.
    print(f"메일 전송 시뮬레이션: {email}로 토큰 {token} 전송")
    return True

# ==============================================================================
# ✨✨✨ API 서버로 전환된 핵심 로직 ✨✨✨
# ==============================================================================

# --- API: 인증 관련 ---

@app.route('/api/auth/status')
def auth_status():
    """ SPA가 처음 로드될 때 사용자의 로그인 상태를 확인하는 API """
    if 'user_id' in session:
        user = db.session.get(User, session['user_id'])
        if user:
            return jsonify({
                "isLoggedIn": True,
                "user": user.to_dict()
            }), 200
    
    return jsonify({"isLoggedIn": False}), 200

@app.route('/api/login', methods=['POST'])
def login():
    """ 로그인 처리를 위한 API """
    data = request.get_json()
    student_id = data.get('studentId')
    password = data.get('password')

    user = User.query.filter_by(student_id=student_id).first()

    if user and bcrypt.check_password_hash(user.password_hash, password):
        session.permanent = True
        session['user_id'] = user.id
        session['nickname'] = user.nickname
        session['is_admin'] = user.is_admin
        return jsonify({
            "success": True, 
            "message": "로그인 성공!",
            "user": user.to_dict()
        }), 200
    else:
        return jsonify({"success": False, "error": "학번 또는 비밀번호가 일치하지 않습니다."}), 401

@app.route('/api/logout')
def logout():
    """ 로그아웃 처리를 위한 API """
    session.clear()
    return jsonify({"success": True, "message": "로그아웃 되었습니다."}), 200

# (이하 회원가입, 이메일 인증 등 다른 API들도 '/api/...' 경로로 만듭니다)
# ...

# --- API: 데이터 관련 ---

@app.route('/api/posts')
def get_posts():
    """ 게시판의 모든 게시글 목록을 반환하는 API """
    if 'user_id' not in session:
        return jsonify({"error": "로그인이 필요합니다."}), 401

    posts = Post.query.order_by(Post.created_at.desc()).all()
    posts_list = [post.to_dict() for post in posts]
    return jsonify(posts=posts_list), 200

@app.route('/api/user/profile')
def get_user_profile():
    """ 현재 로그인된 사용자의 프로필 정보를 반환하는 API """
    if 'user_id' not in session:
        return jsonify({"error": "로그인이 필요합니다."}), 401
    
    user = db.session.get(User, session['user_id'])
    if user:
        # 여기에 사용자의 활동 내역 (작성한 글, 댓글 등)을 추가할 수 있습니다.
        return jsonify(user=user.to_dict()), 200
    else:
        return jsonify({"error": "사용자를 찾을 수 없습니다."}), 404


# ==============================================================================
# ✨✨✨ SPA를 위한 통합 라우트 (4단계) ✨✨✨
# ==============================================================================

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def catch_all(path):
    """
    API 요청이 아닌 모든 요청을 SPA의 진입점인 app.html로 보냅니다.
    사용자가 /boards, /mypage 등 어떤 주소로 직접 접속해도
    일단 SPA 뼈대를 로드하고, 그 후 JavaScript 라우터가 화면을 그리게 됩니다.
    """
    return render_template("app.html")

if __name__ == '__main__':
    # 개발 환경에서만 데이터베이스를 생성합니다.
    with app.app_context():
        db.create_all()
    app.run(debug=True)
