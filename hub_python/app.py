# =========================================================================
# KBU Hub - 최종 통합 API 서버 (app.py)
# =========================================================================

import os
from datetime import datetime, timedelta, timezone
import uuid

from flask import Flask, jsonify, render_template, request, session
from flask_bcrypt import Bcrypt
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import func, ForeignKey
from whitenoise import WhiteNoise

# --- 1. 초기 설정 및 환경 구성 ---

# ⭐️ 핵심 수정 #1: 프로젝트의 절대 경로를 계산하여 안정성을 극대화합니다.
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Flask 앱 인스턴스 생성
app = Flask(__name__, static_folder=None, template_folder=os.path.join(BASE_DIR, 'templates'))

# ⭐️ 핵심 수정 #2: WhiteNoise에 static 폴더의 '절대 경로'를 명확하게 알려줍니다.
# 이렇게 하면 서버가 어떤 위치에서 실행되더라도 항상 정확한 static 폴더를 찾아 내용을 읽을 수 있습니다.
static_folder_root = os.path.join(BASE_DIR, 'static')
app.wsgi_app = WhiteNoise(app.wsgi_app, root=static_folder_root, prefix='/static/')

CORS(app)

# Render 배포 환경과 로컬 개발 환경을 구분하여 설정을 분리합니다.
if os.environ.get('RENDER'):
    app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL')
    app.config['SENDINBLUE_API_KEY'] = os.environ.get('SENDINBLUE_API_KEY')
    app.secret_key = os.environ.get('SECRET_KEY')
else:
    app.config['SQLALCHEMY_DATABASE_URI'] = f"sqlite:///{os.path.join(BASE_DIR, 'local_db.sqlite')}"
    app.config['SENDINBLUE_API_KEY'] = None
    app.secret_key = 'LOCAL_DEV_SECRET_KEY_JUST_FOR_TEST'

app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(hours=1)
db = SQLAlchemy(app)
bcrypt = Bcrypt(app)

# --- 2. 데이터베이스 모델 정의 ---
# hub_project.sql 파일의 구조를 기반으로 SQLAlchemy 모델을 정의합니다.
class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.String(50), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    nickname = db.Column(db.String(100), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    department_id = db.Column(db.Integer, db.ForeignKey('departments.id'))
    is_admin = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    birthdate = db.Column(db.Date)
    status = db.Column(db.String(50))
    department = db.relationship('Department', backref='users')
    def to_dict(self):
        return { "id": self.id, "student_id": self.student_id, "name": self.name, "nickname": self.nickname, "email": self.email, "is_admin": self.is_admin, "department": self.department.name if self.department else None, "created_at": self.created_at.isoformat() }
class Department(db.Model):
    __tablename__ = 'departments'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
class Board(db.Model):
    __tablename__ = 'boards'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    description = db.Column(db.String(255))
class Post(db.Model):
    __tablename__ = 'posts'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    board_id = db.Column(db.Integer, db.ForeignKey('boards.id'), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    views = db.Column(db.Integer, default=0)
    author = db.relationship('User', backref='posts')
    board = db.relationship('Board', backref='posts')
    def to_dict(self):
        likes_count = db.session.query(func.count(Like.user_id)).filter(Like.post_id == self.id).scalar()
        comments_count = db.session.query(func.count(Comment.id)).filter(Comment.post_id == self.id).scalar()
        return { "id": self.id, "title": self.title, "content": self.content, "author_nickname": self.author.nickname, "created_at": self.created_at.isoformat(), "views": self.views, "likes": likes_count, "comments_count": comments_count }
class Comment(db.Model):
    __tablename__ = 'comments'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    post_id = db.Column(db.Integer, db.ForeignKey('posts.id'), nullable=False)
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    parent_id = db.Column(db.Integer, db.ForeignKey('comments.id'))
    author = db.relationship('User', backref='comments')
    post = db.relationship('Post', backref='comments')
class Like(db.Model):
    __tablename__ = 'likes'
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), primary_key=True)
    post_id = db.Column(db.Integer, db.ForeignKey('posts.id'), primary_key=True)
