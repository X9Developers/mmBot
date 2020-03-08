const promise = require('bluebird');
const co = require('co');
const path = require('path');
const grpc = require('grpc');
const PROTO_PATH = path.join(__dirname, '/lssdrpc.proto');
const currenciesClient = grpc.load(PROTO_PATH).lssdrpc.currencies;
const tradingPairsClient = grpc.load(PROTO_PATH).lssdrpc.tradingPairs;
const ordersClient = grpc.load(PROTO_PATH).lssdrpc.orders;
const swapsClient = grpc.load(PROTO_PATH).lssdrpc.swaps;

const RpcConfig = {
  host: "127.0.0.1",
  port: 50051
}

const currencies = [
  {
    currency: "LTC",
    lndChannel: "localhost:10001",
  },
  {
    currency: "XSN",
    lndChannel: "localhost:10003",
  }
];

const tlsCert = {
  certPath: "",
  rawCert: "",
};

const RpcAddress = RpcConfig.host + ':' + RpcConfig.port;

const getClient = function (Client) {
  return new Client(RpcAddress, grpc.credentials.createInsecure());
};

function bot() {
  const currenciesLssd = getClient(currenciesClient);
  const tradingPairLssd = getClient(tradingPairsClient);
  const ordersLssd = getClient(ordersClient);
  const swapsLssd = getClient(swapsClient);

  // Add Currency
  currencies.map( item => {
    currenciesLssd.AddCurrency({
      currency: item.currency,
      lndChannel: item.lndChannel,
      tlsCert: tlsCert
    }, function(err, res) {
      if (err) {
        return console.log("error", err);
      }
      return console.log("ok", res);
    });
  });

  // Trading Pair
  tradingPairLssd.EnableTradingPair( {
    pairId: "XSN_LTC"
  }, function(err, res) {
    if (err) {
      return console.log("error", err);
    }
    return console.log("ok", res);
  });
}

bot();
