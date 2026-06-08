from flask import Flask, jsonify, request, send_from_directory, session
from functools import wraps
from datetime import datetime, timedelta
import os

from models import db, User, Room, RoomMember, RoomHolding, RoomTransaction, Deposit
from stock_service import stock_service, STOCKS, SECTORS
from education_data import GLOSSARY, GUIDES, TIPS

app = Flask(__name__, static_folder='static')
app.secret_key = os.environ.get('SECRET_KEY', 'mock-stock-game-secret-2024')
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'sqlite:///game.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db.init_app(app)

with app.app_context():
    db.create_all()

# ── Helpers ───────────────────────────────────────────────

def login_required(f):
    @wraps(f)
    def deco(*a, **kw):
        if 'user_id' not in session:
            return jsonify({'error': '로그인이 필요합니다.'}), 401
        return f(*a, **kw)
    return deco

def cur_user():
    return User.query.get(session['user_id'])

def member_total_value(rid, uid):
    member = RoomMember.query.filter_by(room_id=rid, user_id=uid).first()
    if not member: return 0
    total = member.cash
    for h in RoomHolding.query.filter_by(room_id=rid, user_id=uid).all():
        if h.shares > 0:
            p = stock_service.get_price(h.symbol)
            if p: total += p * h.shares
    for d in Deposit.query.filter_by(room_id=rid, user_id=uid, status='active').all():
        total += d.amount
    return total

def _end_room(room):
    room.status = 'ended'
    now = datetime.utcnow()
    total_seconds = room.duration_minutes * 60
    game_end = min(now, room.end_time) if room.end_time else now
    for d in Deposit.query.filter_by(room_id=room.id, status='active').all():
        m = RoomMember.query.filter_by(room_id=room.id, user_id=d.user_id).first()
        if m:
            held_seconds = max(0.0, (game_end - d.created_at).total_seconds())
            ratio = min(1.0, held_seconds / total_seconds) if total_seconds > 0 else 1.0
            interest = round(d.amount * d.rate / 100 * ratio, 0)
            d.interest_earned = interest
            d.status = 'matured'
            m.cash += d.amount + interest
    db.session.commit()

def room_dict(room, uid=None):
    now = datetime.utcnow()
    remaining = 0
    if room.status == 'active' and room.end_time:
        remaining = max(0, int((room.end_time - now).total_seconds()))
    host = User.query.get(room.host_id)
    return {
        'id': room.id, 'name': room.name, 'code': room.code,
        'host_id': room.host_id, 'host_name': host.username if host else '',
        'status': room.status,
        'duration_minutes': room.duration_minutes,
        'starting_cash': room.starting_cash,
        'deposit_rate': room.deposit_rate,
        'remaining_seconds': remaining,
        'end_time': room.end_time.strftime('%Y-%m-%dT%H:%M:%SZ') if room.end_time else None,
        'member_count': RoomMember.query.filter_by(room_id=room.id).count(),
        'is_host': uid == room.host_id,
    }

def find_active_room(uid):
    r = Room.query.filter(Room.host_id == uid, Room.status.in_(['waiting','active'])).first()
    if r: return r
    m = RoomMember.query.join(Room).filter(
        RoomMember.user_id == uid, Room.status.in_(['waiting','active'])
    ).first()
    return Room.query.get(m.room_id) if m else None


# ── Static ────────────────────────────────────────────────

@app.route('/')
def index():
    return send_from_directory('static', 'index.html')

@app.route('/pomodoro')
def pomodoro():
    return send_from_directory('static', 'pomodoro.html')


# ── Auth ──────────────────────────────────────────────────

@app.route('/api/auth/enter', methods=['POST'])
def enter():
    d = request.json or {}
    u = d.get('username', '').strip()
    if not u or len(u) < 2 or len(u) > 30:
        return jsonify({'error': '닉네임은 2~20자 사이여야 합니다.'}), 400
    user = User.query.filter_by(username=u).first()
    if not user:
        user = User(username=u)
        db.session.add(user)
        db.session.commit()
    session['user_id'] = user.id
    ar = find_active_room(user.id)
    return jsonify({'user': user.to_dict(), 'active_room': room_dict(ar, user.id) if ar else None})

@app.route('/api/auth/logout', methods=['POST'])
def logout():
    session.pop('user_id', None)
    return jsonify({'ok': True})

@app.route('/api/auth/me')
def get_me():
    if 'user_id' not in session:
        return jsonify({'error': 'unauth'}), 401
    user = User.query.get(session['user_id'])
    if not user:
        session.pop('user_id', None)
        return jsonify({'error': 'unauth'}), 401
    ar = find_active_room(user.id)
    return jsonify({'user': user.to_dict(), 'active_room': room_dict(ar, user.id) if ar else None})