class EmailVerification(db.Model):
    __tablename__ = 'email_verifications'
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), nullable=False)
    token = db.Column(db.String(36), default=lambda: str(uuid.uuid4()), unique=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    expires_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc) + timedelta(minutes=30))

# --- 3. API 엔드포인트 정의 ---
@app.route('/api/auth/status')
def auth_status():
    if 'user_id' in session:
        user = User.query.get(session.get('user_id'))
        if user:
            return jsonify({"isLoggedIn": True, "user": user.to_dict()}), 200
    return jsonify({"isLoggedIn": False}), 200

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    student_id = data.get('studentId')
    password = data.get('password')
    user = User.query.filter_by(student_id=student_id).first()
    if user and bcrypt.check_password_hash(user.password_hash, password):
        session.permanent = True
        session['user_id'] = user.id
        session['nickname'] = user.nickname
        session['is_admin'] = user.is_admin
        return jsonify({"success": True, "message": "로그인 성공!", "user": user.to_dict()}), 200
    else:
        return jsonify({"success": False, "error": "학번 또는 비밀번호가 일치하지 않습니다."}), 401

@app.route('/api/signup', methods=['POST'])
def signup():
    data = request.get_json()
    student_id = data.get('studentId')
    password = data.get('password')
    name = data.get('name')
    nickname = data.get('nickname')
    email = data.get('email')

    # 필수 정보 확인
    if not all([student_id, password, name, nickname, email]):
        return jsonify({"error": "모든 필드를 입력해주세요."}), 400

    # 사용자 중복 확인
    if User.query.filter((User.student_id == student_id) | (User.email == email) | (User.nickname == nickname)).first():
        return jsonify({"error": "이미 사용 중인 학번, 이메일 또는 닉네임입니다."}), 409

    # 비밀번호 암호화 (가장 중요!)
    password_hash = bcrypt.generate_password_hash(password).decode('utf-8')

    # 새 사용자 생성 및 데이터베이스에 저장
    new_user = User(
        student_id=student_id,
        password_hash=password_hash,
        name=name,
        nickname=nickname,
        email=email
    )
    db.session.add(new_user)
    db.session.commit()

    return jsonify({"message": "회원가입이 성공적으로 완료되었습니다! 로그인해주세요."}), 201


@app.route('/api/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({"message": "성공적으로 로그아웃되었습니다."}), 200

@app.route('/api/posts', methods=['GET'])
def get_posts():
    posts = Post.query.order_by(Post.created_at.desc()).all()
    posts_list = [post.to_dict() for post in posts]
    return jsonify(posts=posts_list), 200

# =========================================================================
# ✅ [수정됨] 회원가입 및 이메일 인증을 위한 라우트 추가
# =========================================================================
@app.route('/signup-email')
def signup_email_page():
    return render_template('email_signup.html')

@app.route('/start-verification', methods=['POST'])
def start_verification():
    data = request.get_json()
    email = data.get('email')

    if not email or not email.endswith('@bible.ac.kr'):
        return jsonify({"error": "올바른 학교 이메일 주소를 입력하세요."}), 400
    
    # 실제 이메일 발송 로직 (추후 구현)
    print(f"인증 메일 발송 시도: {email}") 

    return jsonify({"message": f"{email}로 인증 메일이 발송되었습니다. 메일을 확인해주세요."}), 200
# =========================================================================

# --- 4. SPA를 위한 통합 라우트 (Catch-all Route) ---
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def catch_all(path):
    # API 요청은 SPA 라우팅에서 제외
    if path.startswith('api/'):
        return jsonify({"error": "존재하지 않는 API 엔드포인트입니다."}), 404
    
    # ✅ [추가됨] 독립적인 페이지들(회원가입 등)은 SPA 라우팅에서 제외
    if path in ['signup-email']: # 여기에 다른 독립 페이지 경로도 추가 가능
        # 해당 경로를 처리하는 함수가 이미 위에 있으므로, Flask가 알아서 처리함
        # 이 return을 그냥 지나치게 해서 Flask의 기본 동작을 따르게 함
        pass
    else:
        # 그 외 모든 경로는 SPA의 진입점인 app.html을 렌더링
        return render_template("app.html")

# --- 5. 서버 실행 ---
if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True)