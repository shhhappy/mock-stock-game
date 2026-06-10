import time
import random
from threading import Lock
from datetime import datetime

NEWS_TEMPLATES_UP = [
    "{sector} 섹터 외국인 순매수 급증 — 단기 강세 신호",
    "{name} 깜짝 실적 예고… 목표주가 줄상향 예상",
    "정부, {sector} 산업 대규모 지원책 발표 임박",
    "{name} 역대급 수주 계약 체결 — 실적 급등 전망",
    "{sector} 글로벌 수요 폭발… 수출 호황 지속",
    "{name} 신제품 흥행 돌풍 — 기대 이상 판매 실적",
    "{sector} 기관 순매수 전환 포착 — 강세 흐름",
    "{name} 대규모 자사주 매입 발표 — 주주가치 제고",
]

NEWS_TEMPLATES_DOWN = [
    "{sector} 섹터 기관 대규모 매도 포착 — 하락 경보",
    "{name} 어닝 쇼크 우려… 목표주가 줄하향",
    "{sector} 공급 과잉 심화 — 마진 압박 불가피",
    "{name} 핵심 계약 파기 루머 확산 — 투자자 불안",
    "{sector} 규제 강화 충격 — 투자심리 급랭",
    "{name} 주요 고객사 이탈 소식 — 실적 악화 우려",
    "{sector} 글로벌 수요 둔화 경고 — 조정 국면 진입",
    "{name} 대주주 지분 대량 매도 — 오버행 리스크",
]

STOCKS = {
    # 반도체
    'SMSNG': {'name': '삼성전자',         'sector': '반도체', 'base': 72000,  'vol': 0.025},
    'SKHYN': {'name': 'SK하이닉스',       'sector': '반도체', 'base': 185000, 'vol': 0.035},
    'SMSEL': {'name': '삼성전기',         'sector': '반도체', 'base': 148000, 'vol': 0.030},
    # IT/플랫폼
    'NAVER': {'name': 'NAVER',            'sector': 'IT',     'base': 195000, 'vol': 0.030},
    'KAKAO': {'name': '카카오',           'sector': 'IT',     'base': 43000,  'vol': 0.040},
    'SMEDS': {'name': '삼성SDS',          'sector': 'IT',     'base': 168000, 'vol': 0.020},
    # 자동차
    'HYUNM': {'name': '현대차',           'sector': '자동차', 'base': 210000, 'vol': 0.025},
    'KIAMO': {'name': '기아',             'sector': '자동차', 'base': 95000,  'vol': 0.025},
    'HDMOB': {'name': '현대모비스',       'sector': '자동차', 'base': 248000, 'vol': 0.020},
    # 배터리
    'SMSDI': {'name': '삼성SDI',          'sector': '배터리', 'base': 280000, 'vol': 0.040},
    'LGCMH': {'name': 'LG화학',           'sector': '배터리', 'base': 310000, 'vol': 0.035},
    'SKINV': {'name': 'SK이노베이션',     'sector': '에너지', 'base': 115000, 'vol': 0.030},
    # 바이오
    'SMBIO': {'name': '삼성바이오로직스', 'sector': '바이오', 'base': 820000, 'vol': 0.035},
    'CLTRI': {'name': '셀트리온',         'sector': '바이오', 'base': 162000, 'vol': 0.045},
    'HANMI': {'name': '한미약품',         'sector': '제약',   'base': 385000, 'vol': 0.030},
    # 금융
    'KBFIN': {'name': 'KB금융',           'sector': '금융',   'base': 82000,  'vol': 0.018},
    'SHFIN': {'name': '신한지주',         'sector': '금융',   'base': 47000,  'vol': 0.018},
    'HNFIN': {'name': '하나금융지주',     'sector': '금융',   'base': 62000,  'vol': 0.020},
    'SMLIE': {'name': '삼성생명',         'sector': '금융',   'base': 92000,  'vol': 0.015},
    # 통신
    'SKTEL': {'name': 'SK텔레콤',         'sector': '통신',   'base': 56000,  'vol': 0.012},
    'KTCOR': {'name': 'KT',               'sector': '통신',   'base': 42000,  'vol': 0.015},
    # 전자/산업
    'LGELC': {'name': 'LG전자',           'sector': '전자',   'base': 95000,  'vol': 0.025},
    'POSCO': {'name': 'POSCO홀딩스',      'sector': '철강',   'base': 385000, 'vol': 0.022},
    'HMMCO': {'name': 'HMM',              'sector': '해운',   'base': 17000,  'vol': 0.050},
    'SOILC': {'name': 'S-Oil',            'sector': '에너지', 'base': 78000,  'vol': 0.025},
    # 엔터/게임
    'HYBEC': {'name': 'HYBE',             'sector': '엔터',   'base': 195000, 'vol': 0.045},
    'KRAFT': {'name': '크래프톤',         'sector': '게임',   'base': 248000, 'vol': 0.040},
    'NCOFT': {'name': 'NCsoft',           'sector': '게임',   'base': 195000, 'vol': 0.040},
    # 건설/지주
    'SMCNS': {'name': '삼성물산',         'sector': '건설',   'base': 145000, 'vol': 0.020},
    'LGGRP': {'name': 'LG',              'sector': '지주',   'base': 92000,  'vol': 0.018},
}

