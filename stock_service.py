import time
import random
from threading import Lock
from datetime import datetime

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

PRICE_TTL = 3  # 가격 업데이트 주기 (초)


class StockService:
    def __init__(self):
        self._lock = Lock()
        self._prices: dict = {}   # symbol → (timestamp, price)
        self._prev:   dict = {}   # symbol → 시작가 (수익률 기준)
        self._init_prices()

    def _init_prices(self):
        now = time.time()
        for sym, info in STOCKS.items():
            start = round(info['base'] * random.uniform(0.97, 1.03))
            self._prices[sym] = (now - PRICE_TTL, start)
            self._prev[sym]   = start

    def _next_price(self, sym: str, current: float) -> float:
        vol = STOCKS[sym]['vol']
        drift = random.gauss(0, vol * 0.4)
        new_price = current * (1 + drift)
        base = STOCKS[sym]['base']
        return round(max(base * 0.6, min(base * 1.4, new_price)))

    def get_price(self, symbol: str):
        if symbol not in STOCKS:
            return None
        now = time.time()
        with self._lock:
            ts, price = self._prices[symbol]
            if now - ts < PRICE_TTL:
                return price
            new_price = self._next_price(symbol, price)
            self._prices[symbol] = (now, new_price)
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