# ── Room management ───────────────────────────────────────

@app.route('/api/rooms', methods=['POST'])
@login_required
def create_room():
    d = request.json or {}
    name = d.get('name','').strip()
    if not name or len(name) < 2:
        return jsonify({'error': '방 이름은 2자 이상이어야 합니다.'}), 400
    user = cur_user()
    if Room.query.filter(Room.host_id == user.id, Room.status.in_(['waiting','active'])).first():
        return jsonify({'error': '이미 진행 중인 방이 있습니다.'}), 400
    room = Room(
        name=name, host_id=user.id,
        duration_minutes=max(1, min(180, int(d.get('duration_minutes', 30)))),
        starting_cash=max(100000, float(d.get('starting_cash', 10_000_000))),
        deposit_rate=max(0, min(50, float(d.get('deposit_rate', 3.0)))),
    )
    db.session.add(room)
    db.session.commit()
    return jsonify({'room': room_dict(room, user.id)})

@app.route('/api/rooms/join', methods=['POST'])
@login_required
def join_room():
    code = (request.json or {}).get('code','').strip().upper()
    room = Room.query.filter_by(code=code).first()
    if not room: return jsonify({'error': '유효하지 않은 방 코드입니다.'}), 404
    if room.status == 'ended': return jsonify({'error': '이미 종료된 방입니다.'}), 400
    user = cur_user()
    if room.host_id != user.id and not RoomMember.query.filter_by(room_id=room.id, user_id=user.id).first():
        db.session.add(RoomMember(room_id=room.id, user_id=user.id, cash=room.starting_cash))
        db.session.commit()
    return jsonify({'room': room_dict(room, user.id)})

@app.route('/api/rooms/<int:rid>')
@login_required
def get_room(rid):
    room = Room.query.get_or_404(rid)
    if room.status == 'active' and room.end_time and datetime.utcnow() >= room.end_time:
        _end_room(room)
    return jsonify(room_dict(room, cur_user().id))

@app.route('/api/rooms/<int:rid>/start', methods=['POST'])
@login_required
def start_room(rid):
    room = Room.query.get_or_404(rid)
    user = cur_user()
    if room.host_id != user.id: return jsonify({'error': '진행자만 게임을 시작할 수 있습니다.'}), 403
    if room.status != 'waiting': return jsonify({'error': '이미 시작되었거나 종료된 방입니다.'}), 400
    now = datetime.utcnow()
    room.status = 'active'
    room.start_time = now
    room.end_time = now + timedelta(minutes=room.duration_minutes)
    db.session.commit()
    return jsonify({'room': room_dict(room, user.id)})

@app.route('/api/rooms/<int:rid>/end', methods=['POST'])
@login_required
def end_room(rid):
    room = Room.query.get_or_404(rid)
    user = cur_user()
    if room.host_id != user.id: return jsonify({'error': '진행자만 종료할 수 있습니다.'}), 403
    if room.status == 'ended': return jsonify({'error': '이미 종료된 방입니다.'}), 400
    _end_room(room)
    return jsonify({'room': room_dict(room, user.id)})


# ── Host endpoints ────────────────────────────────────────

@app.route('/api/rooms/<int:rid>/host/members')
@login_required
def host_members(rid):
    room = Room.query.get_or_404(rid)
    user = cur_user()
    if room.host_id != user.id: return jsonify({'error': '권한 없음'}), 403
    result = []
    for m in RoomMember.query.filter_by(room_id=rid).all():
        u = User.query.get(m.user_id)
        total = member_total_value(rid, m.user_id)
        gain_pct = (total - room.starting_cash) / room.starting_cash * 100 if room.starting_cash else 0
        result.append({
            'user_id': m.user_id, 'username': u.username,
            'cash': m.cash, 'total_value': round(total,0), 'gain_pct': round(gain_pct,2),
        })
    result.sort(key=lambda x: x['total_value'], reverse=True)
    for i, r in enumerate(result): r['rank'] = i + 1
    return jsonify(result)

@app.route('/api/rooms/<int:rid>/host/lobby-members')
@login_required
def lobby_members(rid):
    room = Room.query.get_or_404(rid)
    user = cur_user()
    if room.host_id != user.id: return jsonify({'error': '권한 없음'}), 403
    result = []
    for m in RoomMember.query.filter_by(room_id=rid).all():
        u = User.query.get(m.user_id)
        result.append({'user_id': m.user_id, 'username': u.username})
    return jsonify(result)