SECTORS = sorted({v['sector'] for v in STOCKS.values()})

PRICE_TTL = 20  # 가격 업데이트 주기 (초)


class StockService:
    def __init__(self):
        self._lock = Lock()
        self._prices: dict = {}   # symbol → (timestamp, price)
        self._prev:   dict = {}   # symbol → 시작가 (수익률 기준)
        self._news: dict = {'timestamp': 0.0, 'items': []}
        self._current_biases: dict = {}  # 현재 사이클 적용 방향
        self._next_biases: dict = {}     # 다음 사이클 예고 방향
        self._last_news_ts: float = 0.0
        self._news_ttl: float = PRICE_TTL
        self._price_ttl: float = PRICE_TTL
        self._init_prices()

    def _init_prices(self):
        now = time.time()
        for sym, info in STOCKS.items():
            start = round(info['base'] * random.uniform(0.97, 1.03))
            self._prices[sym] = (now - self._price_ttl, start)
            self._prev[sym]   = start

    def _next_price(self, sym: str, current: float, direction: str = None) -> float:
        vol = STOCKS[sym]['vol']
        if direction == 'up':
            drift = abs(random.gauss(0, vol * 0.5)) + vol * 0.08
        elif direction == 'down':
            drift = -(abs(random.gauss(0, vol * 0.5)) + vol * 0.08)
        else:
            drift = random.gauss(0, vol * 0.4)
        new_price = current * (1 + drift)
        base = STOCKS[sym]['base']
        return round(max(base * 0.6, min(base * 1.4, new_price)))

    def _generate_news(self, show_hint: bool = True):
        sectors = list(set(v['sector'] for v in STOCKS.values()))
        chosen = random.sample(sectors, min(random.randint(1, 2), len(sectors)))
        items = []
        new_biases = {}
        for sector in chosen:
            direction = random.choice(['up', 'down'])
            sector_stocks = [s for s, info in STOCKS.items() if info['sector'] == sector]
            rep = random.choice(sector_stocks)
            name = STOCKS[rep]['name']
            tmpl = random.choice(NEWS_TEMPLATES_UP if direction == 'up' else NEWS_TEMPLATES_DOWN)
            items.append({'headline': tmpl.format(sector=sector, name=name), 'direction': direction})
            for sym in sector_stocks:
                new_biases[sym] = direction
        self._next_biases = new_biases
        self._news = {'timestamp': time.time(), 'items': items, 'show_hint': show_hint}

    def _maybe_generate_news(self, now: float):
        if now - self._last_news_ts >= self._news_ttl:
            self._current_biases = self._next_biases.copy()
            self._generate_news()
            self._last_news_ts = now

    def get_price(self, symbol: str):
        if symbol not in STOCKS:
            return None
        now = time.time()
        with self._lock:
            ts, price = self._prices[symbol]
            if now - ts < self._price_ttl:
                return price
            # 새 사이클 시작: 예고 편향 적용 후 다음 뉴스 생성
            self._maybe_generate_news(now)
            direction = self._current_biases.get(symbol)
            new_price = self._next_price(symbol, price, direction)
            self._prices[symbol] = (now, new_price)
            return new_price

    def get_news(self) -> dict:
        with self._lock:
            self._maybe_generate_news(time.time())
            return dict(self._news)

    def set_news_interval(self, seconds: float):
        with self._lock:
            self._news_ttl = max(5, min(300, float(seconds)))

    def get_news_interval(self) -> float:
        return self._news_ttl

    def trigger_news(self, show_hint: bool = True):
        with self._lock:
            self._current_biases = self._next_biases.copy()
            self._generate_news(show_hint)
            self._last_news_ts = time.time()

    def set_price_interval(self, seconds: float):
        with self._lock:
            self._price_ttl = max(5, min(300, float(seconds)))

    def get_price_interval(self) -> float:
        return self._price_ttl

    def force_price(self, symbol: str, pct: float):
        if symbol not in STOCKS:
            return None
        with self._lock:
            ts, price = self._prices[symbol]
            new_price = round(price * (1 + pct / 100))
            base = STOCKS[symbol]['base']
            new_price = max(base * 0.3, min(base * 3.0, new_price))
            self._prices[symbol] = (ts, new_price)
            return new_price

    def get_prev_close(self, symbol: str):
        return self._prev.get(symbol)

    def get_history(self, symbol: str, period: str = '1mo', interval: str = '1d') -> list:
        if symbol not in STOCKS:
            return []
        with self._lock:
            _, current = self._prices[symbol]
        vol = STOCKS[symbol]['vol']
        n_bars = {'1d': 30, '5d': 5, '1mo': 30, '3mo': 90}.get(period, 30)
        bars = []
        price = float(current)
        now = time.time()
        for i in range(n_bars, 0, -1):
            date_str = datetime.utcfromtimestamp(now - i * 86400).strftime('%Y-%m-%d')
            o = price
            c = max(1.0, o * (1 + random.gauss(0, vol * 0.5)))
            h = max(o, c) * random.uniform(1.0, 1.015)
            l = min(o, c) * random.uniform(0.985, 1.0)
            bars.append({'date': date_str,
                         'open': round(o), 'high': round(h),
                         'low': round(l),  'close': round(c),
                         'volume': random.randint(100000, 5000000)})
            price = c
        return bars


stock_service = StockService()
