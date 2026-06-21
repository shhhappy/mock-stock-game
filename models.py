from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import random, string

db = SQLAlchemy()


def gen_code(k=6):
    for _ in range(10):
        code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=k))
        if not Room.query.filter_by(code=code).first():
            return code
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=k))


class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self): return {'id': self.id, 'username': self.username}


class Room(db.Model):
    __tablename__ = 'rooms'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    code = db.Column(db.String(6), unique=True, default=gen_code)
    host_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    status = db.Column(db.String(20), default='waiting')  # waiting / active / paused / ended
    duration_minutes = db.Column(db.Integer, default=30)
    starting_cash = db.Column(db.Float, default=10_000_000)
    deposit_rate = db.Column(db.Float, default=3.0)
    start_time = db.Column(db.DateTime, nullable=True)
    end_time = db.Column(db.DateTime, nullable=True)
    paused_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    rlt_triggered = db.Column(db.Boolean, default=False)
    results_published = db.Column(db.Boolean, default=False)
    lottery_rounds_done = db.Column(db.String(50), default='')

    members = db.relationship('RoomMember', backref='room', lazy=True, cascade='all, delete-orphan')
    deposits = db.relationship('Deposit', backref='room', lazy=True, cascade='all, delete-orphan')


class RoomMember(db.Model):
    __tablename__ = 'room_members'
    id = db.Column(db.Integer, primary_key=True)
    room_id = db.Column(db.Integer, db.ForeignKey('rooms.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    cash = db.Column(db.Float, default=0)
    joined_at = db.Column(db.DateTime, default=datetime.utcnow)
    __table_args__ = (db.UniqueConstraint('room_id', 'user_id'),)


class RoomHolding(db.Model):
    __tablename__ = 'room_holdings'
    id = db.Column(db.Integer, primary_key=True)
    room_id = db.Column(db.Integer, db.ForeignKey('rooms.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    symbol = db.Column(db.String(20), nullable=False)
    shares = db.Column(db.Integer, default=0)
    avg_price = db.Column(db.Float, default=0)
    __table_args__ = (db.UniqueConstraint('room_id', 'user_id', 'symbol'),)


class RoomTransaction(db.Model):
    __tablename__ = 'room_transactions'
    id = db.Column(db.Integer, primary_key=True)
    room_id = db.Column(db.Integer, db.ForeignKey('rooms.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    symbol = db.Column(db.String(20), nullable=False)
    action = db.Column(db.String(4), nullable=False)  # BUY / SELL / ADJ
    shares = db.Column(db.Integer, default=0)
    price = db.Column(db.Float, default=0)
    amount = db.Column(db.Float, nullable=False)
    note = db.Column(db.String(200), nullable=True)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)


class Deposit(db.Model):
    __tablename__ = 'deposits'
    id = db.Column(db.Integer, primary_key=True)
    room_id = db.Column(db.Integer, db.ForeignKey('rooms.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    rate = db.Column(db.Float, nullable=False)
    status = db.Column(db.String(20), default='active')  # active / withdrawn / matured
    interest_earned = db.Column(db.Float, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