@app.route('/api/rooms/<int:rid>/host/adjust', methods=['POST'])
@login_required
def host_adjust(rid):
    room = Room.query.get_or_404(rid)
    user = cur_user()
    if room.host_id != user.id: return jsonify({'error': '권한 없음'}), 403
    d = request.json or {}
    target_uid = d.get('user_id')
    delta = float(d.get('delta', 0))
    note = d.get('note', '진행자 자산 조정')
    m = RoomMember.query.filter_by(room_id=rid, user_id=target_uid).first()
    if not m: return jsonify({'error': '참여자를 찾을 수 없습니다.'}), 404
    m.cash = max(0, m.cash + delta)
    db.session.add(RoomTransaction(room_id=rid, user_id=target_uid, symbol='ADJ', action='ADJ', amount=delta, note=note))
    db.session.commit()
    target = User.query.get(target_uid)
    return jsonify({'message': f'{target.username} 자산 {delta:+,.0f}원 조정', 'new_cash': m.cash})


@app.route('/api/rooms/<int:rid>/host/news-interval', methods=['GET', 'POST'])
@login_required
def host_news_interval(rid):
    room = Room.query.get_or_404(rid)
    user = cur_user()
    if room.host_id != user.id: return jsonify({'error': '권한 없음'}), 403
    if request.method == 'POST':
        seconds = float((request.json or {}).get('seconds', 20))
        stock_service.set_news_interval(seconds)
    return jsonify({'seconds': stock_service.get_news_interval()})


# ── Stocks ────────────────────────────────────────────────

@app.route('/api/rooms/<int:rid>/stocks')
@login_required
def get_stocks(rid):
    Room.query.get_or_404(rid)
    sf = request.args.get('sector','')
    result = []
    for sym, info in STOCKS.items():
        if sf and info['sector'] != sf: continue
        price = stock_service.get_price(sym)
        prev  = stock_service.get_prev_close(sym)
        if price:
            ch = (price - prev) if prev else 0
            ch_pct = (ch / prev * 100) if prev else 0
            result.append({
                'symbol': sym, 'name': info['name'],
                'sector': info['sector'],
                'price': round(price, 0), 'change': round(ch, 0),
                'change_pct': round(ch_pct, 2),
            })
    return jsonify({'stocks': result, 'sectors': SECTORS})

@app.route('/api/rooms/<int:rid>/news')
@login_required
def get_room_news(rid):
    Room.query.get_or_404(rid)
    return jsonify(stock_service.get_news())


@app.route('/api/rooms/<int:rid>/stocks/<symbol>/chart')
@login_required
def get_chart(rid, symbol):
    Room.query.get_or_404(rid)
    if symbol not in STOCKS: return jsonify({'error': '종목 없음'}), 404
    pm = {'1d':('1d','5m'),'1w':('5d','30m'),'1mo':('1mo','1d'),'3mo':('3mo','1d'),'1y':('1y','1wk')}
    period = request.args.get('period','1mo')
    yp, yi = pm.get(period, ('1mo','1d'))
    hist = stock_service.get_history(symbol, period=yp, interval=yi)
    return jsonify({'symbol': symbol, 'name': STOCKS[symbol]['name'], 'history': hist})


# ── Trade ─────────────────────────────────────────────────

@app.route('/api/rooms/<int:rid>/trade', methods=['POST'])
@login_required
def trade(rid):
    room = Room.query.get_or_404(rid)
    if room.status != 'active':
        return jsonify({'error': '게임이 진행 중이 아닙니다.'}), 400
    if room.end_time and datetime.utcnow() >= room.end_time:
        return jsonify({'error': '게임이 종료되었습니다.'}), 400
    user = cur_user()
    member = RoomMember.query.filter_by(room_id=rid, user_id=user.id).first()
    if not member: return jsonify({'error': '이 방의 참여자가 아닙니다.'}), 403
    d = request.json or {}
    symbol = d.get('symbol','')
    action = d.get('action','').upper()
    try: shares = int(d.get('shares', 0))
    except: return jsonify({'error': '수량 오류'}), 400
    if symbol not in STOCKS: return jsonify({'error': '유효하지 않은 종목'}), 400
    if action not in ('BUY','SELL'): return jsonify({'error': '유효하지 않은 거래'}), 400
    if shares <= 0: return jsonify({'error': '수량은 1 이상'}), 400
    price = stock_service.get_price(symbol)
    if not price: return jsonify({'error': '주가를 불러올 수 없습니다.'}), 500
    holding = RoomHolding.query.filter_by(room_id=rid, user_id=user.id, symbol=symbol).first()
    amount = price * shares
    if action == 'BUY':
        if member.cash < amount:
            return jsonify({'error': f'잔액 부족 — 필요: {amount:,.0f}원 / 보유: {member.cash:,.0f}원'}), 400
        member.cash -= amount
        if holding:
            ns = holding.shares + shares
            holding.avg_price = (holding.avg_price * holding.shares + amount) / ns
            holding.shares = ns
        else:
            db.session.add(RoomHolding(room_id=rid, user_id=user.id, symbol=symbol, shares=shares, avg_price=price))
    else:
        if not holding or holding.shares < shares:
            return jsonify({'error': f'보유 수량 부족 — 보유: {holding.shares if holding else 0}주'}), 400
        member.cash += amount
        holding.shares -= shares
        if holding.shares == 0: db.session.delete(holding)
    db.session.add(RoomTransaction(room_id=rid, user_id=user.id, symbol=symbol,
                                   action=action, shares=shares, price=price, amount=amount))
    db.session.commit()
    return jsonify({'message': f'{STOCKS[symbol]["name"]} {shares}주 {"매수" if action=="BUY" else "매도"} 완료!',
                    'cash': member.cash})


