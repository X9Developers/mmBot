# mmBot

A simple bot that puts continuous orders

# Configuration

Create `.env` in the project root.

| Name              | Description           | Sample                    |
| ----------------- | --------------------- | ------------------------- |
| LSSD_HOST         | Lssd Host             | localhost                 |
| LSSD_PORT         | Lssd Port             | 50051                     |
| LTC_LND_CHANNEL   | LTC Lnd Channel       | localhost:10001           |
| BTC_LND_CHANNEL   | BTC Lnd Channel       | localhost:10002           |
| XSN_LND_CHANNEL   | XSN Lnd Channel       | localhost:10003           |
| LTC_CERT_PATH     | LTC Cert Path         | /root/.lnd_ltc/tls.cert   |
| BTC_CERT_PATH     | BTC Cert Path         | /root/.lnd_btc/tls.cert   |
| XSN_CERT_PATH     | LTC Cert Path         | /root/.lnd_xsn/tls.cert   |
| PAIRID            | PairId                | XSN_LTC                   |
| PLACE_ORDER_LIMIT | Count Limit(-1 : MAX) | 5                         |
| BUY_OR_SELL       | buy, sell, both       | both                      |
# Run

- npm install
- npm start