import os
from datetime import datetime, timedelta, timezone
import uuid

from flask import Flask, jsonify, render_template, request, session
from flask_bcrypt import Bcrypt
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import ForeignKey
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
        return { "id": self.id, "title": self.title, "content": self.content, "author_nickname": self.author.nickname, "created_at": self.created_at.isoformat(), "views": self.views, "likes": Like.query.filter_by(post_id=self.id).count(), "comments_count": Comment.query.filter_by(post_id=self.id).count() }
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
@app.route('/api/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({"message": "성공적으로 로그아웃되었습니다."}), 200
@app.route('/api/posts', methods=['GET'])
def get_posts():
    posts = Post.query.order_by(Post.created_at.desc()).all()
    posts_list = [post.to_dict() for post in posts]
    return jsonify(posts=posts_list), 200

# --- 4. SPA를 위한 통합 라우트 (Catch-all Route) ---
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def catch_all(path):
    if path.startswith('api/'):
        return jsonify({"error": "존재하지 않는 API 엔드포인트입니다."}), 404
    return render_template("app.html")

# --- 5. 서버 실행 ---
if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True)