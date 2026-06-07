import yfinance as yf
import time
from threading import Lock

STOCKS = {
    # 반도체
    '005930.KS': {'name': '삼성전자',       'sector': '반도체'},
    '000660.KS': {'name': 'SK하이닉스',     'sector': '반도체'},
    '009150.KS': {'name': '삼성전기',       'sector': '반도체'},
    # IT/플랫폼
    '035420.KS': {'name': 'NAVER',          'sector': 'IT'},
    '035720.KS': {'name': '카카오',         'sector': 'IT'},
    '018260.KS': {'name': '삼성SDS',        'sector': 'IT'},
    # 자동차
    '005380.KS': {'name': '현대차',         'sector': '자동차'},
    '000270.KS': {'name': '기아',           'sector': '자동차'},
    '012330.KS': {'name': '현대모비스',     'sector': '자동차'},
    # 2차전지/배터리
    '006400.KS': {'name': '삼성SDI',        'sector': '배터리'},
    '051910.KS': {'name': 'LG화학',         'sector': '배터리'},
    '096770.KS': {'name': 'SK이노베이션',   'sector': '에너지'},
    # 바이오/제약
    '207940.KS': {'name': '삼성바이오로직스', 'sector': '바이오'},
    '068270.KS': {'name': '셀트리온',       'sector': '바이오'},
    '128940.KS': {'name': '한미약품',       'sector': '제약'},
    # 금융
    '105560.KS': {'name': 'KB금융',         'sector': '금융'},
    '055550.KS': {'name': '신한지주',       'sector': '금융'},
    '086790.KS': {'name': '하나금융지주',   'sector': '금융'},
    '032830.KS': {'name': '삼성생명',       'sector': '금융'},
    # 통신
    '017670.KS': {'name': 'SK텔레콤',       'sector': '통신'},
    '030200.KS': {'name': 'KT',             'sector': '통신'},
    # 전자/산업
    '066570.KS': {'name': 'LG전자',         'sector': '전자'},
    '005490.KS': {'name': 'POSCO홀딩스',    'sector': '철강'},
    '011200.KS': {'name': 'HMM',            'sector': '해운'},
    '010950.KS': {'name': 'S-Oil',          'sector': '에너지'},
    # 엔터/게임
    '352820.KS': {'name': 'HYBE',           'sector': '엔터'},
    '259960.KS': {'name': '크래프톤',       'sector': '게임'},
    '036570.KS': {'name': 'NCsoft',         'sector': '게임'},
    # 건설/지주
    '028260.KS': {'name': '삼성물산',       'sector': '건설'},
    '003550.KS': {'name': 'LG',             'sector': '지주'},
}

SECTORS = sorted({v['sector'] for v in STOCKS.values()})


class StockService:
    CACHE_TTL = 60

    def __init__(self):
        self._price_cache = {}
        self._prev_cache = {}
        self._lock = Lock()

    def get_price(self, symbol: str):
        now = time.time()
        with self._lock:
            if symbol in self._price_cache:
                ts, price = self._price_cache[symbol]
                if now - ts < self.CACHE_TTL:
                    return price

        price = self._fetch_price(symbol)
        if price:
            with self._lock:
                self._price_cache[symbol] = (now, price)
        return price

    def get_prev_close(self, symbol: str):
        with self._lock:
            if symbol in self._prev_cache:
                return self._prev_cache[symbol]
        prev = self._fetch_prev_close(symbol)
        if prev:
            with self._lock:
                self._prev_cache[symbol] = prev
        return prev

    def get_history(self, symbol: str, period: str = '1mo', interval: str = '1d') -> list:
        try:
            hist = yf.Ticker(symbol).history(period=period, interval=interval)
            result = []
            for date, row in hist.iterrows():
                result.append({
                    'date': date.strftime('%Y-%m-%d %H:%M') if interval != '1d' else date.strftime('%Y-%m-%d'),
                    'open':   round(float(row['Open']),  2),
                    'high':   round(float(row['High']),  2),
                    'low':    round(float(row['Low']),   2),
                    'close':  round(float(row['Close']), 2),
                    'volume': int(row['Volume']),
                })
            return result
        except Exception:
            return []

    def _fetch_price(self, symbol: str):
        try:
            ticker = yf.Ticker(symbol)
            try:
                p = ticker.fast_info.last_price
                if p and p > 0: return float(p)
            except Exception:
                pass
            info = ticker.info
            for k in ('regularMarketPrice', 'currentPrice', 'previousClose'):
                if info.get(k): return float(info[k])
        except Exception:
            pass
        with self._lock:
            if symbol in self._price_cache:
                return self._price_cache[symbol][1]
        return None

    def _fetch_prev_close(self, symbol: str):
        try:
            info = yf.Ticker(symbol).info
            v = info.get('previousClose') or info.get('regularMarketPreviousClose')
            return float(v) if v else None
        except Exception:
            return None


stock_service = StockService()