# ── Portfolio ─────────────────────────────────────────────

@app.route('/api/rooms/<int:rid>/portfolio')
@login_required
def get_portfolio(rid):
    room = Room.query.get_or_404(rid)
    user = cur_user()
    m = RoomMember.query.filter_by(room_id=rid, user_id=user.id).first()
    if not m: return jsonify({'error': '참여자가 아닙니다.'}), 403
    holdings_data, sv = [], 0.0
    for h in RoomHolding.query.filter_by(room_id=rid, user_id=user.id).all():
        if h.shares <= 0: continue
        price = stock_service.get_price(h.symbol)
        if not price: continue
        cv = price * h.shares
        gain = cv - h.avg_price * h.shares
        sv += cv
        holdings_data.append({
            'symbol': h.symbol, 'name': STOCKS.get(h.symbol,{}).get('name',h.symbol),
            'sector': STOCKS.get(h.symbol,{}).get('sector',''),
            'shares': h.shares, 'avg_price': h.avg_price, 'current_price': price,
            'current_value': cv, 'gain': gain,
            'gain_pct': round((price - h.avg_price)/h.avg_price*100 if h.avg_price else 0, 2),
        })
    deps_locked = sum(d.amount for d in Deposit.query.filter_by(room_id=rid, user_id=user.id, status='active').all())
    total = m.cash + sv + deps_locked
    start = room.starting_cash
    return jsonify({
        'cash': m.cash, 'stock_value': sv, 'deposits_locked': deps_locked,
        'total_value': total, 'total_gain': total - start,
        'total_gain_pct': round((total - start)/start*100 if start else 0, 2),
        'holdings': sorted(holdings_data, key=lambda x: x['current_value'], reverse=True),
    })


# ── Rankings ──────────────────────────────────────────────

@app.route('/api/rooms/<int:rid>/rankings')
@login_required
def get_rankings(rid):
    room = Room.query.get_or_404(rid)
    user = cur_user()
    start = room.starting_cash
    board = []
    for m in RoomMember.query.filter_by(room_id=rid).all():
        u = User.query.get(m.user_id)
        total = member_total_value(rid, m.user_id)
        board.append({'user_id': m.user_id, 'username': u.username,
                      'total_value': round(total,0),
                      'gain_pct': round((total-start)/start*100 if start else 0, 2),
                      'is_me': m.user_id == user.id})
    board.sort(key=lambda x: x['total_value'], reverse=True)
    for i, e in enumerate(board): e['rank'] = i + 1
    return jsonify(board)


# ── Transactions ──────────────────────────────────────────

@app.route('/api/rooms/<int:rid>/transactions')
@login_required
def get_transactions(rid):
    Room.query.get_or_404(rid)
    user = cur_user()
    page = request.args.get('page', 1, type=int)
    pg = (RoomTransaction.query.filter_by(room_id=rid, user_id=user.id)
          .order_by(RoomTransaction.timestamp.desc())
          .paginate(page=page, per_page=20, error_out=False))
    return jsonify({
        'transactions': [{
            'id': t.id,
            'name': STOCKS.get(t.symbol,{}).get('name', '자산조정') if t.action != 'ADJ' else '자산조정',
            'action': t.action, 'shares': t.shares, 'price': t.price,
            'amount': t.amount, 'note': t.note,
            'timestamp': t.timestamp.strftime('%m-%d %H:%M'),
        } for t in pg.items],
        'total': pg.total, 'pages': pg.pages, 'current_page': page,
    })


