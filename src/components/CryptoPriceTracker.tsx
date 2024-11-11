import React, { useState, useEffect } from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';

type CryptoPrice = {
  symbol: string;
  price: number;
  platform: string;
  priceChange24h?: number;
};

type Currency = 'USD' | 'EUR';
type CryptoSymbol = 'BTC' | 'ETH' | 'SOL';

// Precios de referencia en EUR
const YESTERDAY_PRICES_EUR: Record<CryptoSymbol, number> = {
  BTC: 70000,
  ETH: 2700,
  SOL: 186
};

// Conversion EUR a USD (tasa aproximada)
const EUR_TO_USD = 1.08;

const YESTERDAY_PRICES_USD = Object.entries(YESTERDAY_PRICES_EUR).reduce((acc, [key, value]) => ({
  ...acc,
  [key]: value * EUR_TO_USD
}), {} as Record<CryptoSymbol, number>);

const CryptoPriceTracker = () => {
  const [currency, setCurrency] = useState<Currency>('USD');
  const [activeTab, setActiveTab] = useState('Kraken');
  const [prices, setPrices] = useState<CryptoPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cryptos: CryptoSymbol[] = ['BTC', 'ETH', 'SOL'];
  const platforms = ['Kraken', 'Coinbase', 'Binance'];

  const fetchKrakenPrices = async () => {
    try {
      const pairs = cryptos.map(crypto => {
        const krakenCrypto = crypto === 'BTC' ? 'XBT' : crypto;
        return `${krakenCrypto}${currency}`;
      });
      const response = await fetch(`https://api.kraken.com/0/public/Ticker?pair=${pairs.join(',')}`);
      const data = await response.json();
      
      if (data.error && data.error.length > 0) {
        throw new Error(data.error[0]);
      }
  
      return cryptos.map(crypto => {
        const krakenCrypto = crypto === 'BTC' ? 'XBT' : crypto;
        const pairKey = Object.keys(data.result).find(key => key.includes(krakenCrypto));
        if (pairKey) {
          const tickerData = data.result[pairKey];
          const priceChange24h = ((parseFloat(tickerData.c[0]) - parseFloat(tickerData.o)) / parseFloat(tickerData.o)) * 100;
          return {
            symbol: crypto,
            price: parseFloat(tickerData.c[0]),
            platform: 'Kraken',
            priceChange24h
          };
        } else {
          console.error(`Pair key not found for ${crypto}`);
          return {
            symbol: crypto,
            price: 0,
            platform: 'Kraken',
            priceChange24h: 0
          };
        }
      });
    } catch (err) {
      console.error('Error fetching Kraken prices:', err);
      return [];
    }
  };

  const fetchCoinbasePrices = async () => {
    try {
      const prices = await Promise.all(
        cryptos.map(async (crypto) => {
          try {
            const response = await fetch(`https://api.coinbase.com/v2/prices/${crypto}-${currency}/buy`);
            const data = await response.json();

            if (data.errors) {
              throw new Error(data.errors[0].message);
            }

            const currentPrice = parseFloat(data.data.amount);
            const yesterdayPrice = currency === 'USD' 
              ? YESTERDAY_PRICES_USD[crypto]
              : YESTERDAY_PRICES_EUR[crypto];
            
            const priceChange24h = ((currentPrice - yesterdayPrice) / yesterdayPrice) * 100;

            return {
              symbol: crypto,
              price: currentPrice,
              platform: 'Coinbase',
              priceChange24h: priceChange24h
            };
          } catch (error) {
            console.error(`Error fetching ${crypto} price from Coinbase:`, error);
            return {
              symbol: crypto,
              price: 0,
              platform: 'Coinbase',
              priceChange24h: 0
            };
          }
        })
      );
      return prices;
    } catch (err) {
      console.error('Error fetching Coinbase prices:', err);
      return [];
    }
  };

  const fetchBinancePrices = async () => {
    try {
      const symbol = currency === 'USD' ? 'USDT' : currency;
      const [priceResponse, changeResponse] = await Promise.all([
        fetch('https://api.binance.com/api/v3/ticker/price'),
        fetch('https://api.binance.com/api/v3/ticker/24hr')
      ]);
      
      const priceData = await priceResponse.json();
      const changeData = await changeResponse.json();
      
      return cryptos.map(crypto => {
        const tickerSymbol = `${crypto}${symbol}`;
        const priceInfo = priceData.find((ticker: any) => ticker.symbol === tickerSymbol);
        const changeInfo = changeData.find((ticker: any) => ticker.symbol === tickerSymbol);
        
        return {
          symbol: crypto,
          price: priceInfo ? parseFloat(priceInfo.price) : 0,
          platform: 'Binance',
          priceChange24h: changeInfo ? parseFloat(changeInfo.priceChangePercent) : 0
        };
      });
    } catch (err) {
      console.error('Error fetching Binance prices:', err);
      return [];
    }
  };

  const fetchAllPrices = async () => {
    setLoading(true);
    setError(null);
    try {
      const fetchFunctions = {
        'Kraken': fetchKrakenPrices,
        'Coinbase': fetchCoinbasePrices,
        'Binance': fetchBinancePrices
      };

      const allPrices = await Promise.all(
        platforms.map(platform => fetchFunctions[platform as keyof typeof fetchFunctions]())
      );

      setPrices(allPrices.flat().filter(price => price.price > 0));
    } catch (err) {
      setError('Error fetching prices. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllPrices();
    const interval = setInterval(fetchAllPrices, 30000);
    return () => clearInterval(interval);
  }, [currency]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2
    }).format(price);
  };

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Crypto Price Tracker</h1>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={currency === 'EUR'}
              onChange={(e) => setCurrency(e.target.checked ? 'EUR' : 'USD')}
              className="w-4 h-4 rounded border-gray-300"
            />
            <span className="text-gray-700">Show in EUR</span>
          </label>
          <button
            onClick={fetchAllPrices}
            className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="mb-6">
        <div className="flex border-b border-gray-200">
          {platforms.map(platform => (
            <button
              key={platform}
              onClick={() => setActiveTab(platform)}
              className={`px-6 py-3 font-medium ${
                activeTab === platform
                  ? 'border-b-2 border-blue-500 text-blue-500'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {platform}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-4 mb-4 text-red-700 bg-red-100 rounded">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent"></div>
          <p className="mt-2 text-gray-600">Loading prices...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {prices
            .filter(price => price.platform === activeTab)
            .map(({ symbol, price, priceChange24h }) => {
              const isPositive = (priceChange24h || 0) >= 0;
              
              return (
                <div
                  key={symbol}
                  className="p-6 border rounded-lg shadow-sm bg-white hover:shadow-md transition-shadow"
                >
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-gray-800">{symbol}</h3>
                    <span className="text-sm text-gray-500">{activeTab}</span>
                  </div>
                  <p className="text-2xl font-bold mt-2 text-gray-900">
                    {formatPrice(price)}
                  </p>
                  <div className={`flex items-center mt-2 ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                    {isPositive ? (
                      <ArrowUp className="w-4 h-4 mr-1" />
                    ) : (
                      <ArrowDown className="w-4 h-4 mr-1" />
                    )}
                    <span className="font-medium">
                      {Math.abs(priceChange24h || 0).toFixed(2)}%
                    </span>
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
};

export default CryptoPriceTracker;