class CryptoAnalyzer {
    constructor() {
        this.API_KEY = 'nc3cvP0d3LZzL9AIIgQQsjU6MKN8g5oanFkiAo4BdykbaOlce3HsTbWB3mPCoL8z';
        this.BASE_URL = 'https://api.binance.com/api/v3';
        this.isAnalyzing = false;
        this.soundEnabled = true;
        this.volume = 50;
        this.currentTimeframe = '1h';
        this.intervalId = null;
        this.results = [];
        
        this.initializeElements();
        this.setupEventListeners();
        this.startClock();
    }

    initializeElements() {
        this.toggleButton = document.getElementById('toggleAnalysis');
        this.refreshButton = document.getElementById('refreshData');
        this.resetButton = document.getElementById('resetSettings');
        this.timeframeSelect = document.getElementById('timeframe');
        this.soundToggle = document.getElementById('soundToggle');
        this.volumeControl = document.getElementById('volumeControl');
        this.resultsContainer = document.getElementById('results');
        this.alertSound = document.getElementById('alertSound');
        this.clockElement = document.getElementById('algeriaClock');
        
        this.sortButtons = document.querySelectorAll('.sort-btn');
    }

    startClock() {
        const updateClock = () => {
            const now = new Date();
            // Algeria is UTC+1
            const algeriaTime = new Date(now.getTime() + (1 * 60 * 60 * 1000));
            const timeString = algeriaTime.toLocaleTimeString('en-US', {
                hour12: false,
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                timeZone: 'Africa/Algiers'
            });
            this.clockElement.textContent = timeString;
        };

        updateClock();
        setInterval(updateClock, 1000);
    }

    setupEventListeners() {
        this.toggleButton.addEventListener('click', () => this.toggleAnalysis());
        this.refreshButton.addEventListener('click', () => this.refreshAnalysis());
        this.resetButton.addEventListener('click', () => this.resetSettings());
        this.timeframeSelect.addEventListener('change', (e) => this.currentTimeframe = e.target.value);
        this.soundToggle.addEventListener('change', (e) => this.soundEnabled = e.target.checked);
        this.volumeControl.addEventListener('input', (e) => {
            this.volume = e.target.value;
            this.alertSound.volume = this.volume / 100;
        });
        
        this.sortButtons.forEach(button => {
            button.addEventListener('click', (e) => this.sortResults(e.target.dataset.sort));
        });
    }

    async getAllSymbols() {
        try {
            const response = await fetch(`${this.BASE_URL}/exchangeInfo`);
            const data = await response.json();
            return data.symbols
                .filter(symbol => symbol.quoteAsset === 'USDT' && symbol.status === 'TRADING')
                .map(symbol => symbol.symbol);
        } catch (error) {
            console.error('Error fetching symbols:', error);
            return [];
        }
    }

    async getKlines(symbol, interval, limit = 6) {
        try {
            const response = await fetch(
                `${this.BASE_URL}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`
            );
            return await response.json();
        } catch (error) {
            console.error(`Error fetching klines for ${symbol}:`, error);
            return [];
        }
    }

    hasPattern(klines) {
        if (klines.length < 5) return false;

        const last5Candles = klines.slice(-5);
        const [open, high, low, close] = [1, 2, 3, 4];

        const isRedCandle = (candle) => parseFloat(candle[close]) < parseFloat(candle[open]);
        const isGreenCandle = (candle) => parseFloat(candle[close]) > parseFloat(candle[open]);
        
        const first4Red = last5Candles.slice(0, 4).every(isRedCandle);
        const lastGreen = isGreenCandle(last5Candles[4]);
        
        if (!first4Red || !lastGreen) return false;

        const lastCandle = last5Candles[4];
        const bodyLength = Math.abs(parseFloat(lastCandle[close]) - parseFloat(lastCandle[open]));
        const lowerWickLength = parseFloat(lastCandle[open]) - parseFloat(lastCandle[low]);
        
        return lowerWickLength > bodyLength * 1.5;
    }

    playAlert() {
        if (this.soundEnabled) {
            this.alertSound.play().catch(console.error);
        }
    }

    createResultCard(symbol, price, wickLength, timestamp) {
        const card = document.createElement('div');
        card.className = 'crypto-card';
        
        // Format the date in Algeria timezone
        const date = new Date(timestamp);
        const algeriaTime = new Date(date.getTime() + (1 * 60 * 60 * 1000));
        const formattedTime = algeriaTime.toLocaleString('en-US', {
            timeZone: 'Africa/Algiers',
            hour12: false,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });

        card.innerHTML = `
            <h3>${symbol}</h3>
            <div class="crypto-info">
                <div><span>السعر:</span> <strong>${parseFloat(price).toFixed(8)}</strong></div>
                <div><span>طول الذيل:</span> <strong>${wickLength.toFixed(2)}</strong></div>
                <div><span>التوقيت:</span> <strong>${formattedTime}</strong></div>
            </div>
        `;
        return card;
    }

    sortResults(criterion) {
        this.sortButtons.forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.sort === criterion) {
                btn.classList.add('active');
            }
        });

        this.results.sort((a, b) => {
            switch (criterion) {
                case 'time':
                    return b.timestamp - a.timestamp;
                case 'tail':
                    return b.wickLength - a.wickLength;
                case 'price':
                    return parseFloat(a.price) - parseFloat(b.price);
                default:
                    return 0;
            }
        });
        this.updateUI();
    }

    updateUI() {
        this.resultsContainer.innerHTML = '';
        this.results.forEach(result => {
            const card = this.createResultCard(
                result.symbol,
                result.price,
                result.wickLength,
                result.timestamp
            );
            this.resultsContainer.appendChild(card);
        });
    }

    async analyzeSymbol(symbol) {
        const klines = await this.getKlines(symbol, this.currentTimeframe);
        if (this.hasPattern(klines)) {
            const lastCandle = klines[klines.length - 1];
            const wickLength = ((parseFloat(lastCandle[3]) - parseFloat(lastCandle[2])) / 
                              parseFloat(lastCandle[4])) * 100;
            
            const newResult = {
                symbol,
                price: lastCandle[4],
                wickLength,
                timestamp: lastCandle[0]
            };

            if (!this.results.some(r => r.symbol === symbol && r.timestamp === lastCandle[0])) {
                this.results.push(newResult);
                this.playAlert();
                this.updateUI();
            }
        }
    }

    async analyze() {
        const symbols = await this.getAllSymbols();
        await Promise.all(symbols.map(symbol => this.analyzeSymbol(symbol)));
    }

    toggleAnalysis() {
        this.isAnalyzing = !this.isAnalyzing;
        this.toggleButton.textContent = this.isAnalyzing ? 'إيقاف التحليل' : 'بدء التحليل';
        
        if (this.isAnalyzing) {
            this.analyze();
            this.intervalId = setInterval(() => this.analyze(), 60000);
        } else {
            clearInterval(this.intervalId);
        }
    }

    async refreshAnalysis() {
        await this.analyze();
    }

    resetSettings() {
        this.results = [];
        this.currentTimeframe = '1h';
        this.timeframeSelect.value = '1h';
        this.soundEnabled = true;
        this.soundToggle.checked = true;
        this.volume = 50;
        this.volumeControl.value = 50;
        this.updateUI();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new CryptoAnalyzer();
});