# ── Deposits ──────────────────────────────────────────────

@app.route('/api/rooms/<int:rid>/deposits', methods=['GET'])
@login_required
def get_deposits(rid):
    room = Room.query.get_or_404(rid)
    user = cur_user()
    deps = Deposit.query.filter_by(room_id=rid, user_id=user.id).order_by(Deposit.created_at.desc()).all()
    now = datetime.utcnow()
    total_seconds = room.duration_minutes * 60
    result = []
    for d in deps:
        max_interest = d.amount * d.rate / 100
        if d.status == 'active' and total_seconds > 0:
            held = max(0.0, (now - d.created_at).total_seconds())
            ratio = min(1.0, held / total_seconds)
            expected_interest = round(max_interest * ratio, 0)
        else:
            expected_interest = d.interest_earned or 0
        result.append({
            'id': d.id, 'amount': d.amount, 'rate': d.rate, 'status': d.status,
            'interest_earned': d.interest_earned,
            'expected_interest': expected_interest,
            'max_interest': round(max_interest, 0),
            'created_at': d.created_at.strftime('%m-%d %H:%M'),
        })
    return jsonify(result)

@app.route('/api/rooms/<int:rid>/deposits', methods=['POST'])
@login_required
def create_deposit(rid):
    room = Room.query.get_or_404(rid)
    if room.status != 'active': return jsonify({'error': '게임이 진행 중이 아닙니다.'}), 400
    if room.end_time and datetime.utcnow() >= room.end_time: return jsonify({'error': '게임 종료'}), 400
    user = cur_user()
    m = RoomMember.query.filter_by(room_id=rid, user_id=user.id).first()
    if not m: return jsonify({'error': '참여자가 아닙니다.'}), 403
    try: amount = float((request.json or {}).get('amount', 0))
    except: return jsonify({'error': '금액 오류'}), 400
    if amount <= 0: return jsonify({'error': '금액은 0보다 커야 합니다.'}), 400
    if m.cash < amount: return jsonify({'error': f'잔액 부족 — 보유: {m.cash:,.0f}원'}), 400
    m.cash -= amount
    dep = Deposit(room_id=rid, user_id=user.id, amount=amount, rate=room.deposit_rate)
    db.session.add(dep)
    db.session.commit()
    total_seconds = room.duration_minutes * 60
    remaining = max(0.0, (room.end_time - datetime.utcnow()).total_seconds()) if room.end_time else total_seconds
    ratio = min(1.0, remaining / total_seconds) if total_seconds > 0 else 1.0
    expected_interest = round(amount * room.deposit_rate / 100 * ratio, 0)
    max_interest = round(amount * room.deposit_rate / 100, 0)
    return jsonify({'message': f'{amount:,.0f}원 예금! 예상 이자 {expected_interest:,.0f}원 (보유 시간 비례 지급).',
                    'cash': m.cash, 'deposit': {'id': dep.id, 'amount': dep.amount,
                    'expected_interest': expected_interest, 'max_interest': max_interest, 'rate': dep.rate}})

@app.route('/api/rooms/<int:rid>/deposits/<int:did>', methods=['DELETE'])
@login_required
def withdraw_deposit(rid, did):
    dep = Deposit.query.get_or_404(did)
    user = cur_user()
    if dep.room_id != rid or dep.user_id != user.id: return jsonify({'error': '권한 없음'}), 403
    if dep.status != 'active': return jsonify({'error': '이미 처리된 예금'}), 400
    m = RoomMember.query.filter_by(room_id=rid, user_id=user.id).first()
    dep.status = 'withdrawn'
    m.cash += dep.amount
    db.session.commit()
    return jsonify({'message': f'예금 해지 — {dep.amount:,.0f}원 반환 (이자 없음)', 'cash': m.cash})


# ── Education ─────────────────────────────────────────────

@app.route('/api/education/glossary')
def get_glossary():
    q = request.args.get('q','').lower()
    return jsonify([g for g in GLOSSARY if not q or q in g['term'].lower() or q in g['definition'].lower()])

@app.route('/api/education/guides')
def get_guides():
    return jsonify(GUIDES)

@app.route('/api/education/guides/<int:gid>')
def get_guide(gid):
    g = next((x for x in GUIDES if x['id'] == gid), None)
    return jsonify(g) if g else (jsonify({'error': '없음'}), 404)

@app.route('/api/education/tips')
def get_tips():
    return jsonify(TIPS)


if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True, host='0.0.0.0', port=5000)
